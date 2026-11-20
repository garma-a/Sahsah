import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lt, or, sql, type SQL } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../../database/connection.js";
import { accounts, contactReplies, contactSubmissions, staffAccounts } from "../../database/schema/index.js";
import { log } from "../../gameplay/platform/logging.js";
import { applyOnce, recordAudit } from "../audit.js";
import { StaffError } from "../staff-service.js";
import { renderReply, type Mailer } from "./mailer.js";

export class MessageError extends StaffError {}

type Actor = { actorId: string; requestKey: string };
const UUID = /^[0-9a-f-]{36}$/;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const PAGE_SIZE = 25;
export const REPLY_MAX = 5000;
const KINDS = ["support", "business", "experience"] as const;
const STATES = ["open", "closed"] as const;
const EXTERNAL_NOTE = "Answered from a staff email app.";

const id = (value: unknown) => {
  if (typeof value !== "string" || !UUID.test(value)) throw new MessageError("not_found", 404);
  return value;
};

const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
/** Keyset cursor on (created_at, id): the timestamp is the database's own text, never a Date. */
function cursorOf(value: unknown): [string, string] | undefined {
  if (value === undefined || value === "") return undefined;
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) throw new MessageError("invalid_cursor");
  return [match[1]!, match[2]!];
}

/** The subject staff see and the email carries; it names the kind of message, never its content. */
export function subjectFor(row: { kind: string; supportReason: string | null; businessKind: string | null }) {
  if (row.kind === "support") return `Re: Your Sahsah support request${row.supportReason ? ` (${row.supportReason})` : ""}`;
  if (row.kind === "business") return row.businessKind === "influencer" ? "Re: Your Sahsah partnership enquiry" : "Re: Your Sahsah business enquiry";
  return "Re: Your Sahsah feedback";
}

export class MessagesService {
  constructor(private readonly database: DatabaseConnection, private readonly mailer?: Mailer) {}

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  /** Newest first; the filters combine. The list carries a short preview, never the whole message. */
  async list(filter: { state?: string; kind?: string; cursor?: unknown }) {
    const conditions: (SQL | undefined)[] = [];
    if (filter.state) {
      if (!STATES.includes(filter.state as (typeof STATES)[number])) throw new MessageError("invalid_filter");
      conditions.push(eq(contactSubmissions.state, filter.state as (typeof STATES)[number]));
    }
    if (filter.kind) {
      if (!KINDS.includes(filter.kind as (typeof KINDS)[number])) throw new MessageError("invalid_filter");
      conditions.push(eq(contactSubmissions.kind, filter.kind as (typeof KINDS)[number]));
    }
    const cursor = cursorOf(filter.cursor);
    if (cursor) conditions.push(or(lt(contactSubmissions.createdAt, cursor[0]), and(eq(contactSubmissions.createdAt, cursor[0]), lt(contactSubmissions.id, cursor[1])))!);
    const rows = await this.db
      .select({
        id: contactSubmissions.id,
        createdAt: contactSubmissions.createdAt,
        kind: contactSubmissions.kind,
        supportReason: contactSubmissions.supportReason,
        businessKind: contactSubmissions.businessKind,
        rating: contactSubmissions.rating,
        name: contactSubmissions.name,
        email: contactSubmissions.email,
        state: contactSubmissions.state,
        preview: sql<string | null>`left(${contactSubmissions.message}, 140)`,
        // Written out with aliases: see the same note in the players service.
        replied: sql<boolean>`EXISTS (SELECT 1 FROM contact_replies r WHERE r.contact_id = "contact_submissions"."id" AND r.status IN ('sent', 'external'))`,
      })
      .from(contactSubmissions)
      .where(and(...conditions))
      .orderBy(desc(contactSubmissions.createdAt), desc(contactSubmissions.id))
      .limit(PAGE_SIZE + 1);
    const last = rows[PAGE_SIZE - 1];
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: rows.length > PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null };
  }

  async detail(contactId: unknown) {
    const key = id(contactId);
    const [message] = await this.db
      .select({
        id: contactSubmissions.id,
        kind: contactSubmissions.kind,
        supportReason: contactSubmissions.supportReason,
        businessKind: contactSubmissions.businessKind,
        name: contactSubmissions.name,
        email: contactSubmissions.email,
        handle: contactSubmissions.handle,
        message: contactSubmissions.message,
        rating: contactSubmissions.rating,
        state: contactSubmissions.state,
        createdAt: contactSubmissions.createdAt,
        closedAt: contactSubmissions.closedAt,
        closedBy: staffAccounts.normalizedEmail,
        accountId: contactSubmissions.accountId,
        accountName: accounts.displayName,
        accountPhone: accounts.phoneE164,
      })
      .from(contactSubmissions)
      .leftJoin(accounts, eq(accounts.id, contactSubmissions.accountId))
      .leftJoin(staffAccounts, eq(staffAccounts.id, contactSubmissions.closedByStaffId))
      .where(eq(contactSubmissions.id, key))
      .limit(1);
    if (!message) throw new MessageError("not_found", 404);
    const replies = await this.db
      .select({ id: contactReplies.id, createdAt: contactReplies.createdAt, completedAt: contactReplies.completedAt, status: contactReplies.status, errorCode: contactReplies.errorCode, body: contactReplies.body, staffEmail: staffAccounts.normalizedEmail })
      .from(contactReplies)
      .innerJoin(staffAccounts, eq(staffAccounts.id, contactReplies.staffId))
      .where(eq(contactReplies.contactId, key))
      .orderBy(asc(contactReplies.createdAt), asc(contactReplies.id))
      .limit(200);
    const mailable = message.kind !== "experience" && !!message.email && EMAIL.test(message.email);
    return {
      message,
      replies,
      subject: subjectFor(message),
      // Experience feedback never takes a reply; a message without a usable address cannot be emailed.
      replyBlocked: message.kind === "experience" ? "experience" : mailable ? null : "no_email",
      emailConfigured: !!this.mailer,
    };
  }

  // ---- replying -----------------------------------------------------------------------------

  private async replyTarget(contactId: string) {
    const [row] = await this.db.select({ kind: contactSubmissions.kind, supportReason: contactSubmissions.supportReason, businessKind: contactSubmissions.businessKind, email: contactSubmissions.email, message: contactSubmissions.message }).from(contactSubmissions).where(eq(contactSubmissions.id, contactId));
    if (!row) throw new MessageError("not_found", 404);
    if (row.kind === "experience") throw new MessageError("reply_not_allowed", 409);
    if (!row.email || !EMAIL.test(row.email)) throw new MessageError("no_email", 409);
    return { ...row, email: row.email };
  }

  private bodyOf(value: unknown) {
    const body = typeof value === "string" ? value.trim() : "";
    if (!body) throw new MessageError("body_required");
    if (body.length > REPLY_MAX) throw new MessageError("body_too_long");
    return body;
  }

  /**
   * The reply row (`sending`) and its audit event commit first; the provider is called outside the
   * transaction; then the row becomes `sent` or `failed`. A repeat of the same request returns the
   * stored outcome. It sends again only when the first attempt never finished, with the same
   * Idempotency-Key, so the provider still delivers once.
   */
  async reply(input: Actor & { contactId: unknown; body: unknown }) {
    const contactId = id(input.contactId), body = this.bodyOf(input.body);
    if (!this.mailer) throw new MessageError("email_not_configured", 409);
    const target = await this.replyTarget(contactId);
    const replyId = randomUUID();
    const first = await applyOnce(this.database, async (tx) => {
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "message.reply", targetKind: "contact_message", targetKey: contactId, requestKey: input.requestKey, details: { replyId, channel: "email" } });
      await tx.insert(contactReplies).values({ id: replyId, contactId, staffId: input.actorId, requestKey: input.requestKey, auditEventId: auditId, body, status: "sending" });
    });
    const reply = await this.byRequestKey(input.requestKey, contactId);
    if (reply.status === "sending") return this.deliver(reply, target, (first as { replayed?: true } | undefined)?.replayed === true);
    return this.outcome(reply);
  }

  private async byRequestKey(requestKey: string, contactId: string) {
    const [reply] = await this.db.select({ id: contactReplies.id, contactId: contactReplies.contactId, body: contactReplies.body, status: contactReplies.status, errorCode: contactReplies.errorCode }).from(contactReplies).where(eq(contactReplies.requestKey, requestKey));
    if (!reply || reply.contactId !== contactId) throw new MessageError("invalid_request");
    return reply;
  }

  private outcome(reply: { id: string; status: string; errorCode: string | null }) {
    if (reply.status === "failed") throw new MessageError(reply.errorCode ?? "provider_unavailable", 502);
    return { id: reply.id, status: reply.status };
  }

  private async deliver(reply: { id: string; body: string }, target: { email: string; message: string | null; kind: string; supportReason: string | null; businessKind: string | null }, retried: boolean) {
    const { text, html } = renderReply(reply.body, target.message);
    const result = await this.mailer!.send({ to: target.email, subject: subjectFor(target), text, html, idempotencyKey: `support-reply-${reply.id}` });
    const changed = await this.db
      .update(contactReplies)
      .set(result.ok ? { status: "sent", providerMessageId: result.providerId, completedAt: sql`now()` } : { status: "failed", errorCode: result.code, completedAt: sql`now()` })
      .where(and(eq(contactReplies.id, reply.id), eq(contactReplies.status, "sending")))
      .returning({ id: contactReplies.id });
    // Codes and counts only: never an address, a body or the provider's text.
    log.info("admin.message_reply", { outcome: result.ok ? "sent" : "failed", ...(result.ok ? {} : { code: result.code }), ...(retried ? { attempt: 2 } : {}) });
    if (!changed.length) {
      const [now] = await this.db.select({ id: contactReplies.id, status: contactReplies.status, errorCode: contactReplies.errorCode }).from(contactReplies).where(eq(contactReplies.id, reply.id));
      return this.outcome(now!);
    }
    return this.outcome(result.ok ? { id: reply.id, status: "sent", errorCode: null } : { id: reply.id, status: "failed", errorCode: result.code });
  }

  /** Staff answered from their own email app: record it. Nothing is sent from here. */
  async markReplied(input: Actor & { contactId: unknown; note: unknown }) {
    const contactId = id(input.contactId);
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (note.length > REPLY_MAX) throw new MessageError("body_too_long");
    await this.replyTarget(contactId);
    const replyId = randomUUID();
    const done = await applyOnce(this.database, async (tx) => {
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "message.reply", targetKind: "contact_message", targetKey: contactId, requestKey: input.requestKey, details: { replyId, channel: "external" } });
      await tx.insert(contactReplies).values({ id: replyId, contactId, staffId: input.actorId, requestKey: input.requestKey, auditEventId: auditId, body: note || EXTERNAL_NOTE, status: "external", completedAt: sql`now()` });
      return { id: replyId, status: "external" };
    });
    if (!("replayed" in done)) return done;
    return this.outcome(await this.byRequestKey(input.requestKey, contactId));
  }

  // ---- closing ------------------------------------------------------------------------------

  async setClosed(input: Actor & { contactId: unknown; closed: boolean }) {
    const contactId = id(input.contactId);
    return applyOnce(this.database, async (tx) => {
      const [row] = await tx.select({ state: contactSubmissions.state }).from(contactSubmissions).where(eq(contactSubmissions.id, contactId)).for("update");
      if (!row) throw new MessageError("not_found", 404);
      await recordAudit(tx, { staffId: input.actorId, action: input.closed ? "message.close" : "message.reopen", targetKind: "contact_message", targetKey: contactId, requestKey: input.requestKey });
      if (input.closed && row.state === "closed") throw new MessageError("already_closed", 409);
      if (!input.closed && row.state === "open") throw new MessageError("already_open", 409);
      await tx
        .update(contactSubmissions)
        .set(input.closed ? { state: "closed", closedAt: sql`now()`, closedByStaffId: input.actorId } : { state: "open", closedAt: null, closedByStaffId: null })
        .where(eq(contactSubmissions.id, contactId));
      return { id: contactId, state: input.closed ? "closed" : "open" };
    });
  }
}
