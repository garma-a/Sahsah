import { type Handler } from "../command-types.js";
import { requireState } from "../../problem.js";
import {
  loadQuestion,
  currentQuestion,
  unrevealed,
  answering,
  running,
  writeQuestion,
  changed,
} from "./question.js";
export const resume_timer: Handler<"resume_timer"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  answering(q);
  requireState(q.timerState === "paused", "TIMER_NOT_PAUSED");
  await writeQuestion(ctx, q, running(now, q.remainingMs));
  return changed();
};
