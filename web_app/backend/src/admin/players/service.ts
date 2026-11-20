import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../../database/connection.js";
import { accountBans, accountDeletionRequests, accountFlags, accounts, bulkGrants, staffAccounts, staffAuditEvents, tokenLedgerEntries, tokenOrders } from "../../database/schema/index.js";
import { applyOnce, recordAudit } from "../audit.js";
import { StaffError } from "../staff-service.js";
import { normalizePhone, parsePhoneList } from "./phones.js";

export class PlayerError extends StaffError {}

type Actor = { actorId: string; requestKey: string };
const UUID = /^[0-9a-f-]{36}$/;
export const PAGE_SIZE = 25;
export const CREDIT_MAX = 1000;
export const PHONE_LIST_MAX = 5000;
/** One bulk-grant request keeps going for at most this long; the rest resumes with the same request. */
const RUN_BUDGET_MS = 20_000;
const LISTED_PHONES = 200;
const ACCOUNT_STATES = ["active", "deletion_pending", "deleted"] as const;

const id = (value: unknown) => {
  if (typeof value !== "string" || !UUID.test(value)) throw new PlayerError("not_found", 404);
  return value;
};
const reasonOf = (value: unknown) => {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) throw new PlayerError("reason_required");
  if (reason.length > 500) throw new PlayerError("reason_too_long");
  return reason;
};
const quantityOf = (value: unknown) => {
  const quantity = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > CREDIT_MAX) throw new PlayerError("invalid_quantity");
  return quantity;
};

const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
/** Keyset cursor on (timestamp, id): the timestamp is the database's own text, never a Date. */
function cursorOf(value: unknown): [string, string] | undefined {
  if (value === undefined || value === "") return undefined;
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) throw new PlayerError("invalid_cursor");
  return [match[1]!, match[2]!];
}
const nextCursor = <T extends { id: string }>(rows: T[], stamp: (row: T) => string) => {
  const last = rows.at(-1);
  return rows.length > PAGE_SIZE && last ? `${stamp(rows[PAGE_SIZE - 1]!)}|${rows[PAGE_SIZE - 1]!.id}` : null;
};

// Written out with aliases: Drizzle drops the table name from columns inside a single-table query,
// which would turn the correlation into `account_id = id` on the inner table.
const activeBan = () => sql`EXISTS (SELECT 1 FROM account_bans b WHERE b.account_id = "accounts"."id" AND b.lifted_at IS NULL)`;
const openFlag = () => sql`EXISTS (SELECT 1 FROM account_flags fl WHERE fl.account_id = "accounts"."id" AND fl.resolved_at IS NULL)`;

type BulkTarget = { kind: "all_active" } | { kind: "phone_list"; phones: string[]; invalid: string[] };

export class PlayersService {
  constructor(private readonly database: DatabaseConnection, private readonly chunkSize = 200) {}

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  // ---- reading ------------------------------------------------------------------------------

  /** Newest accounts first. `q` is a full phone number (any common spelling) or the last digits of one. */
  async list(filter: { q?: string; state?: string; banned?: string; flagged?: string; cursor?: unknown }) {
    const conditions: (SQL | undefined)[] = [];
    if (filter.q) {
      const full = normalizePhone(filter.q);
      const digits = filter.q.replace(/[\s\-()+.]/g, "");
      if (full) conditions.push(eq(accounts.phoneE164, full));
      else if (/^\d{4,}$/.test(digits)) conditions.push(sql`reverse(${accounts.phoneE164}) LIKE ${`${[...digits].reverse().join("")}%`}`);
      else throw new PlayerError("invalid_search");
    }
    if (filter.state) {
      if (!ACCOUNT_STATES.includes(filter.state as (typeof ACCOUNT_STATES)[number])) throw new PlayerError("invalid_filter");
      conditions.push(eq(accounts.state, filter.state as (typeof ACCOUNT_STATES)[number]));
    }
    if (filter.banned === "yes") conditions.push(activeBan());
    if (filter.banned === "no") conditions.push(sql`NOT ${activeBan()}`);
    if (filter.flagged === "yes") conditions.push(openFlag());
    if (filter.flagged === "no") conditions.push(sql`NOT ${openFlag()}`);
    const cursor = cursorOf(filter.cursor);
    if (cursor) conditions.push(or(lt(accounts.createdAt, cursor[0]), and(eq(accounts.createdAt, cursor[0]), lt(accounts.id, cursor[1])))!);
    const rows = await this.db
      .select({
        id: accounts.id,
        phone: accounts.phoneE164,
        displayName: accounts.displayName,
        state: accounts.state,
        createdAt: accounts.createdAt,
        tokenBalance: accounts.tokenBalance,
        banned: sql<boolean>`${activeBan()}`,
        flagged: sql<boolean>`${openFlag()}`,
      })
      .from(accounts)
      .where(and(...conditions))
      .orderBy(desc(accounts.createdAt), desc(accounts.id))
      .limit(PAGE_SIZE + 1);
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: nextCursor(rows, (row) => row.createdAt) };
  }

  async account(accountId: unknown, cursorInput?: unknown) {
    const accountKey = id(accountId);
    const [account] = await this.db
      .select({ id: accounts.id, phone: accounts.phoneE164, displayName: accounts.displayName, state: accounts.state, createdAt: accounts.createdAt, deletedAt: accounts.deletedAt, tokenBalance: accounts.tokenBalance, activeGameId: accounts.activeGameId })
      .from(accounts)
      .where(eq(accounts.id, accountKey))
      .limit(1);
    if (!account) throw new PlayerError("not_found", 404);
    const cursor = cursorOf(cursorInput);
    const ledgerWhere = and(eq(tokenLedgerEntries.accountId, accountKey), cursor ? or(lt(tokenLedgerEntries.createdAt, cursor[0]), and(eq(tokenLedgerEntries.createdAt, cursor[0]), lt(tokenLedgerEntries.id, cursor[1]))) : undefined);
    const [ledger, bans, flags, hosted, deletion] = await Promise.all([
      this.db
        .select({
          id: tokenLedgerEntries.id,
          createdAt: tokenLedgerEntries.createdAt,
          kind: tokenLedgerEntries.entryKind,
          amount: tokenLedgerEntries.amount,
          reasonText: tokenLedgerEntries.reasonText,
          gameId: tokenLedgerEntries.gameId,
          restorationReason: tokenLedgerEntries.restorationReason,
          orderKind: tokenOrders.orderKind,
          settlementKind: tokenLedgerEntries.sourceOrderSettlementKind,
          auditAction: staffAuditEvents.actionCode,
          staffEmail: staffAccounts.normalizedEmail,
        })
        .from(tokenLedgerEntries)
        .leftJoin(tokenOrders, eq(tokenOrders.id, tokenLedgerEntries.sourceOrderId))
        .leftJoin(staffAuditEvents, eq(staffAuditEvents.id, tokenLedgerEntries.staffAuditEventId))
        .leftJoin(staffAccounts, eq(staffAccounts.id, staffAuditEvents.staffAccountId))
        .where(ledgerWhere)
        .orderBy(desc(tokenLedgerEntries.createdAt), desc(tokenLedgerEntries.id))
        .limit(PAGE_SIZE + 1),
      this.db
        .select({ id: accountBans.id, reason: accountBans.reason, bannedAt: accountBans.bannedAt, bannedBy: sql<string>`b.normalized_email`, liftedAt: accountBans.liftedAt, liftReason: accountBans.liftReason, liftedBy: sql<string | null>`l.normalized_email` })
        .from(accountBans)
        .innerJoin(sql`${staffAccounts} b`, sql`b.id = ${accountBans.bannedBy}`)
        .leftJoin(sql`${staffAccounts} l`, sql`l.id = ${accountBans.liftedBy}`)
        .where(eq(accountBans.accountId, accountKey))
        .orderBy(desc(accountBans.bannedAt), desc(accountBans.id))
        .limit(20),
      this.db
        .select({ id: accountFlags.id, note: accountFlags.note, createdAt: accountFlags.createdAt, createdBy: sql<string>`c.normalized_email`, resolvedAt: accountFlags.resolvedAt, resolvedBy: sql<string | null>`r.normalized_email` })
        .from(accountFlags)
        .innerJoin(sql`${staffAccounts} c`, sql`c.id = ${accountFlags.createdBy}`)
        .leftJoin(sql`${staffAccounts} r`, sql`r.id = ${accountFlags.resolvedBy}`)
        .where(eq(accountFlags.accountId, accountKey))
        .orderBy(desc(accountFlags.createdAt), desc(accountFlags.id))
        .limit(50),
      // Every game a host starts spends exactly one token (a unique game debit), so this counts games hosted.
      this.db.select({ n: count() }).from(tokenLedgerEntries).where(and(eq(tokenLedgerEntries.accountId, accountKey), eq(tokenLedgerEntries.entryKind, "game_debit"))),
      this.db.select({ id: accountDeletionRequests.id, state: accountDeletionRequests.state, requestedAt: accountDeletionRequests.requestedAt }).from(accountDeletionRequests).where(eq(accountDeletionRequests.accountId, accountKey)).orderBy(desc(accountDeletionRequests.requestedAt)).limit(1),
    ]);
    const page = ledger.slice(0, PAGE_SIZE).map(({ createdAt, ...row }) => ({ createdAt, ...row, label: ledgerLabel(row) }));
    return {
      account: { ...account, gamesHosted: hosted[0]?.n ?? 0, banned: bans.some((ban) => !ban.liftedAt), openFlags: flags.filter((flag) => !flag.resolvedAt).length },
      bans,
      flags,
      deletionRequest: deletion[0] ?? null,
      ledger: page,
      nextCursor: nextCursor(ledger, (row) => row.createdAt),
    };
  }

  async deletionRequests(cursorInput?: unknown) {
    const cursor = cursorOf(cursorInput);
    const rows = await this.db
      .select({
        id: accountDeletionRequests.id,
        accountId: accountDeletionRequests.accountId,
        state: accountDeletionRequests.state,
        requestedAt: accountDeletionRequests.requestedAt,
        fundingClearedAt: accountDeletionRequests.fundingClearedAt,
        confirmedBank: accountDeletionRequests.confirmedBank,
        confirmedAt: accountDeletionRequests.confirmedAt,
        phone: accounts.phoneE164,
        displayName: accounts.displayName,
        accountState: accounts.state,
        tokenBalance: accounts.tokenBalance,
      })
      .from(accountDeletionRequests)
      .innerJoin(accounts, eq(accounts.id, accountDeletionRequests.accountId))
      .where(and(inArray(accountDeletionRequests.state, ["requested", "confirmed"]), cursor ? or(sql`${accountDeletionRequests.requestedAt} > ${cursor[0]}`, and(eq(accountDeletionRequests.requestedAt, cursor[0]), sql`${accountDeletionRequests.id} > ${cursor[1]}`)) : undefined))
      .orderBy(accountDeletionRequests.requestedAt, accountDeletionRequests.id)
      .limit(PAGE_SIZE + 1);
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: nextCursor(rows, (row) => row.requestedAt) };
  }

  // ---- complimentary credit -----------------------------------------------------------------

  async credit(input: Actor & { accountId: unknown; quantity: unknown; reason: unknown }) {
    const accountKey = id(input.accountId), quantity = quantityOf(input.quantity), reason = reasonOf(input.reason);
    return applyOnce(this.database, async (tx) => {
      const account = await this.lockAccount(tx, accountKey);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "token_grant", targetKind: "account", targetKey: accountKey, requestKey: input.requestKey, reason, details: { quantity } });
      if (account.state !== "active") throw new PlayerError("account_not_active", 409);
      // The ledger insert is the only thing that changes the bank; database triggers project it.
      await tx.insert(tokenLedgerEntries).values({ id: randomUUID(), accountId: accountKey, entryKind: "credit", amount: quantity, idempotencyKey: `staff-credit:${input.requestKey}`, staffAuditEventId: auditId, reasonText: reason });
      const [after] = await tx.select({ tokenBalance: accounts.tokenBalance }).from(accounts).where(eq(accounts.id, accountKey));
      return { accountId: accountKey, tokenBalance: after!.tokenBalance };
    });
  }

  private async lockAccount(tx: SahsahDatabase, accountId: string) {
    const [account] = await tx.select({ state: accounts.state }).from(accounts).where(eq(accounts.id, accountId)).for("update");
    if (!account) throw new PlayerError("not_found", 404);
    return account;
  }

  // ---- ban and flag -------------------------------------------------------------------------

  async ban(input: Actor & { accountId: unknown; reason: unknown }) {
    const accountKey = id(input.accountId), reason = reasonOf(input.reason);
    return applyOnce(this.database, async (tx) => {
      // The gameplay API locks the same row when it admits an account, so a ban and a start serialize.
      const account = await this.lockAccount(tx, accountKey);
      if (account.state === "deleted") throw new PlayerError("account_deleted", 409);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "account.ban", targetKind: "account", targetKey: accountKey, requestKey: input.requestKey, reason });
      const [existing] = await tx.select({ id: accountBans.id }).from(accountBans).where(and(eq(accountBans.accountId, accountKey), isNull(accountBans.liftedAt)));
      if (existing) throw new PlayerError("already_banned", 409);
      await tx.insert(accountBans).values({ id: randomUUID(), accountId: accountKey, reason, bannedBy: input.actorId, auditEventId: auditId });
      return { accountId: accountKey };
    });
  }

  async unban(input: Actor & { accountId: unknown; reason: unknown }) {
    const accountKey = id(input.accountId), reason = reasonOf(input.reason);
    return applyOnce(this.database, async (tx) => {
      await this.lockAccount(tx, accountKey);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "account.unban", targetKind: "account", targetKey: accountKey, requestKey: input.requestKey, reason });
      const lifted = await tx.update(accountBans).set({ liftedAt: sql`now()`, liftedBy: input.actorId, liftReason: reason, liftAuditEventId: auditId }).where(and(eq(accountBans.accountId, accountKey), isNull(accountBans.liftedAt))).returning({ id: accountBans.id });
      if (!lifted.length) throw new PlayerError("not_banned", 409);
      return { accountId: accountKey };
    });
  }

  async addFlag(input: Actor & { accountId: unknown; note: unknown }) {
    const accountKey = id(input.accountId);
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (!note) throw new PlayerError("note_required");
    if (note.length > 1000) throw new PlayerError("note_too_long");
    return applyOnce(this.database, async (tx) => {
      await this.lockAccount(tx, accountKey);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "account.flag", targetKind: "account", targetKey: accountKey, requestKey: input.requestKey, reason: note });
      const flagId = randomUUID();
      await tx.insert(accountFlags).values({ id: flagId, accountId: accountKey, note, createdBy: input.actorId, auditEventId: auditId });
      return { id: flagId };
    });
  }

  async resolveFlag(input: Actor & { flagId: unknown }) {
    const flagId = id(input.flagId);
    return applyOnce(this.database, async (tx) => {
      const [flag] = await tx.select({ accountId: accountFlags.accountId, resolvedAt: accountFlags.resolvedAt }).from(accountFlags).where(eq(accountFlags.id, flagId)).for("update");
      if (!flag) throw new PlayerError("not_found", 404);
      if (flag.resolvedAt) throw new PlayerError("already_resolved", 409);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "account.flag.resolve", targetKind: "account", targetKey: flag.accountId, requestKey: input.requestKey, details: { flagId } });
      await tx.update(accountFlags).set({ resolvedAt: sql`now()`, resolvedBy: input.actorId, resolveAuditEventId: auditId }).where(eq(accountFlags.id, flagId));
      return { id: flagId };
    });
  }

  // ---- bulk grant ---------------------------------------------------------------------------

  private target(input: { target: unknown; phones: unknown }): BulkTarget {
    if (input.target === "all_active") return { kind: "all_active" };
    if (input.target !== "phone_list") throw new PlayerError("invalid_target");
    const { phones, invalid } = parsePhoneList(typeof input.phones === "string" ? input.phones : "");
    if (phones.length > PHONE_LIST_MAX) throw new PlayerError("too_many_numbers");
    if (!phones.length) throw new PlayerError("no_numbers");
    return { kind: "phone_list", phones, invalid };
  }

  /** Accounts a grant can credit: active (not pending deletion, not deleted) and not banned. */
  private eligible(target: BulkTarget) {
    return and(eq(accounts.state, "active"), sql`NOT ${activeBan()}`, target.kind === "phone_list" ? inArray(accounts.phoneE164, target.phones) : undefined);
  }

  /** What a grant would do right now. Changes nothing. */
  async preview(input: { target: unknown; phones: unknown }) {
    const target = this.target(input);
    const [{ n }] = (await this.db.select({ n: count() }).from(accounts).where(this.eligible(target))) as [{ n: number }];
    if (target.kind === "all_active") return { target: "all_active", accounts: n };
    const found = await this.db.select({ phone: accounts.phoneE164, state: accounts.state, banned: sql<boolean>`${activeBan()}` }).from(accounts).where(inArray(accounts.phoneE164, target.phones));
    const byPhone = new Map(found.map((row) => [row.phone, row]));
    const notFound = target.phones.filter((phone) => !byPhone.has(phone));
    const skipped = found.filter((row) => row.state !== "active" || row.banned).map((row) => row.phone!);
    return {
      target: "phone_list",
      accounts: n,
      numbers: target.phones.length,
      notFound: notFound.slice(0, LISTED_PHONES),
      notFoundCount: notFound.length,
      skipped: skipped.slice(0, LISTED_PHONES),
      skippedCount: skipped.length,
      invalid: target.invalid.slice(0, LISTED_PHONES),
      invalidCount: target.invalid.length,
    };
  }

  /**
   * One audit event and one grant record are written first; then the credits go out in short
   * transactions of `chunkSize` accounts, each advancing the durable cursor. A retry with the same
   * request key (or Resume) carries on from the cursor, and each credit's idempotency key makes a
   * repeated chunk harmless.
   */
  async bulkGrant(input: Actor & { target: unknown; phones: unknown; quantity: unknown; reason: unknown }) {
    const target = this.target(input), quantity = quantityOf(input.quantity), reason = reasonOf(input.reason);
    const grantId = randomUUID();
    await applyOnce(this.database, async (tx) => {
      const [{ n }] = (await tx.select({ n: count() }).from(accounts).where(this.eligible(target))) as [{ n: number }];
      const auditId = await recordAudit(tx, {
        staffId: input.actorId,
        action: "token_bulk_grant",
        targetKind: "bulk_grant",
        targetKey: grantId,
        requestKey: input.requestKey,
        reason,
        details: { target: target.kind, quantity, accounts: n, ...(target.kind === "phone_list" ? { numbers: target.phones.length } : {}) },
      });
      await tx.insert(bulkGrants).values({ id: grantId, requestKey: input.requestKey, auditEventId: auditId, targetKind: target.kind, targetPhones: target.kind === "phone_list" ? target.phones : null, quantity, reason, targetCount: n, createdBy: input.actorId });
    });
    // A replayed request finds the grant the first attempt created and carries on with it.
    const [grant] = await this.db.select({ id: bulkGrants.id }).from(bulkGrants).where(eq(bulkGrants.requestKey, input.requestKey));
    return this.runGrant(grant!.id);
  }

  async resumeGrant(grantId: unknown) {
    return this.runGrant(id(grantId));
  }

  private async runGrant(grantId: string) {
    const started = Date.now();
    for (;;) {
      const progress = await this.grantChunk(grantId);
      if (progress.completed || Date.now() - started > RUN_BUDGET_MS) return progress;
    }
  }

  private async grantChunk(grantId: string) {
    return this.database.transaction(async (tx) => {
      const [grant] = await tx.select().from(bulkGrants).where(eq(bulkGrants.id, grantId)).for("update");
      if (!grant) throw new PlayerError("not_found", 404);
      const summary = (granted: number, completed: boolean) => ({ id: grant.id, targetCount: grant.targetCount, grantedCount: granted, completed });
      if (grant.completedAt) return summary(grant.grantedCount, true);
      const target: BulkTarget = grant.targetKind === "phone_list" ? { kind: "phone_list", phones: grant.targetPhones ?? [], invalid: [] } : { kind: "all_active" };
      // Locking the accounts re-checks the filter against their latest state (a ban or deletion request in between).
      const rows = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(this.eligible(target), grant.lastAccountId ? sql`${accounts.id} > ${grant.lastAccountId}` : undefined))
        .orderBy(accounts.id)
        .limit(this.chunkSize)
        .for("no key update", { of: accounts });
      const inserted = rows.length
        ? await tx
            .insert(tokenLedgerEntries)
            .values(rows.map((row) => ({ id: randomUUID(), accountId: row.id, entryKind: "credit" as const, amount: grant.quantity, idempotencyKey: `bulk:${grant.id}:${row.id}`, staffAuditEventId: grant.auditEventId, reasonText: grant.reason })))
            .onConflictDoNothing({ target: tokenLedgerEntries.idempotencyKey })
            .returning({ id: tokenLedgerEntries.id })
        : [];
      const completed = rows.length < this.chunkSize;
      const granted = grant.grantedCount + inserted.length;
      await tx.update(bulkGrants).set({ grantedCount: granted, lastAccountId: rows.at(-1)?.id ?? grant.lastAccountId, completedAt: completed ? sql`now()` : null }).where(eq(bulkGrants.id, grant.id));
      return summary(granted, completed);
    });
  }

  async recentGrants() {
    return this.db
      .select({ id: bulkGrants.id, createdAt: bulkGrants.createdAt, quantity: bulkGrants.quantity, reason: bulkGrants.reason, targetKind: bulkGrants.targetKind, targetCount: bulkGrants.targetCount, grantedCount: bulkGrants.grantedCount, completedAt: bulkGrants.completedAt, staffEmail: staffAccounts.normalizedEmail })
      .from(bulkGrants)
      .innerJoin(staffAccounts, eq(staffAccounts.id, bulkGrants.createdBy))
      .orderBy(desc(bulkGrants.createdAt), desc(bulkGrants.id))
      .limit(15);
  }
}

type LedgerRow = { kind: string; orderKind: string | null; settlementKind: string | null; auditAction: string | null; staffEmail: string | null; reasonText: string | null; restorationReason: string | null };
/** The plain-language line staff read in the history. */
function ledgerLabel(row: LedgerRow) {
  switch (row.kind) {
    case "credit":
      if (row.auditAction === "token_bulk_grant") return `Complimentary credit (bulk grant) by ${row.staffEmail}: ${row.reasonText}`;
      if (row.auditAction) return `Complimentary credit by ${row.staffEmail}: ${row.reasonText}`;
      if (row.settlementKind === "zero_cost") return "Free order";
      return row.orderKind === "gift" ? "Gift received" : "Purchase";
    case "game_debit":
      return "Game started";
    case "game_restoration":
      return row.restorationReason === "platform_failure" ? `Token restored after a platform failure${row.staffEmail ? ` (${row.staffEmail})` : ""}` : "Token restored: the game ended before any question opened";
    case "deletion_forfeiture":
      return `Forfeited when the account was deleted: ${row.reasonText}`;
    default:
      return row.kind;
  }
}
