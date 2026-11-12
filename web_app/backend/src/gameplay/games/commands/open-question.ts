import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { loadQuestion, running, writeQuestion, changed, type QuestionChanges } from "./question.js";
export const open_question: Handler<"open_question"> = async (ctx) => {
  const { body, game, now, db, operations } = ctx;
  const q = await loadQuestion(ctx, body);
  requireState(game.activeBoardPosition === null, "RETURN_TO_BOARD_FIRST");
  const changes = {
    activeBoardPosition: q.boardPosition,
    activeQuestionPosition: q.questionPosition,
    firstQuestionOpenedAt: game.firstQuestionOpenedAt ?? now.toISOString(),
  };
  const qc: QuestionChanges = {};
  if (!q.firstOpenedAt) {
    qc.firstOpenedAt = now.toISOString();
    if (q.format !== "IMAGE_MEMORY") Object.assign(qc, running(now, 60000));
    await operations.exposure(db, game, q, now);
  } else if (q.resumeTimerOnReopen && !q.revealedAt)
    Object.assign(qc, running(now, q.remainingMs));
  await writeQuestion(ctx, q, qc);
  return changed(changes);
};
