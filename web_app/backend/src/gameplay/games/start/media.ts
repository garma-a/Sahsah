import { randomBytes } from "node:crypto";
import * as s from "../../../database/schema/index.js";
import { requireState } from "../../platform/problem.js";
import { settings, points } from "../content.js";
import { questionContentIssues } from "../rules/question-content.js";
import { snapshotOf, type ComposedDefinition } from "../rules/composed-format.js";
import type { StartState } from "./types.js";
export function prepareQuestionMedia(
  state: StartState,
  gameId: string,
  q: typeof s.questions.$inferSelect,
  choice: StartState["selections"][number],
  qmedia: StartState["content"]["media"],
) {
  const {
    content: { assets, formats },
  } = state;
  const row = formats.find((f) => f.id === q.composedFormatId);
  const composed = row && snapshotOf({ ...row, baseKind: row.baseKind as ComposedDefinition["baseKind"], stageKinds: row.stageKinds as ComposedDefinition["stageKinds"], answerKind: row.answerKind as ComposedDefinition["answerKind"] });
  const pins: (typeof s.gameQuestionMedia.$inferInsert)[] = [];
  const stages = qmedia
    .filter((m) => m.mediaRole === "hint_image" || m.mediaRole === "hint_audio")
    .sort((a, b) => a.variantNumber - b.variantNumber);
  const cfg = settings(
    q.format,
    {
      ...q.formatConfig,
      ...(["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format)
        ? { stageSuggestions: stages.map((m) => m.suggestedPoints) }
        : {}),
      // Clue stage 0 is the bare picture at the tile's value; each card lowers it.
      ...(q.format === "IMAGE_CLUES"
        ? {
            stageSuggestions: [
              points(q.slotNumber),
              ...stages.map((m) => m.suggestedPoints),
            ],
          }
        : {}),
      ...(q.format === "COMPOSED" && composed && composed.stageKinds.length
        ? { stageSuggestions: [points(q.slotNumber), ...stages.map((m) => m.suggestedPoints)] }
        : {}),
      // Each game gets its own card link, so an old code never opens a new game's card.
      ...(q.format === "CHARADES"
        ? { cardToken: randomBytes(16).toString("base64url") }
        : {}),
    },
    points(q.slotNumber),
  );
  // The same rules the staff dashboard checks before publishing.
  const issues = questionContentIssues(
    q,
    qmedia,
    qmedia.map((m) => assets.find((a) => a.id === m.mediaAssetId)).filter((a) => a !== undefined),
    composed,
  );
  requireState(issues.every((i) => i.lineage), "CONTENT_NOT_READY");
  requireState(issues.length === 0, "UNSAFE_MEDIA_RENDITION");
  for (const m of qmedia) {
    if (m.mediaRole.startsWith("source_")) continue;
    pins.push({
      gameId,
      boardPosition: choice.boardPosition,
      questionPosition: q.slotNumber,
      mediaRole: m.mediaRole,
      variantNumber: m.variantNumber,
      mediaAssetId: m.mediaAssetId,
    });
  }

  return { cfg, pins, composed };
}
