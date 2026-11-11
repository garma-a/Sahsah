import { type Handler } from "../command-types.js";
import { loadQuestion, currentQuestion, unrevealed, answering, checkpoint, running, writeQuestion, changed, type QuestionChanges } from "./question.js";
export const reveal_answer: Handler<"reveal_answer"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  answering(q);
  const qc: QuestionChanges = q.timerState === "running" ? checkpoint(q, now) : {};
  qc.revealedAt = now.toISOString();
  qc.resumeTimerOnReopen = false;
  if (q.format === "IMAGE_MEMORY") qc.memoryImageVisible = true;
  await writeQuestion(ctx, q, qc);
  return changed();
};
