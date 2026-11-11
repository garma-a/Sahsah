import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { loadQuestion, currentQuestion, unrevealed, answering, running, writeQuestion, changed } from "./question.js";
export const reset_timer: Handler<"reset_timer"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  answering(q);
  requireState(q.timerState !== "ready", "TIMER_NOT_STARTED");
  await writeQuestion(ctx, q, running(now, 60000));
  return changed();
};
