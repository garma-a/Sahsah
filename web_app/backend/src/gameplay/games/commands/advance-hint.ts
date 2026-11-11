import { type Handler } from "../command-types.js";
import { requireState } from "../../platform/problem.js";
import { loadQuestion, currentQuestion, unrevealed, writeQuestion, changed } from "./question.js";
export const advance_hint: Handler<"advance_hint"> = async (ctx) => {
  const { body, game } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  unrevealed(q);
  requireState(
    ["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format) && q.stageIndex < 2,
    "HINT_UNAVAILABLE",
  );
  await writeQuestion(ctx, q, { stageIndex: q.stageIndex + 1 });
  return changed();
};
