import { type Handler } from "../command-types.js";
import {
  loadQuestion,
  currentQuestion,
  checkpoint,
  writeQuestion,
  changed,
} from "./question.js";
export const return_to_board: Handler<"return_to_board"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  const qc = q.timerState === "running" ? checkpoint(q, now, true) : {};
  await writeQuestion(ctx, q, qc);
  return changed({ activeBoardPosition: null, activeQuestionPosition: null });
};
