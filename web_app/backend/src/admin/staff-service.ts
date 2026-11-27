import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../database/connection.js";
import { staffAccounts } from "../database/schema/index.js";
import { log } from "../gameplay/platform/logging.js";
import { recordAudit } from "./audit.js";
import { hashPassword, MINIMUM_PASSWORD_LENGTH, temporaryPassword, verifyAgainstDecoy, verifyPassword } from "./passwords.js";
import { revokeSessions } from "./session-store.js";

export type StaffRole = "admin" | "super_admin";
export type CurrentStaff = { id: string; email: string; role: StaffRole; title: string };

/** A refusal with a stable code the page can show truthfully. */
export class StaffError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_STAFF_EMAIL_LENGTH = 254;
const normalizeEmail = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const BOOTSTRAP_LOCK = [1935763505, 3] as const;

/** Failed sign-ins per email, in process memory and bounded; resets when the service sleeps. */
export class LoginLimiter {
  private readonly failures = new Map<string, { count: number; until: number }>();
  constructor(private readonly maximum = 5, private readonly windowMs = 15 * 60 * 1000, private readonly capacity = 1000) {}

  blocked(key: string, now = Date.now()) {
    const entry = this.failures.get(key);
    if (entry && entry.until <= now) this.failures.delete(key);
    return (this.failures.get(key)?.count ?? 0) >= this.maximum;
  }

  fail(key: string, now = Date.now()) {
    const entry = this.failures.get(key);
    const count = entry && entry.until > now ? entry.count + 1 : 1;
    this.failures.delete(key);
    this.failures.set(key, { count, until: now + this.windowMs });
    // Oldest entry goes first once the cap is reached.
    if (this.failures.size > this.capacity) this.failures.delete(this.failures.keys().next().value!);
  }

  clear(key: string) {
    this.failures.delete(key);
  }
}

function pgError(error: unknown): { code?: string; constraint?: string } {
  const source = (error as { cause?: unknown })?.cause ?? error;
  return source as { code?: string; constraint?: string };
}

export class StaffService {
  readonly limiter = new LoginLimiter();
  constructor(private readonly database: DatabaseConnection) {}

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  /** Null for any failure, so the login page never says which part was wrong. */
  async authenticate(emailInput: unknown, password: unknown): Promise<CurrentStaff | null> {
    const email = normalizeEmail(emailInput);
    if (!email || typeof password !== "string" || !password) return null;
    if (this.limiter.blocked(email)) {
      // Same answer as a wrong password, so the login page renders and the email is not confirmed.
      log.warn("admin.login", { code: "LOCKED_OUT" });
      return null;
    }
    const [account] = await this.db.select().from(staffAccounts).where(eq(staffAccounts.normalizedEmail, email)).limit(1);
    const valid = account ? await verifyPassword(password, account.passwordHash) : (await verifyAgainstDecoy(password), false);
    if (!account || !valid || !account.isActive) {
      this.limiter.fail(email);
      return null;
    }
    this.limiter.clear(email);
    return { id: account.id, email: account.normalizedEmail, role: account.role, title: account.role === "super_admin" ? "Super Admin" : "Admin" };
  }

  /** Re-read from the database so a role or activation change applies to the very next request. */
  async current(id: string) {
    const [account] = await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, id)).limit(1);
    return account?.isActive ? account : undefined;
  }

  /** Any active staff member (Admin or Super Admin), checked against the database on every call. */
  async requireStaff(id: string | undefined) {
    const account = id ? await this.current(id) : undefined;
    if (!account) throw new StaffError("forbidden", 403);
    return account;
  }

  async requireSuperAdmin(id: string | undefined) {
    const account = id ? await this.current(id) : undefined;
    if (!account || account.role !== "super_admin") throw new StaffError("forbidden", 403);
    return account;
  }

  /**
   * First boot only: when no Super Admin exists yet, create one from the environment. System rows such as
   * the content importer (an inactive Admin) do not count, so seeding content first cannot lock staff out.
   */
  async bootstrap(emailInput: string | undefined, password: string | undefined) {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK[0]}, ${BOOTSTRAP_LOCK[1]})`);
      const [existing] = await tx.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.role, "super_admin")).limit(1);
      if (existing) return false;
      const email = normalizeEmail(emailInput);
      if (email.length > MAX_STAFF_EMAIL_LENGTH) {
        throw new Error(`ADMIN_BOOTSTRAP_EMAIL can be at most ${MAX_STAFF_EMAIL_LENGTH} characters.`);
      }
      if (!EMAIL.test(email) || !password || password.length < MINIMUM_PASSWORD_LENGTH) {
        throw new Error(`No staff account exists: set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (${MINIMUM_PASSWORD_LENGTH}+ characters).`);
      }
      const id = randomUUID();
      await tx.insert(staffAccounts).values({ id, role: "super_admin", normalizedEmail: email, passwordHash: await hashPassword(password) });
      await recordAudit(tx, { staffId: id, action: "staff.bootstrap", targetKind: "staff_account", targetKey: id, requestKey: randomUUID(), details: { role: "super_admin" } });
      return true;
    });
  }

  async list() {
    return this.db
      .select({ id: staffAccounts.id, email: staffAccounts.normalizedEmail, role: staffAccounts.role, isActive: staffAccounts.isActive, createdAt: staffAccounts.createdAt })
      .from(staffAccounts)
      .orderBy(asc(staffAccounts.createdAt), asc(staffAccounts.id))
      .limit(200);
  }

  /** A retry with the same request key finds its audit event and reports `replayed` instead of redoing the change. */
  private async change<T>(work: (tx: SahsahDatabase) => Promise<T>): Promise<T | { replayed: true }> {
    try {
      return await this.database.transaction(work);
    } catch (error) {
      const { code, constraint } = pgError(error);
      if (code === "23505" && constraint?.includes("request_key")) return { replayed: true };
      if (code === "23505" && constraint?.includes("normalized_email")) throw new StaffError("email_taken", 409);
      throw error;
    }
  }

  async create(input: { actorId: string; requestKey: string; email: unknown; role: unknown }) {
    const email = normalizeEmail(input.email);
    if (email.length > MAX_STAFF_EMAIL_LENGTH) throw new StaffError("email_too_long");
    if (!EMAIL.test(email)) throw new StaffError("invalid_email");
    if (input.role !== "admin" && input.role !== "super_admin") throw new StaffError("invalid_role");
    const role: StaffRole = input.role;
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    const result = await this.change(async (tx) => {
      // Audit first: a replayed request key must be recognised before the email looks like a duplicate.
      await recordAudit(tx, { staffId: input.actorId, action: "staff.create", targetKind: "staff_account", targetKey: id, requestKey: input.requestKey, details: { email, role } });
      await tx.insert(staffAccounts).values({ id, role, normalizedEmail: email, passwordHash });
      return { id, email, role, temporaryPassword: password };
    });
    return result;
  }

  /** Lock the active Super Admins so two simultaneous changes cannot both remove the last one. */
  private async lockSuperAdmins(tx: SahsahDatabase) {
    const rows = await tx.select({ id: staffAccounts.id }).from(staffAccounts)
      .where(sql`${staffAccounts.role} = 'super_admin' AND ${staffAccounts.isActive}`).for("update");
    return rows.length;
  }

  private async target(tx: SahsahDatabase, id: unknown) {
    if (typeof id !== "string") throw new StaffError("not_found", 404);
    const [account] = await tx.select().from(staffAccounts).where(eq(staffAccounts.id, id)).limit(1).for("update");
    if (!account) throw new StaffError("not_found", 404);
    return account;
  }

  async setActive(input: { actorId: string; requestKey: string; targetId: unknown; active: boolean }) {
    return this.change(async (tx) => {
      const activeSuperAdmins = await this.lockSuperAdmins(tx);
      const target = await this.target(tx, input.targetId);
      if (target.isActive === input.active) throw new StaffError("no_change", 409);
      if (!input.active) {
        if (target.id === input.actorId) throw new StaffError("cannot_deactivate_self", 409);
        if (target.role === "super_admin" && activeSuperAdmins <= 1) throw new StaffError("last_super_admin", 409);
      }
      await tx.update(staffAccounts).set({ isActive: input.active }).where(eq(staffAccounts.id, target.id));
      if (!input.active) await revokeSessions(tx, target.id);
      await recordAudit(tx, { staffId: input.actorId, action: input.active ? "staff.reactivate" : "staff.deactivate", targetKind: "staff_account", targetKey: target.id, requestKey: input.requestKey, details: { email: target.normalizedEmail } });
      return { id: target.id };
    });
  }

  async changeRole(input: { actorId: string; requestKey: string; targetId: unknown; role: unknown }) {
    if (input.role !== "admin" && input.role !== "super_admin") throw new StaffError("invalid_role");
    const role: StaffRole = input.role;
    return this.change(async (tx) => {
      const activeSuperAdmins = await this.lockSuperAdmins(tx);
      const target = await this.target(tx, input.targetId);
      if (target.role === role) throw new StaffError("no_change", 409);
      if (target.id === input.actorId) throw new StaffError("cannot_change_own_role", 409);
      if (target.role === "super_admin" && target.isActive && activeSuperAdmins <= 1) throw new StaffError("last_super_admin", 409);
      await tx.update(staffAccounts).set({ role }).where(eq(staffAccounts.id, target.id));
      // Signing in again picks up the new role everywhere, including the sidebar.
      await revokeSessions(tx, target.id);
      await recordAudit(tx, { staffId: input.actorId, action: "staff.change_role", targetKind: "staff_account", targetKey: target.id, requestKey: input.requestKey, details: { email: target.normalizedEmail, from: target.role, to: role } });
      return { id: target.id };
    });
  }

  async resetPassword(input: { actorId: string; requestKey: string; targetId: unknown; currentSessionId?: string }) {
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    return this.change(async (tx) => {
      const target = await this.target(tx, input.targetId);
      await tx.update(staffAccounts).set({ passwordHash }).where(eq(staffAccounts.id, target.id));
      await revokeSessions(tx, target.id, target.id === input.actorId ? input.currentSessionId : undefined);
      await recordAudit(tx, { staffId: input.actorId, action: "staff.reset_password", targetKind: "staff_account", targetKey: target.id, requestKey: input.requestKey, details: { email: target.normalizedEmail } });
      return { id: target.id, email: target.normalizedEmail, temporaryPassword: password };
    });
  }
}
