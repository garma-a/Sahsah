import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { hintStages } from "../content.js";
import { loadQuestion, currentQuestion, unrevealed, writeQuestion, changed } from "./question.js";
export const advance_hint: Handler<"advance_hint"> = async (ctx) => {
  const { body, game } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  requireState(
    q.stageIndex < hintStages(q) - 1,
    "HINT_UNAVAILABLE",
  );
  await writeQuestion(ctx, q, { stageIndex: q.stageIndex + 1 });
  return changed();
};
