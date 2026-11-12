import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { loadQuestion, currentQuestion, unrevealed, answering, checkpoint, writeQuestion, changed } from "./question.js";
export const pause_timer: Handler<"pause_timer"> = async (ctx) => {
  const { body, game, now } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  answering(q);
  requireState(q.timerState === "running", "TIMER_NOT_RUNNING");
  await writeQuestion(ctx, q, checkpoint(q, now));
  return changed();
};
