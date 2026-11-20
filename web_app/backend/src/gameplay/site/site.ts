import { Injectable } from "@nestjs/common";
import { and, eq, isNull, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.module.js";
import * as s from "../../database/schema/index.js";
import { id, type Contract } from "../contract.js";
import { local } from "../games/content.js";
import { clientAddress, httpRatePolicy } from "../platform/http.js";
import { GameplayIdentity } from "../platform/identity.js";
import { log, scoped } from "../platform/logging.js";
import { GameplayProblem, requireState } from "../platform/problem.js";
import { digest, equalProof } from "../platform/proof.js";
import { GameplayRates, sourceKey } from "../platform/rates.js";
import { RoomReceipts } from "../platform/receipts.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { language } from "../catalog/catalog.js";

const ANNOUNCEMENT_LIMIT = 5;
const ANNOUNCEMENT_TTL_MS = 30_000;
const SETTINGS_TTL_MS = 60_000;
const PAGE_SLUGS = ["about", "privacy", "terms", "faq"] as const;
const isoOf = (column: SQLWrapper) => sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

/**
 * Public site content: live announcements, published pages, site settings and the contact form.
 * Reads are cheap indexed queries; announcements and settings are also kept in process briefly
 * (two languages and one entry, so the cache is bounded by construction).
 */
@Injectable()
export class SiteService {
  private announcementCache = new Map<string, { until: number; value: Contract<"AnnouncementList"> }>();
  private settingsCache?: { until: number; value: Contract<"SiteSettings"> };
  private contactRates = new GameplayRates();
  private policy = httpRatePolicy(process.env);
  constructor(
    readonly runtime: GameplayRuntime,
    readonly database: DatabaseService,
    readonly identity: GameplayIdentity,
    readonly receipts: RoomReceipts,
  ) {}

  @scoped("site.announcements")
  async announcements(query: Record<string, unknown>): Promise<Contract<"AnnouncementList">> {
    const lang = language(query.language), cached = this.announcementCache.get(lang);
    if (cached && cached.until > Date.now()) return cached.value;
    const a = s.announcements;
    const rows = await this.database.db
      .select({ id: a.id, titleAr: a.titleAr, titleFranco: a.titleFranco, bodyAr: a.bodyAr, bodyFranco: a.bodyFranco, linkLabel: a.linkLabel, linkUrl: a.linkUrl, startsAt: isoOf(a.startsAt), endsAt: isoOf(a.endsAt) as unknown as SQL<string | null> })
      .from(a)
      .where(and(eq(a.isActive, true), sql`${a.startsAt} <= now()`, or(isNull(a.endsAt), sql`${a.endsAt} > now()`)))
      .orderBy(sql`${a.startsAt} DESC`, sql`${a.id} DESC`)
      .limit(ANNOUNCEMENT_LIMIT);
    const value: Contract<"AnnouncementList"> = {
      items: rows.map((row) => ({
        id: row.id,
        title: local(row.titleAr, row.titleFranco, lang),
        body: local(row.bodyAr, row.bodyFranco, lang),
        ...(row.linkLabel && row.linkUrl ? { linkLabel: row.linkLabel, linkUrl: row.linkUrl } : {}),
        startsAt: row.startsAt,
        ...(row.endsAt ? { endsAt: row.endsAt } : {}),
      })),
    };
    if (this.announcementCache.size >= 4) this.announcementCache.clear();
    this.announcementCache.set(lang, { until: Date.now() + ANNOUNCEMENT_TTL_MS, value });
    return value;
  }

  @scoped("site.page")
  async page(slug: string, query: Record<string, unknown>): Promise<Contract<"PublicPage">> {
    const lang = language(query.language);
    requireState((PAGE_SLUGS as readonly string[]).includes(slug), "NOT_FOUND", 404);
    const p = s.publicPages;
    const [row] = await this.database.db
      .select({ slug: p.slug, content: p.content, updatedAt: isoOf(p.updatedAt) })
      .from(p)
      .where(and(eq(p.slug, slug), eq(p.isPublished, true)))
      .limit(1);
    // An unpublished or never-written page does not exist for the public.
    requireState(row, "NOT_FOUND", 404);
    // The content is staff-written JSON: read each field as data and drop what does not fit.
    const c = row.content as Record<string, unknown>;
    const pick = (ar: string, franco: string) => (lang === "franco" ? (text(c[franco]) ?? text(c[ar])) : text(c[ar]));
    const title = pick("titleAr", "titleFranco");
    requireState(title, "NOT_FOUND", 404);
    const base = { slug: row.slug as Contract<"PublicPage">["slug"], title, updatedAt: row.updatedAt };
    if (slug === "faq") {
      const items = (Array.isArray(c.items) ? c.items : []).flatMap((item: unknown) => {
        const i = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const question = lang === "franco" ? (text(i.questionFranco) ?? text(i.questionAr)) : text(i.questionAr);
        const answer = lang === "franco" ? (text(i.answerFranco) ?? text(i.answerAr)) : text(i.answerAr);
        return question && answer ? [{ question, answer }] : [];
      });
      requireState(items.length, "NOT_FOUND", 404);
      return { ...base, items: items.slice(0, 50) };
    }
    const body = pick("bodyAr", "bodyFranco");
    requireState(body, "NOT_FOUND", 404);
    return { ...base, body };
  }

  @scoped("site.settings")
  async settings(): Promise<Contract<"SiteSettings">> {
    if (this.settingsCache && this.settingsCache.until > Date.now()) return this.settingsCache.value;
    const t = s.siteSettings, m = s.mediaAssets;
    const [row] = await this.database.db
      .select({ branding: t.branding, key: m.storageKey, width: m.widthPx, height: m.heightPx })
      .from(t)
      .leftJoin(m, and(eq(m.id, t.logoAssetId), eq(m.state, "ready"), eq(m.accessScope, "public"), isNull(m.archivedAt)))
      .where(eq(t.id, 1));
    const b = (row?.branding ?? {}) as Record<string, unknown>;
    const base = this.runtime.options.publicMediaBaseUrl;
    const value: Contract<"SiteSettings"> = {
      ...(base && row?.key && row.width && row.height ? { logoUrl: `${base}/${row.key}`, logoWidth: row.width, logoHeight: row.height } : {}),
      ...Object.fromEntries(["supportPhone", "whatsapp", "supportEmail", "facebookUrl", "instagramUrl", "tiktokUrl"].flatMap((key) => (text(b[key]) ? [[key, text(b[key])]] : []))),
    };
    this.settingsCache = { until: Date.now() + SETTINGS_TTL_MS, value };
    return value;
  }

  /**
   * One submission per Idempotency-Key. A retry with the same body replays the stored receipt; the same key with a
   * different body conflicts. The account is linked only when the sender is signed in with a valid credential.
   */
  @scoped("site.contact")
  async contact(req: Request, body: Contract<"ContactRequest">): Promise<{ receipt: Contract<"ContactReceipt">; replayed: boolean }> {
    const operationId = this.receipts.operation(req);
    // A tight bucket per client: contact messages are rare, so a burst of a few and a slow refill.
    this.contactRates.take(`contact:${sourceKey(clientAddress(req))}`, this.policy.contactPerHour / 3600, this.policy.contactPerHour);
    // A bot fills the hidden field: answer as if stored, and store nothing.
    if (typeof body.website === "string" && body.website.trim()) {
      log.info("site.contact", { outcome: "honeypot" });
      return { receipt: { id: operationId, receivedAt: new Date().toISOString() }, replayed: false };
    }
    let accountId: string | undefined;
    if (req.headers.authorization) {
      try {
        accountId = (await this.identity.actor(req)).account?.accountId;
      } catch (error) {
        // A stale or rejected credential must not stop a message that needs no account.
        if (!(error instanceof GameplayProblem) || ![401, 403].includes(error.status)) throw error;
      }
    }
    const { website: _website, ...fields } = body;
    const hash = digest("contact", "contact", { ...fields, accountId: accountId ?? null });
    const c = s.contactSubmissions;
    const row = {
      id: randomUUID(),
      requestKey: id(operationId),
      requestDigest: hash,
      accountId: accountId ?? null,
      kind: body.kind,
      supportReason: body.kind === "support" ? body.reason : null,
      businessKind: body.kind === "business" ? body.businessKind : null,
      name: ("name" in body ? body.name : undefined) ?? null,
      email: ("email" in body ? body.email : undefined) ?? null,
      handle: body.kind === "business" ? (body.handle ?? null) : null,
      message: ("message" in body ? body.message : undefined) ?? null,
      rating: body.kind === "experience" ? (body.rating ?? null) : null,
      createdAt: new Date().toISOString(),
    };
    const stored = await this.database.db.transaction(async (tx) => {
      const [inserted] = await tx.insert(c).values(row).onConflictDoNothing({ target: c.requestKey }).returning({ id: c.id, receivedAt: isoOf(c.createdAt) });
      if (inserted) return { receipt: inserted, replayed: false };
      const [existing] = await tx.select({ id: c.id, receivedAt: isoOf(c.createdAt), digest: c.requestDigest }).from(c).where(eq(c.requestKey, operationId));
      requireState(existing && equalProof(existing.digest, hash), "OPERATION_CONFLICT");
      return { receipt: { id: existing.id, receivedAt: existing.receivedAt }, replayed: true };
    });
    log.info("site.contact", { outcome: stored.replayed ? "replayed" : "stored" });
    return stored;
  }
}
