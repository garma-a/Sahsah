import { createHash } from "node:crypto";
import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { Store, type SessionData } from "express-session";
import type { SahsahDatabase } from "../database/connection.js";
import { staffAccounts, staffSessions } from "../database/schema/index.js";
import type { JsonObject } from "../database/schema/types.js";

export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

/** Only the hash of the cookie's session id is stored, so a database read never yields a usable cookie. */
export const hashSessionId = (sid: string) => createHash("sha256").update(sid).digest();

type Callback<T = void> = (error?: unknown, value?: T) => void;

/**
 * express-session store over `staff_sessions`. A session is only usable while it is unexpired,
 * not revoked and its staff account is still active, so deactivating an account ends its sessions
 * even if the explicit revocation was missed.
 */
export class StaffSessionStore extends Store {
  constructor(private readonly db: SahsahDatabase) {
    super();
  }

  override get(sid: string, done: Callback<SessionData | null>) {
    void this.db
      .select({ data: staffSessions.sessionData })
      .from(staffSessions)
      .innerJoin(staffAccounts, eq(staffAccounts.id, staffSessions.staffAccountId))
      .where(and(
        eq(staffSessions.sessionHash, hashSessionId(sid)),
        isNull(staffSessions.revokedAt),
        gt(staffSessions.expiresAt, new Date().toISOString()),
        eq(staffAccounts.isActive, true),
      ))
      .limit(1)
      .then(([row]) => done(null, (row?.data as unknown as SessionData | undefined) ?? null), (error) => done(error));
  }

  override set(sid: string, session: SessionData, done?: Callback) {
    const staffId = (session as { adminUser?: { id?: string } }).adminUser?.id;
    // Anonymous sessions (before sign-in) have no account to belong to and are not persisted.
    if (!staffId) return done?.();
    const now = new Date();
    const expires = session.cookie?.expires ? new Date(session.cookie.expires) : new Date(now.getTime() + SESSION_LIFETIME_MS);
    const data = JSON.parse(JSON.stringify(session)) as JsonObject;
    void this.db
      .insert(staffSessions)
      .values({
        sessionHash: hashSessionId(sid),
        staffAccountId: staffId,
        sessionData: data,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      })
      // A revoked session stays revoked even if a late request saves it again.
      .onConflictDoUpdate({ target: staffSessions.sessionHash, set: { sessionData: data, expiresAt: expires.toISOString() } })
      .then(() => this.db.delete(staffSessions).where(lt(staffSessions.expiresAt, new Date(Date.now() - 24 * 3600 * 1000).toISOString())))
      .then(() => done?.(), (error) => done?.(error));
  }

  override destroy(sid: string, done?: Callback) {
    void this.db
      .delete(staffSessions)
      .where(eq(staffSessions.sessionHash, hashSessionId(sid)))
      .then(() => done?.(), (error) => done?.(error));
  }
}

/**
 * Revoke an account's sessions inside the transaction that deactivates it, resets its password
 * or changes its role. `keepSid` lets a Super Admin reset their own password without signing out.
 */
export async function revokeSessions(tx: SahsahDatabase, staffId: string, keepSid?: string) {
  await tx
    .update(staffSessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(
      eq(staffSessions.staffAccountId, staffId),
      isNull(staffSessions.revokedAt),
      keepSid ? ne(staffSessions.sessionHash, hashSessionId(keepSid)) : undefined,
    ));
}
