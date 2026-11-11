import { type Handler, type ScoreEntry } from "../command-types.js";
import type { Game } from "../../platform/types.js";
import { requireState } from "../../platform/problem.js";
import { suggested } from "../content.js";
import { questionAward } from "../rules/scoring.js";
import { loadQuestion, currentQuestion, writeQuestion, type QuestionChanges } from "./question.js";
export const resolve_question: Handler<"resolve_question"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  const q = await loadQuestion(ctx, body);
  currentQuestion(game, q);
  requireState(q.revealedAt, "ANSWER_NOT_REVEALED");
  const winner = body.winningTeamNumber;
  requireState(
    winner !== null ||
      body.awardedPoints === undefined ||
      body.awardedPoints === 0,
    "INVALID_AWARD",
    400,
  );
  const award = questionAward(winner, body.awardedPoints, suggested(q));
  requireState(award <= q.basePoints, "AWARD_EXCEEDS_CAP", 400);
  const qc: QuestionChanges = {
    winningTeamNumber: winner,
    awardedPoints: award,
    resolvedAt: now.toISOString(),
    resolvedByAccountId: game.hostAccountId,
    resolutionCommandId: operationId,
    resumeTimerOnReopen: false,
  };
  const changes: Partial<Game> = {
    activeBoardPosition: null,
    activeQuestionPosition: null,
  };
  let score: ScoreEntry = {};
  if (winner !== null) {
    const before = winner === 1 ? game.teamOneScore : game.teamTwoScore,
      after = before + BigInt(award);
    Object.assign(
      changes,
      winner === 1 ? { teamOneScore: after } : { teamTwoScore: after },
    );
    score = {
      scoreEntryKind: "question_award",
      scoreTeamNumber: winner,
      scoreDelta: BigInt(award),
      scoreTotalBefore: before,
      scoreTotalAfter: after,
      scoreSourceBoardPosition: q.boardPosition,
      scoreSourceQuestionPosition: q.questionPosition,
    };
  }
  await writeQuestion(ctx, q, qc);
  await operations.completion(db, game, q, now);
  return { kind: "changed", changes, score };
};
