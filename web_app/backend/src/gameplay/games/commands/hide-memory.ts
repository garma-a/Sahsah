import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { loadQuestion, currentQuestion, unrevealed, running, writeQuestion, changed, type QuestionChanges } from "./question.js";
export const hide_memory: Handler<"hide_memory"> = async (ctx) => {
  const { body, game, now } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  requireState(
    q.format === "IMAGE_MEMORY" && q.memoryImageVisible,
    "MEMORY_UNAVAILABLE",
  );
  const qc: QuestionChanges = { memoryImageVisible: false };
  if (!q.memoryFirstHiddenAt) {
    qc.memoryFirstHiddenAt = now.toISOString();
    Object.assign(qc, running(now, 60000));
  }
  await writeQuestion(ctx, q, qc);
  return changed();
};
