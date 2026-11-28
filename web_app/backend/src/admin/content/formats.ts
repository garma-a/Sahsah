import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseConnection } from "../../database/connection.js";
import { questionFormats, questions } from "../../database/schema/index.js";
import { describeComposed, composedSlots, MAX_HINT_STAGES, type ComposedDefinition } from "../../gameplay/games/rules/composed-format.js";
import { FORMAT_SLOTS } from "../../gameplay/games/rules/question-content.js";
import { applyOnce, recordAudit } from "../audit.js";
import { StaffError } from "../staff-service.js";

class FormatError extends StaffError {}
const UUID = /^[0-9a-f-]{36}$/;
const MAX_FORMAT_NAME_LENGTH = 80;

/** The twelve built-in kinds, described for staff. Their behaviour is code, so they are read-only. */
const BUILT_IN: Record<string, string> = {
  STANDARD: "Text question with an optional picture and optional answer picture.",
  IMAGE_BLUR: "Three blurred pictures, clearest last, falling points. Needs the original.",
  IMAGE_ZOOM: "Three crops of a picture, widest last, falling points. Needs the original.",
  AUDIO_GUESS: "The host plays one audio clip; text answer.",
  AUDIO_REVERSE: "The host plays a reversed clip; optionally the forward clip on reveal.",
  IMAGE_PERSON: "A cropped portrait; the full portrait on reveal.",
  IMAGE_COLOR: "A grayscale picture; the colour original on reveal.",
  IMAGE_RIDDLE: "A riddle illustration.",
  AUDIO_VOICE: "A voice clip with an optional hint line.",
  IMAGE_MEMORY: "A scene shown, then hidden before answering. Interaction is built in.",
  IMAGE_CLUES: "A main picture and up to four clue cards with falling points.",
  CHARADES: "A QR code opens a private card on the actor's phone. Interaction is built in.",
};

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

type Input = { nameEn: unknown; labelAr: unknown; baseKind: unknown; stageKinds: unknown; answerKind: unknown; showPrompt: unknown };

function parse(input: Input) {
  const name = typeof input.nameEn === "string" ? input.nameEn.trim() : "";
  const label = typeof input.labelAr === "string" ? input.labelAr.trim() : "";
  if (!name) throw new FormatError("format_name_required");
  if (name.length > MAX_FORMAT_NAME_LENGTH) throw new FormatError("format_name_too_long");
  if (!label) throw new FormatError("label_required");
  if (label.length > MAX_FORMAT_NAME_LENGTH) throw new FormatError("label_too_long");
  if (input.baseKind !== "text" && input.baseKind !== "image" && input.baseKind !== "audio") throw new FormatError("invalid_base");
  if (!Array.isArray(input.stageKinds) || input.stageKinds.length > MAX_HINT_STAGES || !input.stageKinds.every((k) => k === "image" || k === "audio")) throw new FormatError("invalid_stages");
  if (input.answerKind !== "none" && input.answerKind !== "image" && input.answerKind !== "audio") throw new FormatError("invalid_answer");
  if (typeof input.showPrompt !== "boolean") throw new FormatError("invalid_prompt_flag");
  // A format with nothing to show would be a plain text question.
  if (input.baseKind === "text" && input.stageKinds.length === 0 && input.answerKind === "none") throw new FormatError("format_empty");
  return {
    nameEn: name,
    labelAr: label,
    baseKind: input.baseKind,
    stageKinds: input.stageKinds as ("image" | "audio")[],
    answerKind: input.answerKind,
    showPrompt: input.showPrompt,
  };
}

const present = (row: typeof questionFormats.$inferSelect, used: number) => {
  const definition: ComposedDefinition = { code: row.code, nameEn: row.nameEn, labelAr: row.labelAr, baseKind: row.baseKind as ComposedDefinition["baseKind"], stageKinds: row.stageKinds as ComposedDefinition["stageKinds"], answerKind: row.answerKind as ComposedDefinition["answerKind"], showPrompt: row.showPrompt };
  return { id: row.id, ...definition, archived: row.archivedAt !== null, usedBy: used, description: describeComposed(definition), slots: composedSlots(definition).map((s) => ({ key: s.key, label: s.label, kind: s.kind, points: !!s.points })) };
};

export class FormatService {
  constructor(private readonly database: DatabaseConnection) {}

  async list() {
    const db = this.database.db;
    const rows = await db.select().from(questionFormats).orderBy(questionFormats.nameEn, questionFormats.id).limit(300);
    const counts = await db
      .select({ id: questions.composedFormatId, used: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(isNull(questions.retiredAt), sql`${questions.composedFormatId} IS NOT NULL`))
      .groupBy(questions.composedFormatId);
    return {
      builtIn: Object.keys(FORMAT_SLOTS)
        .filter((code) => code !== "COMPOSED")
        .map((code) => ({ code, description: BUILT_IN[code] ?? "", slots: FORMAT_SLOTS[code as keyof typeof FORMAT_SLOTS].map((s) => ({ key: s.key, label: s.label, kind: s.kind })) })),
      composed: rows.map((r) => present(r, counts.find((c) => c.id === r.id)?.used ?? 0)),
      // Mobile apps cannot draw composed questions yet; the page says so.
      mobileSupported: false,
    };
  }

  async create(input: Input & { actorId: string; requestKey: string }) {
    const fields = parse(input);
    const code = slug(fields.nameEn);
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(code)) throw new FormatError("name_not_usable");
    return applyOnce(this.database, async (tx) => {
      const formatId = randomUUID();
      await recordAudit(tx, { staffId: input.actorId, action: "content.format.create", targetKind: "format", targetKey: formatId, requestKey: input.requestKey, details: { code, ...fields } });
      const [taken] = await tx.select({ id: questionFormats.id }).from(questionFormats).where(eq(questionFormats.code, code)).limit(1);
      if (taken) throw new FormatError("format_exists", 409);
      await tx.insert(questionFormats).values({ id: formatId, code, createdByStaffId: input.actorId, ...fields });
      return { id: formatId, code };
    });
  }

  /** Edits apply to games started later; running games hold their own copy (ADR 0002). */
  async update(input: Input & { actorId: string; requestKey: string; formatId: unknown }) {
    const fields = parse(input);
    const formatId = this.id(input.formatId);
    return applyOnce(this.database, async (tx) => {
      const [row] = await tx.select().from(questionFormats).where(eq(questionFormats.id, formatId)).limit(1).for("update");
      if (!row) throw new FormatError("not_found", 404);
      // Name, label and the prompt switch are cosmetic. Changing the slots would silently invalidate
      // questions that already carry files for the old shape, so that needs a new format instead.
      const structural = row.baseKind !== fields.baseKind || row.answerKind !== fields.answerKind || JSON.stringify(row.stageKinds) !== JSON.stringify(fields.stageKinds);
      if (structural) {
        const [used] = await tx.select({ id: questions.id }).from(questions).where(and(eq(questions.composedFormatId, formatId), isNull(questions.retiredAt))).limit(1);
        if (used) throw new FormatError("format_in_use", 409);
      }
      await recordAudit(tx, { staffId: input.actorId, action: "content.format.update", targetKind: "format", targetKey: formatId, requestKey: input.requestKey, details: { code: row.code, ...fields, previous: { nameEn: row.nameEn, labelAr: row.labelAr, baseKind: row.baseKind, stageKinds: row.stageKinds, answerKind: row.answerKind, showPrompt: row.showPrompt } } });
      await tx.update(questionFormats).set({ ...fields, updatedAt: sql`now()` }).where(eq(questionFormats.id, formatId));
      return { id: formatId };
    });
  }

  async setArchived(input: { actorId: string; requestKey: string; formatId: unknown; archived: boolean }) {
    const formatId = this.id(input.formatId);
    return applyOnce(this.database, async (tx) => {
      const [row] = await tx.select().from(questionFormats).where(eq(questionFormats.id, formatId)).limit(1).for("update");
      if (!row) throw new FormatError("not_found", 404);
      await recordAudit(tx, { staffId: input.actorId, action: input.archived ? "content.format.archive" : "content.format.unarchive", targetKind: "format", targetKey: formatId, requestKey: input.requestKey, details: { code: row.code } });
      if ((row.archivedAt !== null) === input.archived) throw new FormatError("no_change", 409);
      await tx.update(questionFormats).set({ archivedAt: input.archived ? sql`now()` : null, updatedAt: sql`now()` }).where(eq(questionFormats.id, formatId));
      return { id: formatId };
    });
  }

  private id(value: unknown) {
    if (typeof value !== "string" || !UUID.test(value)) throw new FormatError("not_found", 404);
    return value;
  }
}
