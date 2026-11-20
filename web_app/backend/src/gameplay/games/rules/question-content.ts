import type * as s from "../../../database/schema/index.js";
import { settings } from "../content.js";
import { slotPoints } from "./points.js";

type Format = (typeof s.questions.$inferSelect)["format"];
type Role = (typeof s.questionMedia.$inferSelect)["mediaRole"];
type MediaPin = Pick<typeof s.questionMedia.$inferSelect, "mediaRole" | "variantNumber" | "suggestedPoints" | "mediaAssetId">;
type Asset = Pick<
  typeof s.mediaAssets.$inferSelect,
  "id" | "mediaKind" | "state" | "accessScope" | "storageProvider" | "contentType" | "byteSize" | "widthPx" | "heightPx" | "durationMs" | "sourceAssetId" | "transformSpec" | "archivedAt"
>;
type QuestionContent = Pick<typeof s.questions.$inferSelect, "format" | "slotNumber" | "promptAr" | "promptFranco" | "answerAr" | "answerFranco" | "formatConfig">;

/**
 * One media slot of a question format. A derived slot is a finished file prepared from the
 * format's original (the answer picture, or the forward audio); it records that lineage so a
 * derived hint can never be paired with a different original.
 */
export type SlotSpec = {
  key: string;
  role: Role;
  variant: number;
  kind: "image" | "audio";
  /** `forward`: only when the question allows forward answer playback. */
  required: boolean | "forward";
  derive?: { from: Role; operation: string };
  /** The slot carries suggested points (hint stages and clue cards). */
  points?: boolean;
  label: string;
};

const slot = (key: string, role: Role, label: string, required: SlotSpec["required"], extra: Partial<SlotSpec> = {}): SlotSpec => ({
  key,
  role,
  variant: 0,
  kind: role.endsWith("audio") ? "audio" : "image",
  required,
  label,
  ...extra,
});
const stage = (index: number, label: string, operation: string, required = true): SlotSpec =>
  slot(`hint${index}`, "hint_image", label, required, { variant: index, points: true, ...(operation ? { derive: { from: "answer_image", operation } } : {}) });
const clue = (index: number): SlotSpec => ({ ...slot(`hint${index}`, "hint_image", `Clue card ${index + 1}`, index === 0), variant: index, points: true });

export const FORMAT_SLOTS: Record<Format, SlotSpec[]> = {
  STANDARD: [slot("prompt", "prompt_image", "Question picture (optional)", false), slot("answer", "answer_image", "Answer picture (optional)", false)],
  IMAGE_BLUR: [
    slot("answer", "answer_image", "Full original picture", true),
    stage(0, "Hint stage 1 (most blurred)", "blur"),
    stage(1, "Hint stage 2", "blur"),
    stage(2, "Hint stage 3 (clearest)", "blur"),
  ],
  IMAGE_ZOOM: [
    slot("answer", "answer_image", "Full original picture", true),
    stage(0, "Hint stage 1 (tightest crop)", "crop"),
    stage(1, "Hint stage 2", "crop"),
    stage(2, "Hint stage 3 (widest crop)", "crop"),
  ],
  AUDIO_GUESS: [slot("audio", "question_audio", "Question audio", true)],
  AUDIO_REVERSE: [
    slot("source", "source_audio", "Forward audio (the real clip)", true),
    slot("audio", "question_audio", "Reversed audio played to the host", true, { derive: { from: "source_audio", operation: "reverse" } }),
    slot("forward", "answer_audio", "Forward clip for the answer", "forward"),
  ],
  IMAGE_PERSON: [
    slot("answer", "answer_image", "Full portrait (answer)", true),
    slot("prompt", "prompt_image", "Question crop", true, { derive: { from: "answer_image", operation: "crop" } }),
  ],
  IMAGE_COLOR: [
    slot("answer", "answer_image", "Original colour picture (answer)", true),
    slot("prompt", "prompt_image", "Grayscale picture (question)", true, { derive: { from: "answer_image", operation: "grayscale" } }),
  ],
  IMAGE_RIDDLE: [slot("prompt", "prompt_image", "Riddle illustration", true)],
  AUDIO_VOICE: [slot("audio", "question_audio", "Voice clip", true)],
  IMAGE_MEMORY: [slot("prompt", "prompt_image", "Scene picture", true), slot("answer", "answer_image", "Answer picture", true)],
  IMAGE_CLUES: [slot("prompt", "prompt_image", "Main picture", true), clue(0), clue(1), clue(2), clue(3)],
  CHARADES: [slot("prompt", "prompt_image", "Card picture (what to act)", true), slot("answer", "answer_image", "Answer picture", true)],
};

export type ContentIssue = {
  code: string;
  message: string;
  /** Hint/answer renditions that do not trace back to this question's original file. */
  lineage?: boolean;
};

const MAX_TEXT = 4000;
const MAX_DIMENSION = 16384;
const MAX_AUDIO_MS = 1_800_000;

/**
 * Everything the game start requires of one current question, as a list of problems. Game start
 * and the staff dashboard's publish check both use it, so what staff can publish is what hosts can start.
 */
export function questionContentIssues(question: QuestionContent, media: MediaPin[], assets: Asset[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (code: string, message: string, lineage = false) => issues.push({ code, message, ...(lineage ? { lineage } : {}) });
  const specs = FORMAT_SLOTS[question.format];
  const pin = (role: Role, variant = 0) => media.find((m) => m.mediaRole === role && m.variantNumber === variant);
  const asset = (id: string | undefined) => assets.find((a) => a.id === id);

  const longest = Math.max(question.promptAr.length, question.answerAr.length, question.promptFranco?.length ?? 0, question.answerFranco?.length ?? 0);
  if (!question.promptAr.trim()) add("prompt_missing", "The Arabic question text is empty.");
  if (!question.answerAr.trim()) add("answer_missing", "The Arabic answer is empty.");
  if (longest > MAX_TEXT) add("text_too_long", `Question and answer text can be at most ${MAX_TEXT} characters.`);

  const forward = (question.formatConfig as { allowForward?: unknown }).allowForward === true;
  const hints = media.filter((m) => m.mediaRole === "hint_image").sort((a, b) => a.variantNumber - b.variantNumber);
  for (const spec of specs) {
    const required = spec.required === "forward" ? forward : spec.required;
    if (required && !pin(spec.role, spec.variant)) add(`missing_${spec.key}`, `${spec.label} is missing.`);
  }
  if (question.format === "IMAGE_CLUES") {
    if (!hints.every((m, i) => m.variantNumber === i) || hints.length > 4) add("clue_order", "Clue cards must be numbered 1 to 4 without gaps.");
  }

  // Authored settings; point bands are checked against the slot's tile value.
  const expectedHints = question.format === "IMAGE_CLUES" ? hints.length >= 1 : hints.length === 3;
  if (["IMAGE_BLUR", "IMAGE_ZOOM", "IMAGE_CLUES"].includes(question.format) ? expectedHints : true) {
    const points = slotPoints(question.slotNumber);
    const stageSuggestions = hints.map((m) => m.suggestedPoints);
    try {
      settings(
        question.format,
        {
          ...question.formatConfig,
          ...(["IMAGE_BLUR", "IMAGE_ZOOM"].includes(question.format) ? { stageSuggestions } : {}),
          ...(question.format === "IMAGE_CLUES" ? { stageSuggestions: [points, ...stageSuggestions] } : {}),
          ...(question.format === "CHARADES" ? { cardToken: "x".repeat(22) } : {}),
        },
        points,
      );
    } catch {
      const hinted = ["IMAGE_BLUR", "IMAGE_ZOOM", "IMAGE_CLUES"].includes(question.format);
      add(
        "config_invalid",
        hinted
          ? `Suggested points must start at ${points} for the first stage and keep decreasing (each stage lower than the one before).`
          : "The format settings are not valid.",
      );
    }
  }

  // The original a rendition must come from: the answer picture, or the forward audio.
  const originalRole: Role = question.format.startsWith("AUDIO_") ? "source_audio" : "answer_image";
  const original = asset(pin(originalRole)?.mediaAssetId);
  for (const spec of specs) {
    const attached = pin(spec.role, spec.variant);
    if (!spec.derive || !attached) continue;
    const derived = asset(attached.mediaAssetId);
    if (!derived || !original || derived.id === original.id || derived.sourceAssetId !== original.id || derived.transformSpec.operation !== spec.derive.operation)
      add(`lineage_${spec.key}`, `${spec.label} was not prepared from the current original file. Upload it again.`, true);
  }

  for (const attached of media) {
    const file = asset(attached.mediaAssetId);
    const audio = attached.mediaRole.endsWith("audio");
    const name = specs.find((spec) => spec.role === attached.mediaRole && spec.variant === attached.variantNumber)?.label ?? attached.mediaRole;
    if (
      !file ||
      file.state !== "ready" ||
      file.archivedAt ||
      file.accessScope !== "private" ||
      !["r2", "local"].includes(file.storageProvider) ||
      !file.contentType ||
      file.contentType.length > 100 ||
      file.byteSize === null ||
      (file.widthPx !== null && file.widthPx > MAX_DIMENSION) ||
      (file.heightPx !== null && file.heightPx > MAX_DIMENSION)
    ) {
      add(`not_ready_${attached.mediaRole}_${attached.variantNumber}`, `${name} is not a ready private file.`);
    } else if (audio ? file.mediaKind !== "audio" || !file.durationMs || file.durationMs > MAX_AUDIO_MS : file.mediaKind !== "image") {
      add(`wrong_kind_${attached.mediaRole}_${attached.variantNumber}`, `${name} has the wrong kind of file.`);
    }
  }
  return issues;
}
