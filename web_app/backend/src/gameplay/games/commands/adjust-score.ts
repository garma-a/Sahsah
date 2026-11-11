import { type Handler } from "../command-types.js";
import { scoreChange } from "../rules/scoring.js";

export const adjust_score: Handler<"adjust_score"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const team = Number(body.teamNumber),
    before = team === 1 ? game.teamOneScore : game.teamTwoScore,
    after = BigInt(String(body.targetTotal));
  const change = scoreChange(before, after);
  if (before === after) return { kind: "unchanged" };
  return {
    kind: "changed",
    changes: team === 1 ? { teamOneScore: after } : { teamTwoScore: after },
    score: {
      scoreEntryKind: "manual_adjustment",
      scoreTeamNumber: team,
      scoreTotalBefore: before,
      scoreTotalAfter: after,
      scoreDelta: change.delta,
    },
  };
};
