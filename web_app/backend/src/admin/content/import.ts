import { createHash } from "node:crypto";
import { questionFormats } from "../../database/schema/index.js";
import type { SahsahDatabase } from "../../database/connection.js";
import type { JsonObject } from "../../database/schema/types.js";
import type { ComposedDefinition } from "../../gameplay/games/rules/composed-format.js";
import { FORMAT_SLOTS, questionContentIssues, slotsFor, type SlotSpec } from "../../gameplay/games/rules/question-content.js";
import { CsvError, csvLine, decodeUtf8, parseCsv } from "./csv.js";
import { inspectMedia, MediaRefusal, type Inspected } from "./inspect.js";
import { cleanConfig, ContentError, definitionOf } from "./service.js";
import { ZIP_LIMITS, ZipRefusal, type OpenZip } from "./zip.js";

type Format = keyof typeof FORMAT_SLOTS;
type FormatRow = typeof questionFormats.$inferSelect;

export const IMPORT_LIMITS = { rows: 600, packLabel: 80, fileName: 200 } as const;
export const BASE_COLUMNS = ["pack", "slot", "format", "prompt_ar", "answer_ar", "prompt_franco", "answer_franco"] as const;
const REQUIRED_COLUMNS = ["pack", "slot", "format", "prompt_ar", "answer_ar"];

/** Settings a format reads, as CSV columns. The key is what the editor stores. */
const CONFIG_COLUMNS: Partial<Record<Format, { column: string; key: string; example: string; help: string }[]>> = {
  IMAGE_MEMORY: [
    { column: "instruction_ar", key: "instructionAr", example: "احفظ أكبر عدد من الأشياء", help: "Arabic instruction shown with the scene (optional)." },
    { column: "instruction_franco", key: "instructionFranco", example: "", help: "Franco instruction (optional)." },
  ],
  AUDIO_VOICE: [
    { column: "hint_ar", key: "hintAr", example: "", help: "Arabic hint line (optional)." },
    { column: "hint_franco", key: "hintFranco", example: "", help: "Franco hint line (optional)." },
  ],
  AUDIO_REVERSE: [{ column: "allow_forward", key: "allowForward", example: "no", help: "yes to let the host play the forward clip on reveal; otherwise no or empty." }],
  IMAGE_COLOR: [{ column: "color_hex", key: "colorHex", example: "#e7a72b", help: "Accent colour such as #e7a72b (optional)." }],
};
const configColumns = (format: Format) => CONFIG_COLUMNS[format] ?? [];

/** The forward clip of a reverse question is its own source file, so the editor offers no upload for it. */
const uploadSlots = (format: Format, composed?: ComposedDefinition): SlotSpec[] => slotsFor(format, composed).filter((s) => format === "COMPOSED" || s.role !== "answer_audio");
const fileColumn = (spec: SlotSpec) => `${spec.key}_file`;
const pointsColumn = (spec: SlotSpec) => `${spec.key}_points`;

/** Every column any format may use; a header cell outside this set is a typo. */
const KNOWN_COLUMNS = new Set<string>([...BASE_COLUMNS, ...Object.values(CONFIG_COLUMNS).flatMap((list) => list!.map((c) => c.column))]);
for (const format of Object.keys(FORMAT_SLOTS) as Format[])
  for (const spec of uploadSlots(format)) {
    KNOWN_COLUMNS.add(fileColumn(spec));
    if (spec.points) KNOWN_COLUMNS.add(pointsColumn(spec));
  }
for (const key of ["base", "hint0", "hint1", "hint2", "answer"]) KNOWN_COLUMNS.add(`${key}_file`);
for (const key of ["hint0", "hint1", "hint2"]) KNOWN_COLUMNS.add(`${key}_points`);

// ---- messages ---------------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  csv_missing: "The ZIP has no pack.csv. Put pack.csv next to the media files.",
  csv_multiple: "The ZIP has more than one pack.csv. Keep only one.",
  csv_encoding: "pack.csv is not UTF-8. In Excel choose Save as, then CSV UTF-8 (Comma delimited).",
  csv_too_large: "pack.csv is larger than 2 MB.",
  csv_stray_quote: "pack.csv has a quote in the wrong place. Put a whole cell in quotes and write a quote inside it as two quotes.",
  csv_unterminated_quote: "pack.csv has a quote that is never closed.",
  csv_delimiter: "pack.csv must use commas, not semicolons. Save it as CSV UTF-8 (Comma delimited).",
  csv_empty: "pack.csv has no header row.",
  no_rows: "pack.csv has a header but no question rows.",
  too_many_rows: `pack.csv has more than ${IMPORT_LIMITS.rows} question rows. Split it into several ZIPs.`,
  duplicate_column: "A column appears twice in the header.",
  unknown_column: "This column is not one Sahsah knows. Check the spelling against the template.",
  missing_column: "A required column is missing from the header.",
  row_shape: "This row has a different number of cells than the header.",
  pack_missing: "The pack label is empty.",
  pack_label_too_long: `A pack label can be at most ${IMPORT_LIMITS.packLabel} characters.`,
  invalid_slot: "The slot must be a whole number from 1 to 6.",
  duplicate_slot: "This pack already has a row for this slot.",
  wrong_row_count: "Each pack needs exactly six rows, one for each slot 1 to 6.",
  unknown_format: "Unknown format. Use a built-in code such as IMAGE_BLUR or the code of a composed format from the Formats tab.",
  format_archived: "That format is archived. Restore it in the Formats tab or choose another.",
  column_not_used: "This format does not use this column; leave the cell empty.",
  invalid_boolean: "Use yes or no.",
  invalid_config: "A format setting is not valid (a colour must look like #aabbcc, and text is limited in length).",
  prompt_missing: "The Arabic question text is empty.",
  answer_missing: "The Arabic answer is empty.",
  text_too_long: "Question and answer text can be at most 4000 characters.",
  bad_file_name: "Write only a file name that is in the ZIP next to pack.csv, with no folders.",
  missing_file: "This file is not in the ZIP. File names must match exactly, including capitals.",
  unused_file: "This file is in the ZIP but no row uses it. Remove it or reference it.",
  outside_folder: "This file is not in the same folder as pack.csv, so it cannot be used.",
  points_required: "Enter suggested points between 1 and 600 for this stage.",
  points_without_file: "Points were given but there is no file for this stage.",
  config_invalid: "Suggested points must start at the slot's tile value (or, for clue and composed formats, below it) and keep decreasing.",
  storage_not_configured: "File storage is not set up on this service, so files cannot be imported.",
  unsupported_image: "Use a PNG, JPEG or WebP picture.",
  unsupported_audio: "Use an MP3 audio file.",
  corrupt_image: "That picture could not be read.",
  corrupt_audio: "That audio file could not be read.",
  image_dimensions: "The picture is too small or too large (32 to 8192 pixels per side).",
  audio_too_long: "Audio can be at most 10 minutes.",
  file_too_large: "That file is too large (pictures up to 10 MB, audio up to 25 MB).",
  empty_file: "That file is empty.",
  zip_entry_unreadable: "That file inside the ZIP could not be read. Re-create the ZIP.",
  zip_encrypted: "The ZIP is password-protected. Upload one without a password.",
  category_archived: "This category is archived. Restore it before importing.",
  lineage: "This file cannot be derived from the original in this row. Give the original too.",
};
const messageFor = (code: string) => MESSAGES[code] ?? "This is not valid.";

// ---- template ---------------------------------------------------------------------------------

export type FormatChoice = { format: Format; composed?: FormatRow };

type Column = { name: string; required: boolean; help: string };

/** Columns for one format, with a description each: everything comes from the format's own slot list. */
export function columnsFor(choice: FormatChoice): Column[] {
  const composed = choice.composed && definitionOf(choice.composed);
  const columns: Column[] = [
    { name: "pack", required: true, help: "A label that groups the six rows of one pack. Any text, up to 80 characters." },
    { name: "slot", required: true, help: "Slot 1 to 6. Slots 1-2 are worth 200, 3-4 are 400, 5-6 are 600." },
    { name: "format", required: true, help: "The format code for this row." },
    { name: "prompt_ar", required: true, help: "Arabic question text." },
    { name: "answer_ar", required: true, help: "Arabic answer." },
    { name: "prompt_franco", required: false, help: "Franco question text (optional)." },
    { name: "answer_franco", required: false, help: "Franco answer (optional)." },
  ];
  for (const c of configColumns(choice.format)) columns.push({ name: c.column, required: false, help: c.help });
  for (const spec of uploadSlots(choice.format, composed)) {
    columns.push({ name: fileColumn(spec), required: spec.required === true, help: `${spec.label}: the name of the ${spec.kind === "audio" ? "MP3" : "PNG, JPEG or WebP"} file in the ZIP${spec.required === true ? "" : " (optional)"}.` });
    if (spec.points) columns.push({ name: pointsColumn(spec), required: spec.required === true, help: `Suggested points for ${spec.label.toLowerCase()}, falling from stage to stage.` });
  }
  return columns;
}

export function templateFor(choice: FormatChoice) {
  const composed = choice.composed && definitionOf(choice.composed);
  const code = choice.composed ? choice.composed.code : choice.format;
  const columns = columnsFor(choice);
  const values: Record<string, string> = {
    pack: "Example pack",
    slot: "1",
    format: code,
    prompt_ar: "ما هي عاصمة مصر؟",
    answer_ar: "القاهرة",
    prompt_franco: "Ma heya 3asmet masr?",
    answer_franco: "El Qahera",
  };
  for (const c of configColumns(choice.format)) values[c.column] = c.example;
  // Blur and zoom stages start at the slot's tile value; clue and composed stages start below it.
  const stagePoints = choice.format === "IMAGE_BLUR" || choice.format === "IMAGE_ZOOM" ? [200, 150, 50] : [150, 100, 50, 25];
  let hint = 0;
  for (const spec of uploadSlots(choice.format, composed)) {
    values[fileColumn(spec)] = `q1_${spec.key}.${spec.kind === "audio" ? "mp3" : "png"}`;
    if (spec.points) values[pointsColumn(spec)] = String(stagePoints[hint++] ?? 25);
  }
  const names = columns.map((c) => c.name);
  return { filename: `pack-template-${code}.csv`, csv: `﻿${csvLine(names)}\r\n${csvLine(names.map((n) => values[n] ?? ""))}\r\n`, columns, code };
}

// ---- analysis ---------------------------------------------------------------------------------

export type ReportError = { code: string; message: string; row?: number; column?: string; file?: string };
type ReportFile = { key: string; label: string; kind: "image" | "audio"; file: string; points?: number; ok: boolean; detail: string; url?: string };
type ReportRow = { row: number; slot: number | null; format: string; promptAr: string; answerAr: string; files: ReportFile[]; errors: ReportError[] };
export type PackReport = { label: string; rows: ReportRow[]; errors: ReportError[]; ok: boolean };

export type PlannedRow = {
  row: number;
  slot: number;
  format: Format;
  composed?: FormatRow;
  config: JsonObject;
  fields: { promptAr: string; promptFranco: string | null; answerAr: string; answerFranco: string | null };
  files: { spec: SlotSpec; name: string; /** Full path inside the ZIP. */ entry: string; found: Inspected; points?: number }[];
};
export type Plan = { packs: { label: string; rows: PlannedRow[] }[]; fileNames: string[] };

export type Report = {
  errors: ReportError[];
  packs: PackReport[];
  summary: { packs: number; questions: number; files: number; errors: number; ignored: number };
  canImport: boolean;
};

const describe = (found: Inspected, bytes: number) => {
  const size = bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return found.kind === "image" ? `${found.widthPx}×${found.heightPx} · ${size}` : `${((found.durationMs ?? 0) / 1000).toFixed(1)} s · ${size}`;
};

const error = (code: string, extra: Partial<ReportError> = {}): ReportError => ({ code, message: messageFor(code), ...extra });

const asBoolean = (value: string) => (/^(yes|true|1)$/i.test(value) ? true : /^(no|false|0)$/i.test(value) ? false : undefined);

type Analyze = {
  zip: OpenZip;
  db: SahsahDatabase;
  /** The provider recorded on the preview of an imported file; irrelevant to the checks. */
  storageProvider?: string;
  storageConfigured: boolean;
  /** Signed link for the staged file, minted only for files that passed inspection. */
  previewUrl?: (name: string, contentType: string) => string;
};

/**
 * Reads the whole ZIP and judges it exactly as an import would, writing nothing. The plan it
 * returns is what the import then executes, so the dry run and the import cannot disagree: every
 * question is also judged by the same `questionContentIssues` that game start and publish use.
 */
export async function analyzeZip(input: Analyze): Promise<{ report: Report; plan: Plan }> {
  const { zip } = input;
  const errors: ReportError[] = [];
  const empty = (): { report: Report; plan: Plan } => ({
    report: { errors, packs: [], summary: { packs: 0, questions: 0, files: 0, errors: errors.length, ignored: zip.ignored }, canImport: false },
    plan: { packs: [], fileNames: [] },
  });

  const csvEntries = zip.entries.filter((e) => e.name === "pack.csv" || e.name.endsWith("/pack.csv"));
  if (csvEntries.length === 0) throw new ZipRefusal("csv_missing");
  if (csvEntries.length > 1) throw new ZipRefusal("csv_multiple");
  const csvName = csvEntries[0]!.name;
  const base = csvName.slice(0, csvName.length - "pack.csv".length);
  const media = new Map<string, number>();
  for (const entry of zip.entries) {
    if (entry.name === csvName) continue;
    if (entry.name.startsWith(base) && !entry.name.slice(base.length).includes("/")) media.set(entry.name.slice(base.length), entry.size);
    else errors.push(error("outside_folder", { file: entry.name }));
  }

  let table: string[][];
  try {
    table = parseCsv(decodeUtf8(await zip.read(csvName, ZIP_LIMITS.csvBytes)));
  } catch (e) {
    if (e instanceof CsvError) errors.push(error(e.code, e.row ? { row: e.row } : {}));
    else if (e instanceof ZipRefusal) errors.push(error(e.code === "file_too_large" ? "csv_too_large" : e.code));
    else throw e;
    return empty();
  }
  if (!table.length) return errors.push(error("csv_empty")), empty();
  const header = table[0]!.map((h) => h.trim().toLowerCase());
  if (header.length === 1 && header[0]!.includes(";")) return errors.push(error("csv_delimiter", { row: 1 })), empty();
  const seen = new Set<string>();
  header.forEach((name) => {
    if (seen.has(name)) errors.push(error("duplicate_column", { row: 1, column: name }));
    seen.add(name);
    if (!KNOWN_COLUMNS.has(name)) errors.push(error("unknown_column", { row: 1, column: name }));
  });
  for (const name of REQUIRED_COLUMNS) if (!seen.has(name)) errors.push(error("missing_column", { row: 1, column: name }));
  if (errors.length) return empty();
  const dataRows = table.slice(1);
  if (!dataRows.length) return errors.push(error("no_rows")), empty();
  if (dataRows.length > IMPORT_LIMITS.rows) return errors.push(error("too_many_rows")), empty();

  const formatRows = await input.db.select().from(questionFormats).limit(300);
  const byCode = new Map(formatRows.map((r) => [r.code, r]));
  const referenced = new Set<string>();
  const inspected = new Map<string, Inspected | string>();
  const inspect = async (name: string, kind: "image" | "audio") => {
    const key = `${kind}\0${name}`;
    if (!inspected.has(key)) {
      try {
        inspected.set(key, inspectMedia(await zip.read(base + name, ZIP_LIMITS.entryBytes), kind));
      } catch (e) {
        if (e instanceof MediaRefusal || e instanceof ZipRefusal) inspected.set(key, e.code);
        else throw e;
      }
    }
    return inspected.get(key)!;
  };

  const groups = new Map<string, { rows: ReportRow[]; planned: PlannedRow[] }>();
  let filesUsed = 0;
  for (const [index, cells] of dataRows.entries()) {
    const rowNumber = index + 2;
    const cell = (name: string) => (cells[header.indexOf(name)] ?? "").trim();
    const row: ReportRow = { row: rowNumber, slot: null, format: cell("format"), promptAr: cell("prompt_ar"), answerAr: cell("answer_ar"), files: [], errors: [] };
    const fail = (code: string, column?: string, file?: string) => row.errors.push(error(code, { row: rowNumber, ...(column ? { column } : {}), ...(file ? { file } : {}) }));
    const label = cell("pack");
    const group = groups.get(label) ?? { rows: [], planned: [] };
    groups.set(label, group);
    group.rows.push(row);

    if (cells.length !== header.length) fail("row_shape");
    if (!label) fail("pack_missing", "pack");
    else if (label.length > IMPORT_LIMITS.packLabel) fail("pack_label_too_long", "pack");
    if (/^[1-6]$/.test(cell("slot"))) row.slot = Number(cell("slot"));
    else fail("invalid_slot", "slot");

    // The format: a built-in code (any case) or a composed format's code.
    const code = cell("format");
    const built = code.toUpperCase();
    let choice: FormatChoice | undefined;
    if (built !== "COMPOSED" && built in FORMAT_SLOTS) choice = { format: built as Format };
    else if (byCode.has(code.toLowerCase())) {
      const composed = byCode.get(code.toLowerCase())!;
      if (composed.archivedAt) fail("format_archived", "format");
      else choice = { format: "COMPOSED", composed };
    } else fail("unknown_format", "format");
    // Every file name in the row counts as used, even when the row has other problems.
    const specs = choice ? uploadSlots(choice.format, choice.composed && definitionOf(choice.composed)) : [];
    const own = new Set<string>([...BASE_COLUMNS, ...(choice ? configColumns(choice.format).map((c) => c.column) : []), ...specs.flatMap((s) => [fileColumn(s), ...(s.points ? [pointsColumn(s)] : [])])]);
    for (const name of header) {
      const value = cell(name);
      if (name.endsWith("_file") && value) referenced.add(value);
      if (choice && !own.has(name) && value) fail("column_not_used", name);
    }
    if (!choice) continue;

    const composed = choice.composed && definitionOf(choice.composed);
    const raw: Record<string, unknown> = {};
    for (const c of configColumns(choice.format)) {
      const value = cell(c.column);
      if (!value) continue;
      if (c.key === "allowForward") {
        const flag = asBoolean(value);
        if (flag === undefined) fail("invalid_boolean", c.column);
        else raw[c.key] = flag;
      } else raw[c.key] = value;
    }
    let config: JsonObject = {};
    try {
      config = cleanConfig(choice.format, raw);
    } catch (e) {
      if (!(e instanceof ContentError)) throw e;
      fail("invalid_config");
    }

    // Build the same pins and file rows the import writes, then let the shared rules judge them.
    type Asset = Parameters<typeof questionContentIssues>[2][number];
    const pins: Parameters<typeof questionContentIssues>[1] = [], assets: Asset[] = [], files: PlannedRow["files"] = [], bad = new Set<string>();
    const asset = (id: string, found: Inspected, extra: Partial<Asset> = {}): Asset => ({
      id, mediaKind: found.kind, state: "ready", accessScope: "private", storageProvider: input.storageProvider ?? "local", contentType: found.contentType, byteSize: BigInt(0),
      widthPx: found.widthPx ?? null, heightPx: found.heightPx ?? null, durationMs: found.durationMs ?? null, sourceAssetId: null, transformSpec: {}, archivedAt: null, ...extra,
    });
    const originalRole = choice.format.startsWith("AUDIO_") ? "source_audio" : "answer_image";
    const originalSpec = specs.find((s) => s.role === originalRole);
    for (const spec of specs) {
      const column = fileColumn(spec), name = cell(column), points = cell(pointsColumn(spec));
      if (!name) {
        if (points && spec.points) fail("points_without_file", pointsColumn(spec));
        continue;
      }
      if (name.includes("/") || name.includes("\\") || name.includes("..") || name.length > IMPORT_LIMITS.fileName) {
        fail("bad_file_name", column, name);
        bad.add(spec.key);
        continue;
      }
      if (!media.has(name)) {
        fail("missing_file", column, name);
        bad.add(spec.key);
        continue;
      }
      const found = await inspect(name, spec.kind);
      if (typeof found === "string") {
        fail(found, column, name);
        bad.add(spec.key);
        continue;
      }
      let value: number | undefined;
      if (spec.points) {
        value = /^\d+$/.test(points) ? Number(points) : NaN;
        if (!(value >= 1 && value <= 600)) {
          fail("points_required", pointsColumn(spec));
          bad.add(spec.key);
          continue;
        }
      }
      filesUsed++;
      const id = `${rowNumber}:${spec.key}`;
      const original = originalSpec && spec.derive ? `${rowNumber}:${originalSpec.key}` : null;
      assets.push(asset(id, found, { byteSize: BigInt(media.get(name)!), ...(original ? { sourceAssetId: original, transformSpec: { operation: spec.derive!.operation, stageIndex: spec.variant } } : {}) }));
      pins.push({ mediaRole: spec.role, variantNumber: spec.variant, suggestedPoints: value ?? null, mediaAssetId: id });
      files.push({ spec, name, entry: base + name, found, ...(value !== undefined ? { points: value } : {}) });
      row.files.push({ key: spec.key, label: spec.label, kind: spec.kind, file: name, ...(value !== undefined ? { points: value } : {}), ok: true, detail: describe(found, media.get(name)!), ...(input.previewUrl ? { url: input.previewUrl(base + name, found.contentType) } : {}) });
    }
    const source = pins.find((p) => p.mediaRole === "source_audio");
    if (choice.format === "AUDIO_REVERSE" && config.allowForward === true && source) pins.push({ mediaRole: "answer_audio", variantNumber: 0, suggestedPoints: null, mediaAssetId: source.mediaAssetId });
    // The original must also be a distinct file from every rendition; with one row per slot it always is.
    const fields = { promptAr: cell("prompt_ar"), promptFranco: cell("prompt_franco") || null, answerAr: cell("answer_ar"), answerFranco: cell("answer_franco") || null };
    const issues = questionContentIssues({ format: choice.format, slotNumber: row.slot ?? 1, ...fields, formatConfig: config }, pins, assets, composed);
    for (const issue of issues) {
      const slotKey = /^(?:missing|lineage)_(\w+)$/.exec(issue.code)?.[1];
      // A file that already failed has its own message; do not repeat it as "missing".
      if (slotKey && bad.has(slotKey) && issue.code.startsWith("missing_")) continue;
      if (issue.code.startsWith("lineage_") && originalSpec && bad.has(originalSpec.key)) continue;
      const spec = slotKey && specs.find((s) => s.key === slotKey);
      const column = issue.code === "prompt_missing" ? "prompt_ar" : issue.code === "answer_missing" ? "answer_ar" : spec ? fileColumn(spec) : undefined;
      // The shared rule's own words are shown, so staff see the same text as in the editor.
      row.errors.push({ code: issue.code.startsWith("lineage_") ? "lineage" : issue.code, message: issue.message, row: rowNumber, ...(column ? { column } : {}) });
    }
    if (!row.errors.length && row.slot) group.planned.push({ row: rowNumber, slot: row.slot, format: choice.format, composed: choice.composed, config, fields, files });
  }

  const packs: PackReport[] = [];
  let questions = 0;
  const plan: Plan = { packs: [], fileNames: [...media.keys()] };
  for (const [label, group] of groups) {
    const pack: PackReport = { label, rows: group.rows, errors: [], ok: false };
    const counts = new Map<number, ReportRow[]>();
    for (const row of group.rows) if (row.slot) counts.set(row.slot, [...(counts.get(row.slot) ?? []), row]);
    for (const rows of counts.values()) if (rows.length > 1) for (const row of rows) row.errors.push(error("duplicate_slot", { row: row.row, column: "slot" }));
    if (group.rows.length !== 6 || counts.size !== 6) {
      const missing = [1, 2, 3, 4, 5, 6].filter((n) => !counts.has(n));
      pack.errors.push({ ...error("wrong_row_count"), message: `Pack "${label || "(no label)"}" has ${group.rows.length} row${group.rows.length === 1 ? "" : "s"}; each pack needs exactly six, one for each slot 1 to 6${missing.length ? ` (no row for slot ${missing.join(", ")})` : ""}.` });
    }
    pack.ok = pack.errors.length === 0 && group.rows.every((r) => r.errors.length === 0);
    questions += group.rows.length;
    if (pack.ok) plan.packs.push({ label, rows: group.planned.sort((a, b) => a.slot - b.slot) });
    packs.push(pack);
  }
  for (const name of media.keys()) if (!referenced.has(name)) errors.push(error("unused_file", { file: name }));
  if (filesUsed > 0 && !input.storageConfigured) errors.push(error("storage_not_configured"));
  const total = errors.length + packs.reduce((n, p) => n + p.errors.length + p.rows.reduce((m, r) => m + r.errors.length, 0), 0);
  for (const pack of packs) for (const row of pack.rows) for (const file of row.files) if (row.errors.some((e) => e.file === file.file)) file.ok = false;
  return { report: { errors, packs, summary: { packs: packs.length, questions, files: media.size, errors: total, ignored: zip.ignored }, canImport: total === 0 && packs.length > 0 }, plan };
}

/** A UUID derived from the import's request key, so a retried import finds its own packs, questions and files. */
export const derivedId = (requestKey: string, ...parts: (string | number)[]) => {
  const h = createHash("sha256").update(`import:${requestKey}:${parts.join(":")}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
