import { open_question } from "./commands/open-question.js";
import { return_to_board } from "./commands/return-to-board.js";
import { advance_hint } from "./commands/advance-hint.js";
import { show_memory } from "./commands/show-memory.js";
import { hide_memory } from "./commands/hide-memory.js";
import { pause_timer } from "./commands/pause-timer.js";
import { resume_timer } from "./commands/resume-timer.js";
import { reset_timer } from "./commands/reset-timer.js";
import { reveal_answer } from "./commands/reveal-answer.js";
import { resolve_question } from "./commands/resolve-question.js";
import { adjust_score } from "./commands/adjust-score.js";
import { end_game } from "./commands/end-game.js";
import type { ActionContext, CommandBodies, CommandName, HandlerMap } from "./command-types.js";
export const commands: HandlerMap = {
  open_question,
  return_to_board,
  advance_hint,
  show_memory,
  hide_memory,
  pause_timer,
  resume_timer,
  reset_timer,
  reveal_answer,
  resolve_question,
  adjust_score,
  end_game,
};
export function handleCommand<N extends CommandName>(
  name: N,
  context: ActionContext,
  body: CommandBodies[N],
) {
  return commands[name]({ ...context, body });
}
