import { z } from "zod";
import type { JsonObject } from "../database/schema/types.js";
import { requireState } from "./problem.js";
import type { Question } from "./service.js";
import type { Data } from "./ports.js";

// Only these authored settings become executable game rules. No source URLs or
// arbitrary configuration fields are copied into a public projection.
const configSchema = z
  .object({
    stageSuggestions: z
      .array(z.number().int().positive().max(600))
      .length(3)
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
export const points = (slot: number) =>
  slot <= 2 ? 200 : slot <= 4 ? 400 : 600;
export function settings(
  format: string,
  value: unknown,
  cap: number,
): JsonObject {
  const parsed = configSchema.safeParse(value);
  requireState(parsed.success, "CONTENT_NOT_READY");
  const config = parsed.data;
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(format)) {
    const suggestions =
      config.stageSuggestions ??
      { 200: [200, 150, 50], 400: [400, 250, 150], 600: [600, 400, 200] }[
        cap as 200 | 400 | 600
      ];
    requireState(
      suggestions[0] === cap &&
        suggestions.every(
          (n, i) => n <= cap && (!i || n <= suggestions[i - 1]),
        ),
      "CONTENT_NOT_READY",
    );
    return { ...config, stageSuggestions: suggestions };
  }
  return config;
}
export function local(ar: unknown, franco: unknown, language: string): string {
  return String(language === "franco" && franco ? franco : ar);
}
export function suggested(q: Question): number {
  return Number(
    (q.contentSnapshot?.config as Data | undefined)?.stageSuggestions instanceof
      Array
      ? ((q.contentSnapshot!.config as Data).stageSuggestions as number[])[
          q.stageIndex
        ]
      : q.basePoints,
  );
}
export const remaining = (q: Question, now: Date) =>
  q.timerState === "running"
    ? Math.max(
        0,
        Math.min(60000, new Date(q.timerDeadlineAt!).getTime() - now.getTime()),
      )
    : q.remainingMs;
export function timer(q: Question, now: Date): Data {
  return {
    state: q.timerState,
    remainingMs: remaining(q, now),
    ...(q.timerState === "running"
      ? { deadlineAt: new Date(q.timerDeadlineAt!).toISOString() }
      : {}),
  };
}
export const ref = (q: Question, role: string, variantNumber = 0): Data => ({
  kind: role.endsWith("audio") ? "audio" : "image",
  boardPosition: q.boardPosition,
  questionPosition: q.questionPosition,
  role,
  variantNumber,
});
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
): Data {
  const c = q.contentSnapshot!;
  const cfg = c.config as Data;
  const prompt = local(c.promptAr, c.promptFranco, language);
  const result: Data = { format: q.format, prompt };
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
  else if (has("prompt_image")) result.image = ref(q, "prompt_image");
  if (q.format.startsWith("AUDIO_")) {
    result.durationMs = pins.find(
      (p) => p.mediaRole === "question_audio",
    )!.durationMs;
    if (host) result.audio = ref(q, "question_audio");
    if (q.format === "AUDIO_VOICE" && cfg.hintAr)
      result.hint = local(cfg.hintAr, cfg.hintFranco, language);
  }
  return result;
}
export function answerView(
  q: Question,
  pins: Pin[],
  host: boolean,
  language: string,
): Data {
  const c = q.contentSnapshot!,
    cfg = c.config as Data;
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
