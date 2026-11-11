import { type Handler } from "../command-types.js";
import { requireState } from "../../problem.js";
import { loadQuestion, currentQuestion, unrevealed, writeQuestion, changed } from "./question.js";
export const show_memory: Handler<"show_memory"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  requireState(q.format === "IMAGE_MEMORY" && !q.memoryImageVisible, "MEMORY_UNAVAILABLE");
  await writeQuestion(ctx, q, { memoryFirstShownAt: q.memoryFirstShownAt ?? now.toISOString(), memoryImageVisible: true });
  return changed();
};
