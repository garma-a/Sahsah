import * as s from "../../../database/schema/index.js";
import { requireState } from "../../problem.js";
import { written } from "../../invariant.js";
import { points } from "../../content.js";
import { prepareQuestionMedia } from "./media.js";
import type { StartState } from "./types.js";
export async function copyQuestionSnapshots(state: StartState, gameId: string) {
  const {
    db,
    selections,
    content: { questions, media },
  } = state;
  const copied: (typeof s.gameQuestions.$inferInsert)[] = [],
    pins: (typeof s.gameQuestionMedia.$inferInsert)[] = [];
  for (const q of questions) {
    const choice = selections.find((p) => p.packId === q.packId)!;
    const qmedia = media.filter((m) => m.questionId === q.id);
    const prepared = prepareQuestionMedia(state, gameId, q, choice, qmedia);
    const cfg = prepared.cfg;
    pins.push(...prepared.pins);
    copied.push({
      gameId,
      boardPosition: choice.boardPosition,
      questionPosition: q.slotNumber,
      sourceQuestionId: q.id,
      basePoints: points(q.slotNumber),
      format: q.format,
      contentSnapshot: {
        promptAr: q.promptAr,
        promptFranco: q.promptFranco,
        answerAr: q.answerAr,
        answerFranco: q.answerFranco,
        config: cfg,
      },
    });
  }
  requireState(copied.length === 36, "CONTENT_NOT_READY");
  await written(
    db.insert(s.gameQuestions).values(copied).returning(),
    copied.length,
    "GAMEQUESTIONS_WRITE_COUNT",
  );
  if (pins.length)
    await written(
      db.insert(s.gameQuestionMedia).values(pins).returning(),
      pins.length,
      "GAMEQUESTIONMEDIA_WRITE_COUNT",
    );
}
