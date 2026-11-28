import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../../database/connection.js";
import { announcements, mediaAssets, publicPages, siteSettings, staffAccounts } from "../../database/schema/index.js";
import type { JsonObject } from "../../database/schema/types.js";
import { applyOnce, recordAudit, requestKeySeen } from "../audit.js";
import { assetIdFor } from "../content/service.js";
import { inspectMedia, MediaRefusal } from "../content/inspect.js";
import { putOnce, type AdminMedia } from "../content/storage.js";
import { StaffError } from "../staff-service.js";
import { cleanPageContent, cleanSettings, cleanAnnouncement, PAGE_SLUGS, type PageSlug } from "./validation.js";

export class PublicSiteError extends StaffError {}

type Actor = { actorId: string; requestKey: string };
const UUID = /^[0-9a-f-]{36}$/;
export const PAGE_SIZE = 25;
const STATUSES = ["scheduled", "live", "ended", "inactive"] as const;

const id = (value: unknown) => {
  if (typeof value !== "string" || !UUID.test(value)) throw new PublicSiteError("not_found", 404);
  return value;
};

const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
/** Keyset cursor on (starts_at, id): the timestamp is the database's own text, never a Date. */
function cursorOf(value: unknown): [string, string] | undefined {
  if (value === undefined || value === "") return undefined;
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) throw new PublicSiteError("invalid_cursor");
  return [match[1]!, match[2]!];
}

/** An announcement counts as shown once it is active and started, so it can no longer be deleted. */
const shownNow = sql`(${announcements.isActive} AND ${announcements.startsAt} <= now())`;
const statusSql = sql<string>`CASE WHEN NOT ${announcements.isActive} THEN 'inactive' WHEN ${announcements.startsAt} > now() THEN 'scheduled' WHEN ${announcements.endsAt} IS NOT NULL AND ${announcements.endsAt} <= now() THEN 'ended' ELSE 'live' END`;

const PAGE_TITLES: Record<PageSlug, string> = { about: "About", privacy: "Privacy policy", terms: "Terms of use", faq: "FAQ" };

export class PublicSiteService {
  constructor(
    private readonly database: DatabaseConnection,
    private readonly media?: AdminMedia,
    /** Link to the Cloudflare Web Analytics dashboard, from `CLOUDFLARE_ANALYTICS_URL`. */
    readonly analyticsUrl?: string,
  ) {}

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  // ---- announcements --------------------------------------------------------------------------

  /** Newest start first; the status filter is evaluated against the database clock. */
  async announcements(filter: { status?: string; cursor?: unknown }) {
    const conditions: (SQL | undefined)[] = [];
    switch (filter.status || undefined) {
      case undefined:
        break;
      case "inactive":
        conditions.push(sql`NOT ${announcements.isActive}`);
        break;
      case "scheduled":
        conditions.push(sql`${announcements.isActive} AND ${announcements.startsAt} > now()`);
        break;
      case "live":
        conditions.push(sql`${shownNow} AND (${announcements.endsAt} IS NULL OR ${announcements.endsAt} > now())`);
        break;
      case "ended":
        conditions.push(sql`${shownNow} AND ${announcements.endsAt} IS NOT NULL AND ${announcements.endsAt} <= now()`);
        break;
      default:
        throw new PublicSiteError("invalid_filter");
    }
    const cursor = cursorOf(filter.cursor);
    if (cursor) conditions.push(or(lt(announcements.startsAt, cursor[0]), and(eq(announcements.startsAt, cursor[0]), lt(announcements.id, cursor[1])))!);
    const rows = await this.db
      .select({
        id: announcements.id,
        titleAr: announcements.titleAr,
        titleFranco: announcements.titleFranco,
        bodyAr: announcements.bodyAr,
        bodyFranco: announcements.bodyFranco,
        linkLabel: announcements.linkLabel,
        linkUrl: announcements.linkUrl,
        startsAt: announcements.startsAt,
        endsAt: announcements.endsAt,
        isActive: announcements.isActive,
        status: statusSql,
        deletable: sql<boolean>`(NOT ${announcements.everLive} AND NOT ${shownNow})`,
        updatedAt: announcements.updatedAt,
      })
      .from(announcements)
      .where(and(...conditions))
      .orderBy(desc(announcements.startsAt), desc(announcements.id))
      .limit(PAGE_SIZE + 1);
    const last = rows[PAGE_SIZE - 1];
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: rows.length > PAGE_SIZE && last ? `${last.startsAt}|${last.id}` : null, statuses: STATUSES };
  }

  async createAnnouncement(input: Actor & { fields: unknown }) {
    const fields = cleanAnnouncement(input.fields);
    return applyOnce(this.database, async (tx) => {
      const announcementId = randomUUID();
      await recordAudit(tx, { staffId: input.actorId, action: "announcement.create", targetKind: "announcement", targetKey: announcementId, requestKey: input.requestKey, details: { startsAt: fields.startsAt, endsAt: fields.endsAt, link: !!fields.linkUrl, franco: !!fields.titleFranco } });
      await tx.insert(announcements).values({ id: announcementId, ...fields, createdByStaffId: input.actorId, updatedByStaffId: input.actorId });
      return { id: announcementId };
    });
  }

  private async lockAnnouncement(tx: SahsahDatabase, announcementId: string) {
    const [row] = await tx
      .select({ isActive: announcements.isActive, everLive: announcements.everLive, shown: sql<boolean>`${shownNow}`, titleAr: announcements.titleAr })
      .from(announcements)
      .where(eq(announcements.id, announcementId))
      .for("update");
    if (!row) throw new PublicSiteError("not_found", 404);
    return row;
  }

  async updateAnnouncement(input: Actor & { announcementId: unknown; fields: unknown }) {
    const announcementId = id(input.announcementId), fields = cleanAnnouncement(input.fields);
    return applyOnce(this.database, async (tx) => {
      const current = await this.lockAnnouncement(tx, announcementId);
      await recordAudit(tx, { staffId: input.actorId, action: "announcement.update", targetKind: "announcement", targetKey: announcementId, requestKey: input.requestKey, details: { startsAt: fields.startsAt, endsAt: fields.endsAt, link: !!fields.linkUrl } });
      await tx.update(announcements).set({ ...fields, everLive: current.everLive || current.shown, updatedByStaffId: input.actorId, updatedAt: sql`now()` }).where(eq(announcements.id, announcementId));
      return { id: announcementId };
    });
  }

  async setAnnouncementActive(input: Actor & { announcementId: unknown; active: unknown }) {
    const announcementId = id(input.announcementId);
    if (typeof input.active !== "boolean") throw new PublicSiteError("invalid_request");
    const active = input.active;
    return applyOnce(this.database, async (tx) => {
      const current = await this.lockAnnouncement(tx, announcementId);
      await recordAudit(tx, { staffId: input.actorId, action: active ? "announcement.activate" : "announcement.deactivate", targetKind: "announcement", targetKey: announcementId, requestKey: input.requestKey });
      if (current.isActive === active) throw new PublicSiteError("no_change", 409);
      await tx.update(announcements).set({ isActive: active, everLive: current.everLive || current.shown, updatedByStaffId: input.actorId, updatedAt: sql`now()` }).where(eq(announcements.id, announcementId));
      return { id: announcementId };
    });
  }

  /** Removes an announcement nobody could have seen. One that was shown stays and is switched off instead. */
  async deleteAnnouncement(input: Actor & { announcementId: unknown }) {
    const announcementId = id(input.announcementId);
    return applyOnce(this.database, async (tx) => {
      const current = await this.lockAnnouncement(tx, announcementId);
      await recordAudit(tx, { staffId: input.actorId, action: "announcement.delete", targetKind: "announcement", targetKey: announcementId, requestKey: input.requestKey, details: { title: current.titleAr } });
      if (current.everLive || current.shown) throw new PublicSiteError("announcement_was_live", 409);
      await tx.delete(announcements).where(eq(announcements.id, announcementId));
      return { id: announcementId };
    });
  }

  // ---- pages ----------------------------------------------------------------------------------

  /** The four fixed pages; one that was never saved is reported as not existing yet. */
  async pages() {
    const rows = await this.db
      .select({ slug: publicPages.slug, content: publicPages.content, isPublished: publicPages.isPublished, updatedAt: publicPages.updatedAt, updatedBy: staffAccounts.normalizedEmail })
      .from(publicPages)
      .innerJoin(staffAccounts, eq(staffAccounts.id, publicPages.updatedByStaffId))
      .where(inArray(publicPages.slug, [...PAGE_SLUGS]));
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    return { pages: PAGE_SLUGS.map((slug) => ({ slug, label: PAGE_TITLES[slug], exists: bySlug.has(slug), isPublished: bySlug.get(slug)?.isPublished ?? false, content: bySlug.get(slug)?.content ?? null, updatedAt: bySlug.get(slug)?.updatedAt ?? null, updatedBy: bySlug.get(slug)?.updatedBy ?? null })) };
  }

  private slug(value: unknown): PageSlug {
    if (typeof value !== "string" || !(PAGE_SLUGS as readonly string[]).includes(value)) throw new PublicSiteError("not_found", 404);
    return value as PageSlug;
  }

  /** Saving never publishes: a new page starts hidden, an existing one keeps its state. */
  async savePage(input: Actor & { slug: unknown; content: unknown }) {
    const slug = this.slug(input.slug), content = cleanPageContent(slug, input.content);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "page.save", targetKind: "public_page", targetKey: slug, requestKey: input.requestKey, details: { size: JSON.stringify(content).length } });
      await tx
        .insert(publicPages)
        .values({ id: randomUUID(), slug, content, updatedByStaffId: input.actorId, updatedAt: sql`now()` as unknown as string })
        .onConflictDoUpdate({ target: publicPages.slug, set: { content, contentSchemaVersion: 1, updatedByStaffId: input.actorId, updatedAt: sql`now()` } });
      return { slug };
    });
  }

  async setPagePublished(input: Actor & { slug: unknown; published: unknown }) {
    const slug = this.slug(input.slug);
    if (typeof input.published !== "boolean") throw new PublicSiteError("invalid_request");
    const published = input.published;
    return applyOnce(this.database, async (tx) => {
      const [current] = await tx.select({ isPublished: publicPages.isPublished }).from(publicPages).where(eq(publicPages.slug, slug)).for("update");
      if (!current) throw new PublicSiteError("page_not_saved", 409);
      await recordAudit(tx, { staffId: input.actorId, action: published ? "page.publish" : "page.unpublish", targetKind: "public_page", targetKey: slug, requestKey: input.requestKey });
      if (current.isPublished === published) throw new PublicSiteError("no_change", 409);
      await tx.update(publicPages).set({ isPublished: published, updatedByStaffId: input.actorId, updatedAt: sql`now()` }).where(eq(publicPages.slug, slug));
      return { slug };
    });
  }

  // ---- site settings --------------------------------------------------------------------------

  async settings() {
    const [row] = await this.db
      .select({ branding: siteSettings.branding, updatedAt: siteSettings.updatedAt, updatedBy: staffAccounts.normalizedEmail, logoKey: mediaAssets.storageKey, logoWidth: mediaAssets.widthPx, logoHeight: mediaAssets.heightPx })
      .from(siteSettings)
      .innerJoin(staffAccounts, eq(staffAccounts.id, siteSettings.updatedByStaffId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, siteSettings.logoAssetId))
      .where(eq(siteSettings.id, 1));
    return {
      settings: row?.branding ?? {},
      logoUrl: row?.logoKey && this.media ? this.media.publicUrl(row.logoKey) : null,
      logoWidth: row?.logoWidth ?? null,
      logoHeight: row?.logoHeight ?? null,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
      uploadsEnabled: !!this.media,
    };
  }

  async saveSettings(input: Actor & { fields: unknown }) {
    const branding = cleanSettings(input.fields);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "site.settings.save", targetKind: "site_settings", targetKey: "1", requestKey: input.requestKey, details: { fields: Object.keys(branding).sort().join(",") } });
      await tx
        .insert(siteSettings)
        .values({ id: 1, branding, updatedByStaffId: input.actorId, updatedAt: sql`now()` as unknown as string })
        .onConflictDoUpdate({ target: siteSettings.id, set: { branding, updatedByStaffId: input.actorId, updatedAt: sql`now()` } });
      return { saved: true };
    });
  }

  /** The site logo is public artwork: it goes to the public bucket like a category cover. */
  async uploadLogo(input: Actor & { body: unknown }) {
    if (!this.media) throw new PublicSiteError("media_not_configured", 503);
    if (!Buffer.isBuffer(input.body)) throw new PublicSiteError("file_required");
    let found;
    try {
      found = inspectMedia(input.body, "logo");
    } catch (error) {
      if (error instanceof MediaRefusal) throw new PublicSiteError(error.code, error.code === "file_too_large" ? 413 : 400);
      throw error;
    }
    const body = input.body, assetId = assetIdFor(input.requestKey);
    if (await requestKeySeen(this.db, input.requestKey)) return { replayed: true };
    const key = `site/logo-${assetId}.${found.extension}`;
    try {
      await putOnce(this.media, "public", key, body, found.contentType);
    } catch {
      throw new PublicSiteError("storage_unavailable", 502);
    }
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "site.logo.upload", targetKind: "site_settings", targetKey: "1", requestKey: input.requestKey, details: { assetId, byteSize: body.length } });
      await tx.insert(mediaAssets).values({
        id: assetId,
        mediaKind: "image",
        state: "ready",
        readyAt: sql`now()` as unknown as string,
        accessScope: "public",
        storageProvider: this.media!.provider,
        storageNamespace: this.media!.namespace("public"),
        storageKey: key,
        contentType: found.contentType,
        byteSize: BigInt(body.length),
        widthPx: found.widthPx!,
        heightPx: found.heightPx!,
        sha256: createHash("sha256").update(body).digest(),
        uploadedByStaffId: input.actorId,
      });
      await tx
        .insert(siteSettings)
        .values({ id: 1, branding: {} as JsonObject, logoAssetId: assetId, updatedByStaffId: input.actorId, updatedAt: sql`now()` as unknown as string })
        .onConflictDoUpdate({ target: siteSettings.id, set: { logoAssetId: assetId, updatedByStaffId: input.actorId, updatedAt: sql`now()` } });
      return { assetId };
    });
  }

  async removeLogo(input: Actor) {
    return applyOnce(this.database, async (tx) => {
      const [current] = await tx.select({ logo: siteSettings.logoAssetId }).from(siteSettings).where(eq(siteSettings.id, 1)).for("update");
      await recordAudit(tx, { staffId: input.actorId, action: "site.logo.remove", targetKind: "site_settings", targetKey: "1", requestKey: input.requestKey });
      if (!current?.logo) throw new PublicSiteError("no_change", 409);
      await tx.update(siteSettings).set({ logoAssetId: null, updatedByStaffId: input.actorId, updatedAt: sql`now()` }).where(eq(siteSettings.id, 1));
      return { removed: true };
    });
  }
}
