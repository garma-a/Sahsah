import * as s from "../../../database/schema/index.js";
import { requireState } from "../../platform/problem.js";
import { settings, points } from "../content.js";
import type { StartState } from "./types.js";
export function prepareQuestionMedia(
  state: StartState,
  gameId: string,
  q: typeof s.questions.$inferSelect,
  choice: StartState["selections"][number],
  qmedia: StartState["content"]["media"],
) {
  const {
    content: { assets },
  } = state;
  const pins: (typeof s.gameQuestionMedia.$inferInsert)[] = [];
  const stages = qmedia
    .filter((m) => m.mediaRole === "hint_image")
    .sort((a, b) => a.variantNumber - b.variantNumber);
  const cfg = settings(
    q.format,
    {
      ...q.formatConfig,
      ...(["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format)
        ? { stageSuggestions: stages.map((m) => m.suggestedPoints) }
        : {}),
    },
    points(q.slotNumber),
  );
  requireState(
    q.promptAr.trim().length > 0 &&
      q.promptAr.length <= 4000 &&
      q.answerAr.trim().length > 0 &&
      q.answerAr.length <= 4000 &&
      (!q.promptFranco || q.promptFranco.length <= 4000) &&
      (!q.answerFranco || q.answerFranco.length <= 4000),
    "CONTENT_NOT_READY",
  );
  const has = (role: string, variant = 0) =>
    qmedia.some((m) => m.mediaRole === role && m.variantNumber === variant);
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format))
    requireState(
      [0, 1, 2].every((v) => has("hint_image", v)) && has("answer_image"),
      "CONTENT_NOT_READY",
    );
  else if (q.format.startsWith("IMAGE_"))
    requireState(
      has("prompt_image") &&
        (["IMAGE_PERSON", "IMAGE_COLOR", "IMAGE_MEMORY"].includes(q.format)
          ? has("answer_image")
          : true),
      "CONTENT_NOT_READY",
    );
  if (q.format.startsWith("AUDIO_"))
    requireState(
      has("question_audio") &&
        (q.format !== "AUDIO_REVERSE" ||
          !cfg.allowForward ||
          has("answer_audio")),
      "CONTENT_NOT_READY",
    );
  const original = qmedia.find(
    (m) =>
      m.mediaRole ===
      (q.format.startsWith("AUDIO_") ? "source_audio" : "answer_image"),
  )?.mediaAssetId;
  const rendition = (role: string, operation: string, variant = 0) => {
    const m = qmedia.find(
        (m) => m.mediaRole === role && m.variantNumber === variant,
      ),
      asset = assets.find((a) => a.id === m?.mediaAssetId);
    requireState(
      asset &&
        original &&
        asset.id !== original &&
        asset.sourceAssetId === original &&
        asset.transformSpec.operation === operation,
      "UNSAFE_MEDIA_RENDITION",
    );
  };
  if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format))
    for (const stage of [0, 1, 2])
      rendition(
        "hint_image",
        q.format === "IMAGE_BLUR" ? "blur" : "crop",
        stage,
      );
  if (["IMAGE_PERSON", "IMAGE_COLOR"].includes(q.format))
    rendition(
      "prompt_image",
      q.format === "IMAGE_COLOR" ? "grayscale" : "crop",
    );
  if (q.format === "AUDIO_REVERSE") rendition("question_audio", "reverse");
  for (const m of qmedia) {
    if (m.mediaRole.startsWith("source_")) continue;
    const asset = assets.find((a) => a.id === m.mediaAssetId)!;
    requireState(
      asset.state === "ready" &&
        !asset.archivedAt &&
        asset.accessScope === "private" &&
        ["r2", "local"].includes(asset.storageProvider) &&
        asset.contentType &&
        asset.contentType.length <= 100 &&
        asset.byteSize !== null &&
        (asset.widthPx === null || asset.widthPx <= 16384) &&
        (asset.heightPx === null || asset.heightPx <= 16384),
      "CONTENT_NOT_READY",
    );
    requireState(
      (m.mediaRole.endsWith("audio") &&
        asset.mediaKind === "audio" &&
        asset.durationMs &&
        asset.durationMs <= 1800000) ||
        (!m.mediaRole.endsWith("audio") && asset.mediaKind === "image"),
      "CONTENT_NOT_READY",
    );
    pins.push({
      gameId,
      boardPosition: choice.boardPosition,
      questionPosition: q.slotNumber,
      mediaRole: m.mediaRole,
      variantNumber: m.variantNumber,
      mediaAssetId: m.mediaAssetId,
    });
  }

  return { cfg, pins };
}
