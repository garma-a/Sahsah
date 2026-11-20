import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/connection.js";
import { categories, mediaAssets, questionFormats, questionPacks, questions, staffAuditEvents } from "../../database/schema/index.js";
import { FORMAT_SLOTS, slotsFor } from "../../gameplay/games/rules/question-content.js";
import { applyOnce, recordAudit, requestKeySeen } from "../audit.js";
import { log } from "../../gameplay/platform/logging.js";
import { analyzeZip, derivedId, IMPORT_LIMITS, templateFor, type FormatChoice, type Plan, type Report } from "./import.js";
import { ContentError, definitionOf, pendingAsset, type ContentService } from "./service.js";
import { putOnce, type AdminMedia } from "./storage.js";
import { openZip, OpenZip, ZIP_LIMITS, ZipRefusal } from "./zip.js";

const UUID = /^[0-9a-f-]{36}$/;
const MAX_STAGED = 20;
const UPLOAD_CONCURRENCY = 4;

type Manifest = { staffId: string; sessionId: string; categoryId: string; expiresAt: number };
type Options = { secret: string; dir?: string; ttlMs?: number; previewPath: string };

/**
 * Bulk import of draft packs from one ZIP (ADR 0022). A ZIP is first staged in a private temporary
 * directory and checked without writing anything; the import then re-checks the staged ZIP, uploads
 * its files and writes the drafts in one transaction. Staged ZIPs expire and are always removed.
 */
export class ImportService {
  private readonly root: string;
  private readonly ttl: number;

  constructor(
    private readonly database: DatabaseConnection,
    private readonly content: ContentService,
    private readonly media: AdminMedia | undefined,
    private readonly options: Options,
  ) {
    this.root = path.join(options.dir ?? os.tmpdir(), "sahsah-import");
    this.ttl = options.ttlMs ?? 20 * 60 * 1000;
    void this.sweep();
    setInterval(() => void this.sweep(), 5 * 60 * 1000).unref();
  }

  private get db() {
    return this.database.db;
  }

  private dir(id: string) {
    return path.join(this.root, id);
  }

  /** Removes expired or unreadable staged uploads. */
  async sweep() {
    try {
      for (const name of await readdir(this.root)) {
        const manifest = await this.manifest(name).catch(() => undefined);
        const age = Date.now() - (await stat(this.dir(name)).catch(() => ({ mtimeMs: 0 }))).mtimeMs;
        if ((manifest && manifest.expiresAt <= Date.now()) || (!manifest && age > this.ttl)) await rm(this.dir(name), { recursive: true, force: true });
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") log.warn("admin.import", { code: "SWEEP_FAILED" });
    }
  }

  private async manifest(id: string): Promise<Manifest | undefined> {
    if (!UUID.test(id)) return undefined;
    return JSON.parse(await readFile(path.join(this.dir(id), "manifest.json"), "utf8")) as Manifest;
  }

  /** The staged upload, only for the staff member and session that made it. */
  private async staged(id: unknown, actorId: string, sessionId: string) {
    const manifest = typeof id === "string" ? await this.manifest(id).catch(() => undefined) : undefined;
    if (!manifest || manifest.staffId !== actorId || manifest.sessionId !== sessionId) throw new ContentError("import_expired", 410);
    if (manifest.expiresAt <= Date.now()) {
      await rm(this.dir(id as string), { recursive: true, force: true });
      throw new ContentError("import_expired", 410);
    }
    return { id: id as string, manifest, file: path.join(this.dir(id as string), "upload.zip") };
  }

  private sign(id: string, name: string, type: string, exp: number) {
    return createHmac("sha256", this.options.secret).update(`import-preview\n${id}\n${name}\n${type}\n${exp}`).digest("hex");
  }

  private previewUrl(id: string, exp: number) {
    return (name: string, type: string) => `${this.options.previewPath}/${id}?${new URLSearchParams({ f: name, t: type, exp: String(exp), sig: this.sign(id, name, type, exp) })}`;
  }

  // ---- templates ----------------------------------------------------------------------------

  async choice(code: unknown): Promise<FormatChoice> {
    const value = typeof code === "string" ? code.trim() : "";
    const built = value.toUpperCase();
    if (built !== "COMPOSED" && built in FORMAT_SLOTS) return { format: built as keyof typeof FORMAT_SLOTS };
    const [row] = await this.db.select().from(questionFormats).where(eq(questionFormats.code, value.toLowerCase())).limit(1);
    if (!row) throw new ContentError("unknown_format", 404);
    if (row.archivedAt) throw new ContentError("format_archived", 409);
    return { format: "COMPOSED", composed: row };
  }

  async template(code: unknown) {
    const { filename, csv, columns } = templateFor(await this.choice(code));
    return { filename, csv, columns };
  }

  async choices(categoryId: unknown) {
    const detail = await this.content.category(categoryId);
    const formats = await this.content.formats.list();
    return {
      category: { id: detail.category.id, nameAr: detail.category.nameAr, archived: detail.category.archived },
      builtIn: formats.builtIn.map((f) => ({ code: f.code, description: f.description })),
      composed: formats.composed.filter((f) => !f.archived).map((f) => ({ code: f.code, name: f.nameEn })),
      mediaEnabled: !!this.media,
      limits: { zipMegabytes: ZIP_LIMITS.zipBytes / 1048576, rows: IMPORT_LIMITS.rows, packs: IMPORT_LIMITS.rows / 6, entries: ZIP_LIMITS.entries },
    };
  }

  // ---- dry run ------------------------------------------------------------------------------

  /** Stages the ZIP and reports what an import would do. Writes nothing to the database or storage. */
  async check(input: { actorId: string; sessionId: string; categoryId: unknown; file: { path: string; size: number } | undefined }) {
    const file = input.file;
    if (!file) throw new ContentError("file_required");
    let stagedDir: string | undefined;
    try {
      const [category] = await this.db.select({ id: categories.id, nameAr: categories.nameAr, archivedAt: categories.archivedAt }).from(categories).where(eq(categories.id, UUID.test(String(input.categoryId)) ? String(input.categoryId) : "00000000-0000-0000-0000-000000000000")).limit(1);
      if (!category) throw new ContentError("not_found", 404);
      if (category.archivedAt) throw new ContentError("category_archived", 409);
      if (file.size > ZIP_LIMITS.zipBytes) throw new ContentError("file_too_large", 413);

      await this.sweep();
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      // One staged upload per staff member: a new check replaces their previous one.
      for (const name of await readdir(this.root)) {
        const old = await this.manifest(name).catch(() => undefined);
        if (old?.staffId === input.actorId) await rm(this.dir(name), { recursive: true, force: true });
      }
      if ((await readdir(this.root)).length >= MAX_STAGED) throw new ContentError("too_many_imports", 429);

      const id = randomUUID();
      stagedDir = this.dir(id);
      await mkdir(stagedDir, { mode: 0o700 });
      const zipPath = path.join(stagedDir, "upload.zip");
      await rename(file.path, zipPath).catch(async () => {
        await copyFile(file.path, zipPath);
        await rm(file.path, { force: true });
      });
      const expiresAt = Date.now() + this.ttl;
      const zip = await this.open(zipPath);
      try {
        const { report } = await analyzeZip({ zip, db: this.db, storageConfigured: !!this.media, storageProvider: this.media?.provider, previewUrl: this.previewUrl(id, expiresAt) });
        await writeFile(path.join(stagedDir, "manifest.json"), JSON.stringify({ staffId: input.actorId, sessionId: input.sessionId, categoryId: category.id, expiresAt } satisfies Manifest));
        return { id, expiresAt: new Date(expiresAt).toISOString(), category: { id: category.id, nameAr: category.nameAr }, ...report };
      } catch (error) {
        throw error instanceof ZipRefusal ? new ContentError(error.code) : error;
      } finally {
        zip.close();
      }
    } catch (error) {
      if (stagedDir) await rm(stagedDir, { recursive: true, force: true });
      throw error;
    } finally {
      // The multipart file is gone after the rename; this covers every refusal before it.
      await rm(file.path, { force: true });
    }
  }

  private async open(file: string): Promise<OpenZip> {
    try {
      return await openZip(file);
    } catch (error) {
      if (error instanceof ZipRefusal) throw new ContentError(error.code);
      throw error;
    }
  }

  // ---- import -------------------------------------------------------------------------------

  private async priorResult(requestKey: string) {
    const [event] = await this.db.select({ details: staffAuditEvents.details }).from(staffAuditEvents).where(eq(staffAuditEvents.requestKey, requestKey)).limit(1);
    const details = (event?.details ?? {}) as { packs?: unknown };
    return { replayed: true as const, packs: Array.isArray(details.packs) ? details.packs : [] };
  }

  /** Imports the staged ZIP as draft packs. Never publishes. */
  async run(input: { actorId: string; sessionId: string; requestKey: string; id: unknown }) {
    // A retry after the import committed finds the audit row and never touches the staged files.
    if (await requestKeySeen(this.db, input.requestKey)) return this.priorResult(input.requestKey);
    const staged = await this.staged(input.id, input.actorId, input.sessionId);
    const zip = await this.open(staged.file);
    try {
      const { report, plan } = await analyzeZip({ zip, db: this.db, storageConfigured: !!this.media, storageProvider: this.media?.provider }).catch((e) => {
        throw e instanceof ZipRefusal ? new ContentError(e.code) : e;
      });
      if (!report.canImport) throw new ContentError("import_has_errors", 409);
      const result = await this.write(zip, plan, report, staged.manifest.categoryId, input.actorId, input.requestKey);
      await rm(this.dir(staged.id), { recursive: true, force: true });
      return result;
    } catch (error) {
      // A concurrent attempt with the same key may have finished while this one failed.
      if (await requestKeySeen(this.db, input.requestKey)) return this.priorResult(input.requestKey);
      throw error;
    } finally {
      zip.close();
    }
  }

  private async write(zip: OpenZip, plan: Plan, report: Report, categoryId: string, actorId: string, requestKey: string) {
    // Every file gets its own stored object and file row, derived from the key, so a retry rewrites the same ones.
    type Upload = { assetId: string; key: string; name: string; found: Plan["packs"][number]["rows"][number]["files"][number]["found"] };
    const uploads: Upload[] = [];
    const idOf = new Map<string, string>();
    plan.packs.forEach((pack, p) =>
      pack.rows.forEach((row) =>
        row.files.forEach((file) => {
          const assetId = derivedId(requestKey, "asset", p, row.slot, file.spec.key);
          idOf.set(`${p}:${row.slot}:${file.spec.key}`, assetId);
          uploads.push({ assetId, key: `content/${assetId}.${file.found.extension}`, name: file.entry, found: file.found });
        }),
      ),
    );
    if (uploads.length && !this.media) throw new ContentError("media_not_configured", 503);
    const assetRows: ReturnType<typeof pendingAsset>[] = [];
    let next = 0;
    const worker = async () => {
      // One file in memory per worker; objects are written before the transaction and never replaced.
      while (next < uploads.length) {
        const upload = uploads[next++]!;
        const body = await zip.read(upload.name, ZIP_LIMITS.entryBytes).catch(() => {
          throw new ContentError("import_has_errors", 409);
        });
        try {
          await putOnce(this.media!, "private", upload.key, body, upload.found.contentType);
        } catch {
          throw new ContentError("storage_unavailable", 502);
        }
        assetRows.push(pendingAsset(this.media!, { assetId: upload.assetId, key: upload.key, found: upload.found, body, staffId: actorId }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploads.length) }, worker));

    const packIds = plan.packs.map((_, p) => derivedId(requestKey, "pack", p));
    const questionCount = plan.packs.reduce((n, p) => n + p.rows.length, 0);
    const formatCounts: Record<string, number> = {};
    for (const pack of plan.packs) for (const row of pack.rows) formatCounts[row.composed?.code ?? row.format] = (formatCounts[row.composed?.code ?? row.format] ?? 0) + 1;
    const composedIds = [...new Set(plan.packs.flatMap((p) => p.rows.flatMap((r) => (r.composed ? [r.composed.id] : []))))];

    const done = await applyOnce(this.database, async (tx) => {
      const [category] = await tx.select().from(categories).where(eq(categories.id, categoryId)).limit(1).for("update");
      if (!category) throw new ContentError("not_found", 404);
      if (category.archivedAt) throw new ContentError("category_archived", 409);
      const [first] = await tx.select({ next: sql<number>`coalesce(max(${questionPacks.packNumber}), 0) + 1` }).from(questionPacks).where(eq(questionPacks.categoryId, categoryId));
      const start = first!.next;
      const summary = plan.packs.map((pack, p) => ({ id: packIds[p]!, packNumber: start + p, label: pack.label }));
      await recordAudit(tx, {
        staffId: actorId,
        action: "content.import",
        targetKind: "category",
        targetKey: categoryId,
        requestKey,
        details: { packs: summary, packCount: plan.packs.length, questions: questionCount, files: uploads.length, formats: formatCounts },
      });
      // A format archived or reshaped since the check would make the questions invalid; stop instead.
      if (composedIds.length) {
        const rows = await tx.select().from(questionFormats).where(inArray(questionFormats.id, composedIds)).for("share");
        for (const row of rows) {
          const planned = plan.packs.flatMap((p) => p.rows).find((r) => r.composed?.id === row.id)!.composed!;
          if (row.archivedAt) throw new ContentError("format_archived", 409);
          if (JSON.stringify(definitionOf(row)) !== JSON.stringify(definitionOf(planned))) throw new ContentError("import_has_errors", 409);
        }
      }
      for (let i = 0; i < assetRows.length; i += 200) await tx.insert(mediaAssets).values(assetRows.slice(i, i + 200));
      for (const [p, pack] of plan.packs.entries()) {
        await tx.insert(questionPacks).values({ id: packIds[p]!, categoryId, packNumber: start + p });
        await recordAudit(tx, { staffId: actorId, action: "content.pack.create", targetKind: "pack", targetKey: packIds[p]!, requestKey: derivedId(requestKey, "pack-audit", p), details: { categoryId, import: true, label: pack.label, questions: pack.rows.length } });
        for (const row of pack.rows) {
          const questionId = derivedId(requestKey, "question", p, row.slot);
          await tx.insert(questions).values({ id: questionId, packId: packIds[p]!, slotNumber: row.slot, format: row.format, composedFormatId: row.composed?.id ?? null, formatConfig: row.config, ...row.fields });
          const items = row.files.map((f) => ({ key: f.spec.key, assetId: idOf.get(`${p}:${row.slot}:${f.spec.key}`)!, points: f.points }));
          await this.content.attachMedia(tx, questionId, row.format, items, row.config, slotsFor(row.format, row.composed && definitionOf(row.composed)));
        }
      }
      return { packs: summary, questions: questionCount, files: uploads.length };
    });
    if ("replayed" in done) return this.priorResult(requestKey);
    log.info("admin.import", { code: "IMPORTED", count: questionCount });
    return { ...done, summary: report.summary };
  }

  // ---- preview of staged files --------------------------------------------------------------

  /** Serves one staged file behind a signed, expiring link made for the report. */
  readonly preview = async (req: Request, res: Response) => {
    const id = String(req.params.id ?? ""), name = String(req.query.f ?? ""), type = String(req.query.t ?? ""), exp = Number(req.query.exp), sig = String(req.query.sig ?? "");
    const allowed = ["image/png", "image/jpeg", "image/webp", "audio/mpeg"];
    const expected = Buffer.from(this.sign(id, name, type, exp));
    const given = Buffer.from(sig);
    if (!UUID.test(id) || !allowed.includes(type) || !(exp > Date.now()) || given.length !== expected.length || !timingSafeEqual(given, expected)) return void res.status(404).end();
    let zip: OpenZip | undefined;
    try {
      const manifest = await this.manifest(id);
      if (!manifest || manifest.expiresAt <= Date.now()) return void res.status(404).end();
      zip = await openZip(path.join(this.dir(id), "upload.zip"));
      if (!zip.has(name)) return void res.status(404).end();
      const stream = await zip.stream(name);
      res.set({ "Content-Type": type, "Content-Length": String(zip.size(name)), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
      const open = zip;
      stream.on("error", () => res.destroy());
      res.on("close", () => open.close());
      stream.pipe(res);
      zip = undefined;
    } catch {
      if (!res.headersSent) res.status(404).end();
    } finally {
      zip?.close();
    }
  };
}
