import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, or } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../database/connection.js";
import { staffAccounts, staffAuditEvents } from "../database/schema/index.js";
import type { JsonObject } from "../database/schema/types.js";

export type AuditEntry = {
  /** Set when other rows in the same transaction must point at this event. */
  id?: string;
  staffId: string;
  action: string;
  targetKind: string;
  targetKey: string;
  /** One per staff intent; a retry with the same key finds the event already written. */
  requestKey: string;
  reason?: string;
  details?: JsonObject;
};

/**
 * Call inside the transaction that makes the change, so the change and its audit row commit or
 * roll back together. Never put passwords or other secrets in `details`.
 */
export async function recordAudit(tx: SahsahDatabase, entry: AuditEntry) {
  const id = entry.id ?? randomUUID();
  await tx.insert(staffAuditEvents).values({
    id,
    staffAccountId: entry.staffId,
    actionCode: entry.action,
    targetKind: entry.targetKind,
    targetKey: entry.targetKey,
    requestKey: entry.requestKey,
    reason: entry.reason ?? null,
    details: entry.details ?? null,
  });
  return id;
}

export const AUDIT_PAGE_SIZE = 25;

export type AuditFilter = { staffId?: string; action?: string; cursor?: string };

export type AuditRow = {
  id: string;
  createdAt: string;
  staffEmail: string;
  action: string;
  targetKind: string;
  targetKey: string;
  reason: string | null;
};

export class AuditFilterError extends Error {
  constructor() {
    super("Invalid audit filter.");
  }
}

const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Newest first, keyset-paginated on (created_at, id). The cursor carries the timestamp as the
 * database's own text (full microseconds), never a JavaScript Date.
 */
export async function listAudit(db: SahsahDatabase, filter: AuditFilter) {
  const conditions = [];
  if (filter.staffId) {
    if (!UUID.test(filter.staffId)) throw new AuditFilterError();
    conditions.push(eq(staffAuditEvents.staffAccountId, filter.staffId));
  }
  if (filter.action) conditions.push(eq(staffAuditEvents.actionCode, filter.action));
  if (filter.cursor) {
    const cursor = CURSOR.exec(filter.cursor);
    if (!cursor) throw new AuditFilterError();
    conditions.push(
      or(
        lt(staffAuditEvents.createdAt, cursor[1]!),
        and(eq(staffAuditEvents.createdAt, cursor[1]!), lt(staffAuditEvents.id, cursor[2]!)),
      )!,
    );
  }
  const rows = await db
    .select({
      id: staffAuditEvents.id,
      createdAt: staffAuditEvents.createdAt,
      staffEmail: staffAccounts.normalizedEmail,
      action: staffAuditEvents.actionCode,
      targetKind: staffAuditEvents.targetKind,
      targetKey: staffAuditEvents.targetKey,
      reason: staffAuditEvents.reason,
    })
    .from(staffAuditEvents)
    .innerJoin(staffAccounts, eq(staffAccounts.id, staffAuditEvents.staffAccountId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(staffAuditEvents.createdAt), desc(staffAuditEvents.id))
    .limit(AUDIT_PAGE_SIZE + 1);
  const page: AuditRow[] = rows.slice(0, AUDIT_PAGE_SIZE);
  const last = page.at(-1);
  return { rows: page, nextCursor: rows.length > AUDIT_PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null };
}

/** Distinct action codes for the filter menu; the table is small and the list is bounded. */
export async function auditActions(db: SahsahDatabase) {
  const rows = await db.selectDistinct({ action: staffAuditEvents.actionCode }).from(staffAuditEvents).limit(100);
  return rows.map((row) => row.action).sort();
}

/**
 * Runs one staff change in a transaction. The change writes its audit row first, so a retry with
 * the same request key hits the unique key, rolls back and reports `replayed` instead of redoing it.
 */
export async function applyOnce<T>(database: DatabaseConnection, work: (tx: SahsahDatabase) => Promise<T>): Promise<T | { replayed: true }> {
  try {
    return await database.transaction(work);
  } catch (error) {
    const source = ((error as { cause?: unknown })?.cause ?? error) as { code?: string; constraint?: string };
    if (source.code === "23505" && source.constraint?.includes("request_key")) return { replayed: true };
    throw error;
  }
}

export async function requestKeySeen(db: SahsahDatabase, requestKey: string) {
  const [row] = await db.select({ id: staffAuditEvents.id }).from(staffAuditEvents).where(eq(staffAuditEvents.requestKey, requestKey)).limit(1);
  return !!row;
}
