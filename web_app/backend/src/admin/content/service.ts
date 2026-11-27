import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { DatabaseConnection, SahsahDatabase } from "../../database/connection.js";
import { categories, categorySections, mediaAssets, questionFormats, questionMedia, questionPacks, questions } from "../../database/schema/index.js";
import type { JsonObject } from "../../database/schema/types.js";
import { defaultPointStages, slotPoints } from "../../gameplay/games/rules/points.js";
import { FORMAT_SLOTS, slotsFor, type SlotSpec } from "../../gameplay/games/rules/question-content.js";
import type { ComposedDefinition } from "../../gameplay/games/rules/composed-format.js";
import { FormatService } from "./formats.js";
import { applyOnce, recordAudit, requestKeySeen } from "../audit.js";
import { StaffError } from "../staff-service.js";
import { inspectMedia, MediaRefusal, type Inspected } from "./inspect.js";
import { loadPackContent, packIssues, questionStats, retiredQuestions, type PackIssue } from "./packs.js";
import { putOnce, type AdminMedia } from "./storage.js";

/** A refusal with a stable code; `issues` lists what stops a pack from being published. */
export class ContentError extends StaffError {
  constructor(code: string, status = 400, readonly issues?: PackIssue[]) {
    super(code, status);
  }
}

type Actor = { actorId: string; requestKey: string };
const UUID = /^[0-9a-f-]{36}$/;
const FORMATS = Object.keys(FORMAT_SLOTS);
export const PAGE_SIZE = 25;

const text = (value: unknown, code: string, max: number, required = true) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new ContentError(code);
    return null;
  }
  if (trimmed.length > max) throw new ContentError(`${code}_too_long`);
  return trimmed;
};
const id = (value: unknown, code = "not_found") => {
  if (typeof value !== "string" || !UUID.test(value)) throw new ContentError(code, 404);
  return value;
};

/** The same request key always maps to the same asset id, so a retried upload finds its file. */
export const assetIdFor = (requestKey: string) => {
  const h = createHash("sha256").update(`media:${requestKey}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const encodeCursor = (order: number, key: string) => Buffer.from(JSON.stringify([order, key])).toString("base64url");
function decodeCursor(value: unknown): [number, string] | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString());
    if (Array.isArray(parsed) && parsed.length === 2 && Number.isInteger(parsed[0]) && parsed[0] >= 0 && parsed[0] <= 2_147_483_647
      && typeof parsed[1] === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(parsed[1])) return [parsed[0], parsed[1]];
  } catch {
    // falls through to the refusal
  }
  throw new ContentError("invalid_cursor");
}

/** Only these settings exist per format; anything else the browser sends is dropped. */
export function cleanConfig(format: string, input: unknown): JsonObject {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: JsonObject = {};
  const put = (key: string, max: number) => {
    const value = text(raw[key], "invalid_config", max, false);
    if (value) out[key] = value;
  };
  if (format === "IMAGE_MEMORY") {
    put("instructionAr", 4000);
    put("instructionFranco", 4000);
  }
  if (format === "AUDIO_VOICE") {
    put("hintAr", 500);
    put("hintFranco", 500);
  }
  if (format === "AUDIO_REVERSE" && raw.allowForward === true) out.allowForward = true;
  if (format === "IMAGE_COLOR") {
    const color = text(raw.colorHex, "invalid_config", 7, false);
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new ContentError("invalid_config");
    if (color) out.colorHex = color;
  }
  return out;
}

/** The row for a question file that was just stored; it stays pending until a question uses it. */
export const pendingAsset = (media: AdminMedia, o: { assetId: string; key: string; found: Inspected; body: Buffer; staffId: string }) => ({
  id: o.assetId,
  mediaKind: o.found.kind,
  state: "pending" as const,
  accessScope: "private" as const,
  storageProvider: media.provider,
  storageNamespace: media.namespace("private"),
  storageKey: o.key,
  contentType: o.found.contentType,
  byteSize: BigInt(o.body.length),
  widthPx: o.found.widthPx ?? null,
  heightPx: o.found.heightPx ?? null,
  durationMs: o.found.durationMs ?? null,
  sha256: createHash("sha256").update(o.body).digest(),
  uploadedByStaffId: o.staffId,
});

type MediaItem = { key: string; assetId: string; points?: number };
type FormatRow = typeof questionFormats.$inferSelect;
export const definitionOf = (row: FormatRow): ComposedDefinition => ({
  code: row.code,
  nameEn: row.nameEn,
  labelAr: row.labelAr,
  baseKind: row.baseKind as ComposedDefinition["baseKind"],
  stageKinds: row.stageKinds as ComposedDefinition["stageKinds"],
  answerKind: row.answerKind as ComposedDefinition["answerKind"],
  showPrompt: row.showPrompt,
});

export class ContentService {
  readonly formats: FormatService;
  constructor(
    private readonly database: DatabaseConnection,
    readonly media: AdminMedia | undefined,
  ) {
    this.formats = new FormatService(database);
  }

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  // ---- reading ------------------------------------------------------------------------------

  private async sign(asset: { storageProvider: string; storageNamespace: string; storageKey: string }) {
    try {
      return (await this.media?.sign({ provider: asset.storageProvider, namespace: asset.storageNamespace, key: asset.storageKey }))?.url ?? null;
    } catch {
      return null;
    }
  }

  private describe(asset: typeof mediaAssets.$inferSelect) {
    return {
      id: asset.id,
      kind: asset.mediaKind,
      state: asset.state,
      contentType: asset.contentType,
      byteSize: asset.byteSize === null ? null : Number(asset.byteSize),
      widthPx: asset.widthPx,
      heightPx: asset.heightPx,
      durationMs: asset.durationMs,
    };
  }

  private async categoryRows(db: SahsahDatabase, where: ReturnType<typeof and>, limit: number) {
    const rows = await db
      .select({ category: categories, sectionName: categorySections.nameAr, coverKey: mediaAssets.storageKey })
      .from(categories)
      .leftJoin(categorySections, eq(categorySections.id, categories.sectionId))
      .leftJoin(mediaAssets, and(eq(mediaAssets.id, categories.coverMediaAssetId), eq(mediaAssets.accessScope, "public")))
      .where(where)
      .orderBy(categories.displayOrder, categories.id)
      .limit(limit);
    const ids = rows.map((r) => r.category.id);
    const counts = ids.length
      ? await db
          .select({
            categoryId: questionPacks.categoryId,
            total: sql<number>`count(*)::int`,
            published: sql<number>`count(*) FILTER (WHERE ${questionPacks.publicationState} = 'published' AND ${questionPacks.archivedAt} IS NULL)::int`,
            drafts: sql<number>`count(*) FILTER (WHERE ${questionPacks.publicationState} = 'draft' AND ${questionPacks.archivedAt} IS NULL)::int`,
            archived: sql<number>`count(*) FILTER (WHERE ${questionPacks.archivedAt} IS NOT NULL)::int`,
          })
          .from(questionPacks)
          .where(inArray(questionPacks.categoryId, ids))
          .groupBy(questionPacks.categoryId)
      : [];
    return rows.map((r) => ({
      id: r.category.id,
      nameAr: r.category.nameAr,
      nameFranco: r.category.nameFranco,
      descriptionAr: r.category.descriptionAr,
      descriptionFranco: r.category.descriptionFranco,
      sectionId: r.category.sectionId,
      sectionName: r.sectionName,
      displayOrder: r.category.displayOrder,
      archived: r.category.archivedAt !== null,
      coverUrl: r.coverKey && this.media ? this.media.publicUrl(r.coverKey) : null,
      packs: counts.find((c) => c.categoryId === r.category.id) ?? { total: 0, published: 0, drafts: 0, archived: 0 },
    }));
  }

  async home(query: { section?: string; status?: string; cursor?: string }) {
    const sections = await this.db.select().from(categorySections).orderBy(categorySections.displayOrder, categorySections.id).limit(500);
    const conditions = [];
    if (query.section === "none") conditions.push(isNull(categories.sectionId));
    else if (query.section) conditions.push(eq(categories.sectionId, id(query.section, "invalid_filter")));
    const status = query.status || "active";
    if (!["active", "archived", "all"].includes(status)) throw new ContentError("invalid_filter");
    if (status === "active") conditions.push(isNull(categories.archivedAt));
    if (status === "archived") conditions.push(isNotNull(categories.archivedAt));
    const cursor = decodeCursor(query.cursor);
    if (cursor) conditions.push(or(gt(categories.displayOrder, cursor[0]), and(eq(categories.displayOrder, cursor[0]), gt(categories.id, cursor[1])))!);
    const rows = await this.categoryRows(this.db, conditions.length ? and(...conditions) : undefined, PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    return {
      sections,
      categories: page,
      nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.displayOrder, last.id) : null,
      mediaEnabled: !!this.media,
    };
  }

  async category(categoryId: unknown, cursorInput?: unknown) {
    const key = id(categoryId);
    const cursor = decodeCursor(cursorInput);
    const [category] = await this.categoryRows(this.db, eq(categories.id, key), 1);
    if (!category) throw new ContentError("not_found", 404);
    const sections = await this.db.select().from(categorySections).orderBy(categorySections.displayOrder, categorySections.id).limit(500);
    const rows = await this.db.select().from(questionPacks)
      .where(and(
        eq(questionPacks.categoryId, key),
        cursor && sql`(${questionPacks.packNumber}, ${questionPacks.id}) > (${cursor[0]}, ${cursor[1]})`,
      ))
      .orderBy(questionPacks.packNumber, questionPacks.id)
      .limit(PAGE_SIZE + 1);
    const packs = rows.slice(0, PAGE_SIZE);
    const last = packs.at(-1);
    const content = await loadPackContent(this.db, packs.map((p) => p.id));
    return {
      category,
      sections,
      mediaEnabled: !!this.media,
      nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.packNumber, last.id) : null,
      packs: packs.map((p) => ({
        id: p.id,
        packNumber: p.packNumber,
        state: p.archivedAt ? "archived" : p.publicationState,
        publicationState: p.publicationState,
        filledSlots: content.questions.filter((q) => q.packId === p.id).length,
        issueCount: packIssues(content, p.id).length,
      })),
    };
  }

  private async activeFormats(exclude: string[]) {
    const rows = await this.db.select().from(questionFormats).where(isNull(questionFormats.archivedAt)).orderBy(questionFormats.nameEn, questionFormats.id).limit(300);
    return rows.filter((r) => !exclude.includes(r.id));
  }

  async pack(packId: unknown) {
    const key = id(packId);
    const [pack] = await this.db.select().from(questionPacks).where(eq(questionPacks.id, key)).limit(1);
    if (!pack) throw new ContentError("not_found", 404);
    const [category] = await this.categoryRows(this.db, eq(categories.id, pack.categoryId), 1);
    const content = await loadPackContent(this.db, [pack.id]);
    const stats = await questionStats(this.db, content.questions.map((q) => q.id));
    const slots = await Promise.all(
      [1, 2, 3, 4, 5, 6].map(async (slot) => {
        const q = content.questions.find((x) => x.slotNumber === slot);
        if (!q) return { slot, points: slotPoints(slot), question: null };
        const pins = await Promise.all(
          content.media
            .filter((m) => m.questionId === q.id)
            .map(async (m) => {
              const asset = content.assets.find((a) => a.id === m.mediaAssetId)!;
              return { role: m.mediaRole, variant: m.variantNumber, points: m.suggestedPoints, asset: this.describe(asset), url: await this.sign(asset) };
            }),
        );
        return {
          slot,
          points: slotPoints(slot),
          question: {
            id: q.id,
            format: q.format,
            composedFormatId: q.composedFormatId,
            promptAr: q.promptAr,
            promptFranco: q.promptFranco,
            answerAr: q.answerAr,
            answerFranco: q.answerFranco,
            config: q.formatConfig,
            media: pins,
            stats: { played: stats.get(q.id)?.played ?? 0, likes: stats.get(q.id)?.likes ?? 0, dislikes: stats.get(q.id)?.dislikes ?? 0 },
          },
        };
      }),
    );
    return {
      pack: { id: pack.id, packNumber: pack.packNumber, publicationState: pack.publicationState, archived: pack.archivedAt !== null, revision: String(pack.contentRevision) },
      category,
      slots,
      issues: packIssues(content, pack.id),
      retired: await retiredQuestions(this.db, pack.id),
      formats: FORMAT_SLOTS,
      // Active formats, plus archived ones this pack's questions still use (they stay valid).
      composedFormats: content.formats
        .filter((f) => !f.archivedAt || content.questions.some((q) => q.composedFormatId === f.id))
        .concat(await this.activeFormats(content.formats.map((f) => f.id)))
        .map((f) => ({ id: f.id, ...definitionOf(f), archived: f.archivedAt !== null, slots: slotsFor("COMPOSED", definitionOf(f)) })),
      defaultStages: { 200: defaultPointStages(200), 400: defaultPointStages(400), 600: defaultPointStages(600) },
      mediaEnabled: !!this.media,
    };
  }

  // ---- sections -----------------------------------------------------------------------------

  async createSection(input: Actor & { nameAr: unknown; nameFranco: unknown }) {
    const nameAr = text(input.nameAr, "name_required", 160)!, nameFranco = text(input.nameFranco, "name_required", 160, false);
    return applyOnce(this.database, async (tx) => {
      const sectionId = randomUUID();
      await recordAudit(tx, { staffId: input.actorId, action: "content.section.create", targetKind: "section", targetKey: sectionId, requestKey: input.requestKey, details: { nameAr } });
      const [counter] = await tx.select({ next: sql<number>`coalesce(max(${categorySections.displayOrder}), 0) + 1` }).from(categorySections);
      const next = counter!.next;
      await tx.insert(categorySections).values({ id: sectionId, nameAr, nameFranco, displayOrder: next });
      return { id: sectionId };
    });
  }

  async renameSection(input: Actor & { sectionId: unknown; nameAr: unknown; nameFranco: unknown }) {
    const nameAr = text(input.nameAr, "name_required", 160)!, nameFranco = text(input.nameFranco, "name_required", 160, false);
    const sectionId = id(input.sectionId);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.section.rename", targetKind: "section", targetKey: sectionId, requestKey: input.requestKey, details: { nameAr } });
      const updated = await tx.update(categorySections).set({ nameAr, nameFranco }).where(eq(categorySections.id, sectionId)).returning({ id: categorySections.id });
      if (!updated.length) throw new ContentError("not_found", 404);
      return { id: sectionId };
    });
  }

  async moveSection(input: Actor & { sectionId: unknown; direction: unknown }) {
    const sectionId = id(input.sectionId);
    if (input.direction !== "up" && input.direction !== "down") throw new ContentError("invalid_direction");
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.section.reorder", targetKind: "section", targetKey: sectionId, requestKey: input.requestKey, details: { direction: String(input.direction) } });
      const all = await tx.select({ id: categorySections.id, displayOrder: categorySections.displayOrder }).from(categorySections).orderBy(categorySections.displayOrder, categorySections.id).for("update");
      await this.swap(all, sectionId, input.direction as string, async (rowId, order) => void (await tx.update(categorySections).set({ displayOrder: order }).where(eq(categorySections.id, rowId))));
      return { id: sectionId };
    });
  }

  /** Moves one row a step and renumbers the list 1..n, writing only the rows whose number changed. */
  private async swap(rows: { id: string; displayOrder: number }[], target: string, direction: string, write: (rowId: string, order: number) => Promise<void>, within?: (id: string) => boolean) {
    const list = within ? rows.filter((r) => within(r.id)) : rows;
    const index = list.findIndex((r) => r.id === target);
    if (index < 0) throw new ContentError("not_found", 404);
    const other = direction === "up" ? index - 1 : index + 1;
    if (other < 0 || other >= list.length) throw new ContentError("no_change", 409);
    const moved = [...rows];
    const a = moved.findIndex((r) => r.id === list[index]!.id), b = moved.findIndex((r) => r.id === list[other]!.id);
    [moved[a], moved[b]] = [moved[b]!, moved[a]!];
    for (const [position, row] of moved.entries()) if (row.displayOrder !== position + 1) await write(row.id, position + 1);
  }

  // ---- categories ---------------------------------------------------------------------------

  private categoryFields(input: { nameAr: unknown; nameFranco: unknown; descriptionAr: unknown; descriptionFranco: unknown; sectionId: unknown }) {
    return {
      nameAr: text(input.nameAr, "name_required", 160)!,
      nameFranco: text(input.nameFranco, "name_required", 160, false),
      descriptionAr: text(input.descriptionAr, "description", 500, false),
      descriptionFranco: text(input.descriptionFranco, "description", 500, false),
      sectionId: id(input.sectionId, "section_required"),
    };
  }

  async createCategory(input: Actor & { nameAr: unknown; nameFranco: unknown; descriptionAr: unknown; descriptionFranco: unknown; sectionId: unknown }) {
    const fields = this.categoryFields(input);
    return applyOnce(this.database, async (tx) => {
      const categoryId = randomUUID();
      await recordAudit(tx, { staffId: input.actorId, action: "content.category.create", targetKind: "category", targetKey: categoryId, requestKey: input.requestKey, details: { nameAr: fields.nameAr, sectionId: fields.sectionId } });
      const [section] = await tx.select({ id: categorySections.id }).from(categorySections).where(eq(categorySections.id, fields.sectionId)).limit(1);
      if (!section) throw new ContentError("section_required", 404);
      const [counter] = await tx.select({ next: sql<number>`coalesce(max(${categories.displayOrder}), 0) + 1` }).from(categories);
      const next = counter!.next;
      await tx.insert(categories).values({ id: categoryId, ...fields, displayOrder: next });
      return { id: categoryId };
    });
  }

  async updateCategory(input: Actor & { categoryId: unknown; nameAr: unknown; nameFranco: unknown; descriptionAr: unknown; descriptionFranco: unknown; sectionId: unknown }) {
    const fields = this.categoryFields(input), categoryId = id(input.categoryId);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.category.update", targetKind: "category", targetKey: categoryId, requestKey: input.requestKey, details: { nameAr: fields.nameAr, sectionId: fields.sectionId } });
      const [section] = await tx.select({ id: categorySections.id }).from(categorySections).where(eq(categorySections.id, fields.sectionId)).limit(1);
      if (!section) throw new ContentError("section_required", 404);
      const updated = await tx.update(categories).set(fields).where(eq(categories.id, categoryId)).returning({ id: categories.id });
      if (!updated.length) throw new ContentError("not_found", 404);
      return { id: categoryId };
    });
  }

  async moveCategory(input: Actor & { categoryId: unknown; direction: unknown }) {
    const categoryId = id(input.categoryId);
    if (input.direction !== "up" && input.direction !== "down") throw new ContentError("invalid_direction");
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.category.reorder", targetKind: "category", targetKey: categoryId, requestKey: input.requestKey, details: { direction: String(input.direction) } });
      // Order is global (the catalog pages by it); the move swaps with the neighbour in the same section.
      const all = await tx.select({ id: categories.id, displayOrder: categories.displayOrder, sectionId: categories.sectionId }).from(categories).orderBy(categories.displayOrder, categories.id).for("update");
      const mine = all.find((r) => r.id === categoryId);
      if (!mine) throw new ContentError("not_found", 404);
      const sameSection = new Set(all.filter((r) => r.sectionId === mine.sectionId).map((r) => r.id));
      await this.swap(all, categoryId, input.direction as string, async (rowId, order) => void (await tx.update(categories).set({ displayOrder: order }).where(eq(categories.id, rowId))), (rowId) => sameSection.has(rowId));
      return { id: categoryId };
    });
  }

  async setCategoryArchived(input: Actor & { categoryId: unknown; archived: boolean }) {
    const categoryId = id(input.categoryId);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: input.archived ? "content.category.archive" : "content.category.unarchive", targetKind: "category", targetKey: categoryId, requestKey: input.requestKey });
      const [row] = await tx.select().from(categories).where(eq(categories.id, categoryId)).limit(1).for("update");
      if (!row) throw new ContentError("not_found", 404);
      if ((row.archivedAt !== null) === input.archived) throw new ContentError("no_change", 409);
      await tx.update(categories).set({ archivedAt: input.archived ? sql`now()` : null }).where(eq(categories.id, categoryId));
      return { id: categoryId };
    });
  }

  // ---- media --------------------------------------------------------------------------------

  private async store(scope: "private" | "public", key: string, body: Buffer, contentType: string) {
    try {
      await putOnce(this.media!, scope, key, body, contentType);
    } catch {
      throw new ContentError("storage_unavailable", 502);
    }
  }

  private inspect(body: unknown, purpose: "cover" | "image" | "audio") {
    if (!this.media) throw new ContentError("media_not_configured", 503);
    if (!Buffer.isBuffer(body)) throw new ContentError("file_required");
    try {
      return inspectMedia(body, purpose);
    } catch (error) {
      if (error instanceof MediaRefusal) throw new ContentError(error.code, error.code === "file_too_large" ? 413 : 400);
      throw error;
    }
  }

  /** A question file, uploaded ahead of saving the question. It stays pending until a question uses it. */
  async uploadQuestionMedia(input: Actor & { purpose: unknown; body: unknown }) {
    if (input.purpose !== "image" && input.purpose !== "audio") throw new ContentError("invalid_purpose");
    const assetId = assetIdFor(input.requestKey);
    if (await requestKeySeen(this.db, input.requestKey)) {
      const [asset] = await this.db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
      return { replayed: true, asset: asset ? { ...this.describe(asset), url: await this.sign(asset) } : undefined };
    }
    const found = this.inspect(input.body, input.purpose);
    const body = input.body as Buffer;
    const key = `content/${assetId}.${found.extension}`;
    await this.store("private", key, body, found.contentType);
    const result = await applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.media.upload", targetKind: "media_asset", targetKey: assetId, requestKey: input.requestKey, details: { kind: found.kind, contentType: found.contentType, byteSize: body.length } });
      const [asset] = await tx
        .insert(mediaAssets)
        .values(pendingAsset(this.media!, { assetId, key, found, body, staffId: input.actorId }))
        .returning();
      return { asset: asset! };
    });
    if ("replayed" in result) return { replayed: true, asset: undefined };
    return { asset: { ...this.describe(result.asset), url: await this.sign(result.asset) } };
  }

  /** The public poster of a category; the file is public artwork, never question media. */
  async uploadCover(input: Actor & { categoryId: unknown; body: unknown }) {
    const categoryId = id(input.categoryId);
    const found = this.inspect(input.body, "cover");
    const body = input.body as Buffer;
    const assetId = assetIdFor(input.requestKey);
    if (await requestKeySeen(this.db, input.requestKey)) return { replayed: true };
    const key = `covers/${assetId}.${found.extension}`;
    await this.store("public", key, body, found.contentType);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.category.cover", targetKind: "category", targetKey: categoryId, requestKey: input.requestKey, details: { assetId, byteSize: body.length } });
      const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1).for("update");
      if (!category) throw new ContentError("not_found", 404);
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
      await tx.update(categories).set({ coverMediaAssetId: assetId }).where(eq(categories.id, categoryId));
      return { id: categoryId };
    });
  }

  // ---- packs --------------------------------------------------------------------------------

  async createPack(input: Actor & { categoryId: unknown }) {
    const categoryId = id(input.categoryId);
    return applyOnce(this.database, async (tx) => {
      const packId = randomUUID();
      await recordAudit(tx, { staffId: input.actorId, action: "content.pack.create", targetKind: "pack", targetKey: packId, requestKey: input.requestKey, details: { categoryId } });
      const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1).for("update");
      if (!category) throw new ContentError("not_found", 404);
      const [counter] = await tx.select({ next: sql<number>`coalesce(max(${questionPacks.packNumber}), 0) + 1` }).from(questionPacks).where(eq(questionPacks.categoryId, categoryId));
      const next = counter!.next;
      await tx.insert(questionPacks).values({ id: packId, categoryId, packNumber: next });
      return { id: packId, packNumber: next };
    });
  }

  private async lockPack(tx: SahsahDatabase, packId: string) {
    const [pack] = await tx.select().from(questionPacks).where(eq(questionPacks.id, packId)).limit(1).for("update");
    if (!pack) throw new ContentError("not_found", 404);
    return pack;
  }

  /** Full validation under the pack lock; a published pack never ends up half-edited. */
  private async requireValid(tx: SahsahDatabase, packId: string) {
    const issues = packIssues(await loadPackContent(tx, [packId]), packId);
    if (issues.length) throw new ContentError("pack_incomplete", 409, issues);
  }

  async publishPack(input: Actor & { packId: unknown }) {
    const packId = id(input.packId);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.pack.publish", targetKind: "pack", targetKey: packId, requestKey: input.requestKey });
      const pack = await this.lockPack(tx, packId);
      if (pack.archivedAt) throw new ContentError("pack_archived", 409);
      if (pack.publicationState === "published") throw new ContentError("no_change", 409);
      await this.requireValid(tx, packId);
      await tx.update(questionPacks).set({ publicationState: "published", contentRevision: sql`${questionPacks.contentRevision} + 1`, updatedAt: sql`now()` }).where(eq(questionPacks.id, packId));
      return { id: packId };
    });
  }

  async setPackArchived(input: Actor & { packId: unknown; archived: boolean }) {
    const packId = id(input.packId);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: input.archived ? "content.pack.archive" : "content.pack.unarchive", targetKind: "pack", targetKey: packId, requestKey: input.requestKey });
      const pack = await this.lockPack(tx, packId);
      if ((pack.archivedAt !== null) === input.archived) throw new ContentError("no_change", 409);
      // Restoring a published pack re-checks that it is still playable.
      if (!input.archived && pack.publicationState === "published") await this.requireValid(tx, packId);
      await tx.update(questionPacks).set({ archivedAt: input.archived ? sql`now()` : null, contentRevision: sql`${questionPacks.contentRevision} + 1`, updatedAt: sql`now()` }).where(eq(questionPacks.id, packId));
      return { id: packId };
    });
  }

  // ---- questions ----------------------------------------------------------------------------

  /**
   * One atomic save of a slot. `edit` corrects the current question in place (same logical question,
   * seen history kept); `replace` retires it and puts a new logical question in the slot; `create` fills an empty slot.
   */
  async saveQuestion(
    input: Actor & {
      packId: unknown;
      slot: unknown;
      mode: unknown;
      questionId: unknown;
      format: unknown;
      composedFormatId?: unknown;
      promptAr: unknown;
      promptFranco: unknown;
      answerAr: unknown;
      answerFranco: unknown;
      config: unknown;
      media: unknown;
      confirmPublicEdit: unknown;
    },
  ) {
    const packId = id(input.packId), slot = Number(input.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 6) throw new ContentError("invalid_slot");
    if (input.mode !== "create" && input.mode !== "edit" && input.mode !== "replace") throw new ContentError("invalid_mode");
    const mode: string = input.mode;
    if (typeof input.format !== "string" || !FORMATS.includes(input.format)) throw new ContentError("invalid_format");
    const format = input.format as keyof typeof FORMAT_SLOTS;
    const fields = {
      promptAr: text(input.promptAr, "prompt_required", 4000)!,
      promptFranco: text(input.promptFranco, "prompt_required", 4000, false),
      answerAr: text(input.answerAr, "answer_required", 4000)!,
      answerFranco: text(input.answerFranco, "answer_required", 4000, false),
    };
    const config = cleanConfig(format, input.config);
    const composedFormatId = format === "COMPOSED" ? id(input.composedFormatId, "format_required") : null;
    if (format !== "COMPOSED" && input.composedFormatId) throw new ContentError("invalid_format");
    const rawItems = Array.isArray(input.media) ? (input.media as Record<string, unknown>[]) : [];

    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: `content.question.${mode}`, targetKind: "pack", targetKey: packId, requestKey: input.requestKey, details: { slot, format, mode, ...(composedFormatId ? { composedFormatId } : {}) } });
      let composed: ComposedDefinition | undefined;
      if (composedFormatId) {
        const [row] = await tx.select().from(questionFormats).where(eq(questionFormats.id, composedFormatId)).limit(1).for("share");
        if (!row) throw new ContentError("format_required", 404);
        composed = definitionOf(row);
        // An archived format cannot start new questions; the question that already uses it may still be corrected.
        if (row.archivedAt) {
          const [same] = await tx.select({ id: questions.id }).from(questions).where(and(eq(questions.id, String(input.questionId)), eq(questions.composedFormatId, row.id), isNull(questions.retiredAt))).limit(1);
          if (!same || mode !== "edit") throw new ContentError("format_archived", 409);
        }
      }
      const specs = slotsFor(format, composed);
      const items: MediaItem[] = [];
      for (const item of rawItems) {
        const spec = specs.find((s) => s.key === item?.key);
        // The forward clip of a reverse question is derived from its source; everything else is uploaded.
        if (!spec || (spec.role === "answer_audio" && format !== "COMPOSED")) throw new ContentError("invalid_media");
        if (items.some((i) => i.key === spec.key)) throw new ContentError("invalid_media");
        let points: number | undefined;
        if (spec.points) {
          points = Number(item.points);
          if (!Number.isInteger(points) || points < 1 || points > 600) throw new ContentError("points_required");
        }
        items.push({ key: spec.key, assetId: id(item.assetId, "invalid_media"), points });
      }
      const pack = await this.lockPack(tx, packId);
      if (pack.publicationState === "published" && input.confirmPublicEdit !== true) throw new ContentError("public_edit_confirmation_required", 409);
      const [current] = await tx.select().from(questions).where(and(eq(questions.packId, packId), eq(questions.slotNumber, slot), isNull(questions.retiredAt))).limit(1).for("update");
      let questionId: string;
      if (mode === "create") {
        if (current) throw new ContentError("slot_occupied", 409);
        questionId = randomUUID();
      } else {
        if (!current || current.id !== input.questionId) throw new ContentError("question_changed", 409);
        if (mode === "edit" && (current.format !== format || current.composedFormatId !== composedFormatId)) throw new ContentError("format_change_needs_replacement", 409);
        questionId = mode === "edit" ? current.id : randomUUID();
      }
      if (mode === "replace") await tx.update(questions).set({ retiredAt: sql`now()` }).where(eq(questions.id, current!.id));
      if (mode === "edit") await tx.update(questions).set({ ...fields, formatConfig: config }).where(eq(questions.id, questionId));
      else await tx.insert(questions).values({ id: questionId, packId, slotNumber: slot, format, composedFormatId, formatConfig: config, ...fields });
      await this.attachMedia(tx, questionId, format, items, config, specs);
      await tx.update(questionPacks).set({ contentRevision: sql`${questionPacks.contentRevision} + 1`, updatedAt: sql`now()` }).where(eq(questionPacks.id, packId));
      if (pack.publicationState === "published") await this.requireValid(tx, packId);
      return { id: questionId };
    });
  }

  /** Writes the question's files; a pending upload becomes ready here, with its lineage when it is a derived slot. */
  /** Also used by the bulk import, so imported questions follow exactly the editor's lineage rules. */
  async attachMedia(tx: SahsahDatabase, questionId: string, format: keyof typeof FORMAT_SLOTS, items: MediaItem[], config: JsonObject, specs: SlotSpec[]) {
    const ids = [...new Set(items.map((i) => i.assetId))];
    const assets = ids.length ? await tx.select().from(mediaAssets).where(inArray(mediaAssets.id, ids)).for("update") : [];
    const pins: { role: (typeof specs)[number]["role"]; variant: number; assetId: string; points: number | null }[] = [];
    for (const item of items) {
      const spec = specs.find((s) => s.key === item.key)!;
      const asset = assets.find((a) => a.id === item.assetId);
      if (!asset || asset.accessScope !== "private" || asset.state === "failed" || asset.mediaKind !== spec.kind) throw new ContentError("invalid_media");
      pins.push({ role: spec.role, variant: spec.variant, assetId: asset.id, points: item.points ?? null });
    }
    if (format === "AUDIO_REVERSE" && config.allowForward === true) {
      const source = pins.find((p) => p.role === "source_audio");
      // The forward answer clip is the forward source itself.
      if (source) pins.push({ role: "answer_audio", variant: 0, assetId: source.assetId, points: null });
    }
    const originalRole = format.startsWith("AUDIO_") ? "source_audio" : "answer_image";
    const originalId = pins.find((p) => p.role === originalRole)?.assetId;
    for (const spec of specs) {
      const pin = pins.find((p) => p.role === spec.role && p.variant === spec.variant);
      const asset = pin && assets.find((a) => a.id === pin.assetId);
      if (!pin || !asset || asset.state !== "pending") continue;
      if (spec.derive && !originalId) throw new ContentError("original_required", 409);
      await tx
        .update(mediaAssets)
        .set({
          state: "ready",
          readyAt: sql`now()` as unknown as string,
          ...(spec.derive ? { sourceAssetId: originalId, transformSpec: { operation: spec.derive.operation, stageIndex: spec.variant } } : {}),
        })
        .where(eq(mediaAssets.id, asset.id));
    }
    await tx.delete(questionMedia).where(eq(questionMedia.questionId, questionId));
    if (pins.length)
      await tx.insert(questionMedia).values(pins.map((p) => ({ questionId, mediaRole: p.role, variantNumber: p.variant, mediaAssetId: p.assetId, suggestedPoints: p.points })));
  }

  async retireQuestion(input: Actor & { packId: unknown; slot: unknown; questionId: unknown }) {
    const packId = id(input.packId), slot = Number(input.slot);
    return applyOnce(this.database, async (tx) => {
      await recordAudit(tx, { staffId: input.actorId, action: "content.question.retire", targetKind: "pack", targetKey: packId, requestKey: input.requestKey, details: { slot } });
      const pack = await this.lockPack(tx, packId);
      // A public pack must stay complete: replace the question instead.
      if (pack.publicationState === "published") throw new ContentError("pack_public", 409);
      const retired = await tx
        .update(questions)
        .set({ retiredAt: sql`now()` })
        .where(and(eq(questions.id, id(input.questionId)), eq(questions.packId, packId), eq(questions.slotNumber, slot), isNull(questions.retiredAt)))
        .returning({ id: questions.id });
      if (!retired.length) throw new ContentError("question_changed", 409);
      await tx.update(questionPacks).set({ contentRevision: sql`${questionPacks.contentRevision} + 1`, updatedAt: sql`now()` }).where(eq(questionPacks.id, packId));
      return { id: packId };
    });
  }
}

