import type { SlotSpec } from "./question-content.js";

/**
 * A staff-defined question kind (ADR 0022). Stage 0 shows the base; each hint stage then replaces it
 * with its own finished file, so a format with N hint stages has N + 1 stages. Everything here is
 * data: no code path depends on a particular format's name.
 */
export type ComposedDefinition = {
  code: string;
  nameEn: string;
  labelAr: string;
  baseKind: "text" | "image" | "audio";
  stageKinds: ("image" | "audio")[];
  answerKind: "none" | "image" | "audio";
  showPrompt: boolean;
};

export const MAX_HINT_STAGES = 3;

/** The fields a game copies, so that editing the format later never changes a game in progress. */
export function snapshotOf(format: ComposedDefinition): ComposedDefinition {
  return {
    code: format.code,
    nameEn: format.nameEn,
    labelAr: format.labelAr,
    baseKind: format.baseKind,
    stageKinds: [...format.stageKinds],
    answerKind: format.answerKind,
    showPrompt: format.showPrompt,
  };
}

/** Reads a copied definition back, refusing anything that is not a valid one. */
export function readSnapshot(value: unknown): ComposedDefinition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const kinds = Array.isArray(v.stageKinds) ? v.stageKinds : undefined;
  if (
    typeof v.labelAr !== "string" ||
    typeof v.showPrompt !== "boolean" ||
    !["text", "image", "audio"].includes(String(v.baseKind)) ||
    !["none", "image", "audio"].includes(String(v.answerKind)) ||
    !kinds ||
    kinds.length > MAX_HINT_STAGES ||
    !kinds.every((k) => k === "image" || k === "audio")
  )
    return undefined;
  return {
    code: String(v.code ?? ""),
    nameEn: String(v.nameEn ?? ""),
    labelAr: v.labelAr,
    baseKind: v.baseKind as ComposedDefinition["baseKind"],
    stageKinds: kinds as ComposedDefinition["stageKinds"],
    answerKind: v.answerKind as ComposedDefinition["answerKind"],
    showPrompt: v.showPrompt,
  };
}

/** Stages a player moves through: the base, then one per hint stage. */
export const stageCount = (format: Pick<ComposedDefinition, "stageKinds">) => 1 + format.stageKinds.length;

/** The upload slots a question of this format needs, in the order staff fill them. */
export function composedSlots(format: ComposedDefinition): SlotSpec[] {
  const slots: SlotSpec[] = [];
  if (format.baseKind === "image") slots.push({ key: "base", role: "prompt_image", variant: 0, kind: "image", required: true, label: "Starting picture (stage 1)" });
  if (format.baseKind === "audio") slots.push({ key: "base", role: "question_audio", variant: 0, kind: "audio", required: true, label: "Starting audio (stage 1)" });
  format.stageKinds.forEach((kind, i) =>
    slots.push({
      key: `hint${i}`,
      role: kind === "audio" ? "hint_audio" : "hint_image",
      variant: i,
      kind,
      required: true,
      points: true,
      label: `Hint stage ${i + 1} ${kind === "audio" ? "audio" : "picture"} (stage ${i + 2})`,
    }),
  );
  if (format.answerKind === "image") slots.push({ key: "answer", role: "answer_image", variant: 0, kind: "image", required: true, label: "Answer picture (shown on reveal)" });
  if (format.answerKind === "audio") slots.push({ key: "answer", role: "answer_audio", variant: 0, kind: "audio", required: true, label: "Answer audio (host plays on reveal)" });
  return slots;
}

/** A plain-language summary of what the format asks staff to upload and what players see. */
export function describeComposed(format: ComposedDefinition): string {
  const stages = stageCount(format);
  const base = { text: "The question text only", image: "A starting picture", audio: "A starting audio clip" }[format.baseKind];
  const hints = format.stageKinds.length
    ? ` Then ${format.stageKinds.length} hint stage${format.stageKinds.length === 1 ? "" : "s"}: ${format.stageKinds.map((k, i) => `${i + 1}. ${k}`).join(", ")}, each replacing the previous one and lowering the suggested points.`
    : " No hint stages.";
  const answer = format.answerKind === "none" ? "The answer is text only." : `The answer also shows ${format.answerKind === "image" ? "a picture" : "an audio clip for the host"}.`;
  return `${stages} stage${stages === 1 ? "" : "s"}. ${base}.${hints} ${answer} The question text is ${format.showPrompt ? "shown to players" : "kept for staff only"}.`;
}
