import {
  slotPoints,
  defaultPointStages,
  validPointStages,
} from "./rules/points.js";
import { z } from "zod";
import type { JsonObject } from "../../database/schema/types.js";
import { requireState } from "../platform/problem.js";
import type { Question } from "../platform/types.js";
import type { Contract } from "../contract.js";
import { invariant } from "../platform/invariant.js";
import * as s from "../../database/schema/index.js";
import { readSnapshot, stageCount } from "./rules/composed-format.js";
export type UnionFields<U> = {
  [K in U extends unknown ? keyof U : never]?: U extends unknown
    ? K extends keyof U
      ? U[K]
      : never
    : never;
};
export type QuestionPresentation = UnionFields<
  Contract<"HostQuestion"> | Contract<"ViewerQuestion">
> & { format: Question["format"] };
export type AnswerPresentation = Omit<
  UnionFields<
    | Contract<"StandardHostAnswer">
    | Contract<"AudioReverseHostAnswer">
    | Contract<"ImageColorHostAnswer">
    | Contract<"ComposedHostAnswer">
  >,
  "format"
> & { format: Question["format"]; text: string };

// Only these authored settings become executable game rules. No source URLs or
// arbitrary configuration fields are copied into a public projection.
const configSchema = z
  .object({
    stageSuggestions: z
      .array(z.number().int().positive().max(600))
      .min(2)
      .max(5)
      .optional(),
    // Charades only: the unguessable part of the card link (ADR 0019).
    cardToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{22}$/)
      .optional(),
    instructionAr: z.string().trim().min(1).max(4000).optional(),
    instructionFranco: z.string().trim().min(1).max(4000).optional(),
    hintAr: z.string().trim().min(1).max(500).optional(),
    hintFranco: z.string().trim().min(1).max(500).optional(),
    allowForward: z.boolean().optional(),
    colorHex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict();
export const points = slotPoints;
/** Question columns a write returns: the fields stateInvariants checks, without content. */
export const checkedQuestionColumns = {
  boardPosition: s.gameQuestions.boardPosition,
  questionPosition: s.gameQuestions.questionPosition,
  basePoints: s.gameQuestions.basePoints,
  stageIndex: s.gameQuestions.stageIndex,
  timerState: s.gameQuestions.timerState,
  remainingMs: s.gameQuestions.remainingMs,
  timerDeadlineAt: s.gameQuestions.timerDeadlineAt,
  awardedPoints: s.gameQuestions.awardedPoints,
};
export function settings(
  format: string,
  value: unknown,
  cap: number,
): JsonObject {
  const parsed = configSchema.safeParse(value);
  requireState(parsed.success, "CONTENT_NOT_READY");
  const config = parsed.data;
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(format)) {
    invariant(cap === 200 || cap === 400 || cap === 600, "SLOT_POINTS_CAP");
    const suggestions = config.stageSuggestions ?? defaultPointStages(cap);
    requireState(
      suggestions.length === 3 && validPointStages(suggestions, cap),
      "CONTENT_NOT_READY",
    );
    return { ...config, stageSuggestions: suggestions };
  }
  // Composed formats carry suggestions only when they have hint stages.
  if (format === "IMAGE_CLUES" || (format === "COMPOSED" && config.stageSuggestions))
    requireState(
      config.stageSuggestions !== undefined &&
        validPointStages(config.stageSuggestions, cap),
      "CONTENT_NOT_READY",
    );
  if (format === "CHARADES")
    requireState(config.cardToken !== undefined, "CONTENT_NOT_READY");
  return config;
}
/** Hints a question can still reveal: blur/zoom stages, or clue cards. */
export function hintStages(q: Question): number {
  if (q.format === "COMPOSED") {
    const composed = readSnapshot(q.contentSnapshot?.composed);
    invariant(composed, "COMPOSED_SNAPSHOT");
    return stageCount(composed);
  }
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format)) return 3;
  if (q.format !== "IMAGE_CLUES") return 0;
  const stages = (q.contentSnapshot?.config as { stageSuggestions?: number[] })
    ?.stageSuggestions;
  return stages?.length ?? 0;
}
/** The address a charades code opens; the page asks the API for the card (ADR 0019). */
export function cardUrl(q: Question, token: string): string {
  const base = new URL(
    "/act/",
    process.env.GAMEPLAY_JOIN_BASE_URL ?? "http://localhost:3000/join/",
  );
  return new URL(
    `${q.gameId}/${q.boardPosition}/${q.questionPosition}?t=${token}`,
    base,
  ).href;
}
export function local(ar: unknown, franco: unknown, language: string): string {
  return String(language === "franco" && franco ? franco : ar);
}
export function suggested(q: Question): number {
  const config = q.contentSnapshot?.config;
  const stages =
    config && typeof config === "object" && !Array.isArray(config)
      ? config.stageSuggestions
      : undefined;
  return Number(Array.isArray(stages) ? stages[q.stageIndex] : q.basePoints);
}
export const remaining = (q: Question, now: Date) =>
  q.timerState === "running"
    ? Math.max(
        0,
        Math.min(60000, new Date(q.timerDeadlineAt!).getTime() - now.getTime()),
      )
    : q.remainingMs;
export function timer(q: Question, now: Date): Contract<"Timer"> {
  const remainingMs = remaining(q, now);
  if (q.timerState === "running") {
    invariant(q.timerDeadlineAt, "TIMER_RUNNING_DEADLINE");
    return {
      state: q.timerState,
      remainingMs,
      deadlineAt: new Date(q.timerDeadlineAt).toISOString(),
    };
  }
  if (q.timerState === "ready") {
    invariant(remainingMs === 60000, "TIMER_READY_REMAINING");
    return { state: q.timerState, remainingMs };
  }
  if (q.timerState === "elapsed") {
    invariant(remainingMs === 0, "TIMER_ELAPSED_REMAINING");
    return { state: q.timerState, remainingMs };
  }
  return { state: q.timerState, remainingMs };
}
export function ref(
  q: Question,
  role: "question_audio" | "answer_audio" | "hint_audio",
  variantNumber?: number,
): Contract<"AudioRef">;
export function ref(
  q: Question,
  role: "prompt_image" | "answer_image" | "hint_image",
  variantNumber?: number,
): Contract<"ImageRef">;
export function ref(
  q: Question,
  role: Contract<"MediaRef">["role"],
  variantNumber = 0,
): Contract<"MediaRef"> {
  const positions = {
    boardPosition: q.boardPosition,
    questionPosition: q.questionPosition,
  };
  if (role === "question_audio" || role === "answer_audio" || role === "hint_audio") {
    invariant(role === "hint_audio" ? variantNumber <= 3 : variantNumber === 0, "AUDIO_VARIANT");
    return { kind: "audio", ...positions, role, variantNumber };
  }
  return { kind: "image", ...positions, role, variantNumber };
}
export type Pin = {
  mediaRole: string;
  variantNumber: number;
  durationMs?: number | null;
};
export function questionView(
  q: Question,
  pins: Pin[],
  host: boolean,
  language: string,
): QuestionPresentation {
  const c = q.contentSnapshot!;
  // Copied configuration comes from settings() before the snapshot is persisted.
  const cfg = c.config as z.output<typeof configSchema>;
  const prompt = local(c.promptAr, c.promptFranco, language);
  const result: QuestionPresentation = { format: q.format, prompt };
  const has = (role: string, variant = 0) =>
    pins.some((p) => p.mediaRole === role && p.variantNumber === variant);
  if (q.format === "IMAGE_MEMORY") {
    if (!q.memoryFirstHiddenAt)
      return {
        format: q.format,
        memoryPhase: q.memoryImageVisible ? "viewing_first" : "ready",
        instruction: local(
          cfg.instructionAr ?? "احفظ الصورة ثم أخفها للإجابة",
          cfg.instructionFranco,
          language,
        ),
        ...(q.memoryImageVisible ? { image: ref(q, "prompt_image") } : {}),
      };
    return {
      ...result,
      memoryPhase: q.memoryImageVisible ? "revisit" : "recall",
      ...(q.memoryImageVisible ? { image: ref(q, "prompt_image") } : {}),
    };
  }
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format))
    Object.assign(result, {
      image: ref(q, "hint_image", q.stageIndex),
      stageIndex: q.stageIndex,
      stageSuggestions: cfg.stageSuggestions,
    });
  else if (q.format === "IMAGE_CLUES")
    Object.assign(result, {
      image: ref(q, "prompt_image"),
      ...(q.stageIndex > 0
        ? { clue: ref(q, "hint_image", q.stageIndex - 1) }
        : {}),
      stageIndex: q.stageIndex,
      stageSuggestions: cfg.stageSuggestions,
    });
  else if (q.format === "COMPOSED") return composedView(q, pins, host, language);
  else if (q.format === "CHARADES") {
    // The card itself never reaches a room projection: only its code does.
    invariant(cfg.cardToken, "CHARADES_CARD_TOKEN");
    result.cardUrl = cardUrl(q, cfg.cardToken);
  } else if (has("prompt_image")) result.image = ref(q, "prompt_image");
  if (q.format.startsWith("AUDIO_")) {
    const duration = pins.find(
      (p) => p.mediaRole === "question_audio",
    )?.durationMs;
    invariant(duration != null, "AUDIO_DURATION");
    result.durationMs = duration;
    if (host) result.audio = ref(q, "question_audio");
    if (q.format === "AUDIO_VOICE" && cfg.hintAr)
      result.hint = local(cfg.hintAr, cfg.hintFranco, language);
  }
  return result;
}
/** The one shape every staff-defined format uses: label, the current stage's file and the suggestions. */
function composedView(
  q: Question,
  pins: Pin[],
  host: boolean,
  language: string,
): QuestionPresentation {
  const c = q.contentSnapshot!;
  const composed = readSnapshot(c.composed);
  invariant(composed, "COMPOSED_SNAPSHOT");
  const cfg = c.config as z.output<typeof configSchema>;
  const stage = q.stageIndex;
  const kind = stage === 0 ? (composed.baseKind === "text" ? "none" : composed.baseKind) : composed.stageKinds[stage - 1];
  invariant(kind, "COMPOSED_STAGE");
  const result: QuestionPresentation = {
    format: "COMPOSED",
    label: composed.labelAr,
    baseKind: composed.baseKind,
    stageIndex: stage,
    mediaKind: kind,
    ...(composed.showPrompt ? { prompt: local(c.promptAr, c.promptFranco, language) } : {}),
    ...(cfg.stageSuggestions ? { stageSuggestions: cfg.stageSuggestions } : {}),
  };
  if (kind === "image")
    result.image = stage === 0 ? ref(q, "prompt_image") : ref(q, "hint_image", stage - 1);
  if (kind === "audio") {
    const role = stage === 0 ? "question_audio" : "hint_audio";
    const duration = pins.find(
      (p) => p.mediaRole === role && p.variantNumber === Math.max(0, stage - 1),
    )?.durationMs;
    invariant(duration != null, "AUDIO_DURATION");
    result.durationMs = duration;
    // Like every audio question, only the host's device plays the clip.
    if (host) result.audio = ref(q, role, Math.max(0, stage - 1));
  }
  return result;
}
export function answerView(
  q: Question,
  pins: Pin[],
  host: boolean,
  language: string,
): AnswerPresentation {
  const c = q.contentSnapshot!,
    // Copied configuration comes from settings() before the snapshot is persisted.
    cfg = c.config as z.output<typeof configSchema>;
  if (q.format === "COMPOSED") {
    const answerAudio = pins.find((p) => p.mediaRole === "answer_audio");
    return {
      format: q.format,
      text: local(c.answerAr, c.answerFranco, language),
      ...(pins.some((p) => p.mediaRole === "answer_image")
        ? { image: ref(q, "answer_image") }
        : {}),
      ...(host && answerAudio?.durationMs
        ? {
            audio: ref(q, "answer_audio"),
            durationMs: answerAudio.durationMs,
          }
        : {}),
    };
  }
  return {
    format: q.format,
    text: local(c.answerAr, c.answerFranco, language),
    ...(pins.some((p) => p.mediaRole === "answer_image")
      ? { image: ref(q, "answer_image") }
      : {}),
    ...(q.format === "IMAGE_COLOR" && cfg.colorHex
      ? { colorHex: cfg.colorHex }
      : {}),
    ...(host &&
    q.format === "AUDIO_REVERSE" &&
    cfg.allowForward &&
    pins.some((p) => p.mediaRole === "answer_audio")
      ? { forwardAudio: ref(q, "answer_audio") }
      : {}),
  };
}
