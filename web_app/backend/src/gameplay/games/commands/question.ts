import * as s from "../../../database/schema/index.js";
import { checkedQuestionColumns, remaining } from "../content.js";
import { single } from "../../platform/invariant.js";
import { requireState } from "../../platform/problem.js";
import type { Game, Question } from "../../platform/types.js";
import type { ActionContext, Command, CommandEffect } from "../command-types.js";
export type QuestionChanges = Partial<typeof s.gameQuestions.$inferInsert>;
export async function loadQuestion(
  context: ActionContext,
  body: Extract<Command, { boardPosition: number }>,
) {
  const { db, game, operations } = context;
  const q = (
    await db
      .select()
      .from(s.gameQuestions)
      .where(
        operations.slot({
          gameId: game.id,
          boardPosition: Number(body.boardPosition),
          questionPosition: Number(body.questionPosition),
        }),
      )
  )[0];
  requireState(q && !q.resolvedAt, "QUESTION_UNAVAILABLE");
  return q;
}
export function currentQuestion(game: Game, q: Question) {
  requireState(
    game.activeBoardPosition === q.boardPosition &&
      game.activeQuestionPosition === q.questionPosition &&
      q.firstOpenedAt,
    "QUESTION_NOT_CURRENT",
  );
}
export function unrevealed(q: Question) {
  requireState(!q.revealedAt, "ANSWER_ALREADY_REVEALED");
}
export function answering(q: Question) {
  requireState(
    q.format !== "IMAGE_MEMORY" || q.memoryFirstHiddenAt,
    "MEMORY_HIDE_REQUIRED",
  );
}
export function checkpoint(
  q: Question,
  now: Date,
  navigation = false,
): QuestionChanges {
  const ms = remaining(q, now);
  return {
    timerState: ms ? "paused" : "elapsed",
    remainingMs: ms,
    timerDeadlineAt: null,
    resumeTimerOnReopen: ms > 0 && navigation,
  };
}
export function running(now: Date, ms: number): QuestionChanges {
  return {
    timerState: "running",
    remainingMs: ms,
    timerDeadlineAt: new Date(now.getTime() + ms).toISOString(),
    resumeTimerOnReopen: false,
  };
}
export async function writeQuestion(
  context: ActionContext,
  q: Question,
  changes: QuestionChanges,
) {
  if (Object.keys(changes).length)
    single(
      await context.db
        .update(s.gameQuestions)
        .set(changes)
        .where(context.operations.slot(q))
        .returning(checkedQuestionColumns),
      "GAMEQUESTIONS_WRITE_ROW",
    );
}
export const changed = (changes: Partial<Game> = {}): CommandEffect => ({
  kind: "changed",
  changes,
});
