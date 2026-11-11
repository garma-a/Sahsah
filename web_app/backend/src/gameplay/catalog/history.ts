import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import type { Tx } from "../platform/types.js";

export function completionHistory(
  db: Tx,
  accountId: string,
  packIds: string[],
) {
  const copied = db
    .select({ questionId: s.gameQuestions.sourceQuestionId })
    .from(s.gameQuestions)
    .where(
      and(
        eq(s.gameQuestions.gameId, s.accountPackCompletions.gameId),
        eq(
          s.gameQuestions.boardPosition,
          s.accountPackCompletions.boardPosition,
        ),
        eq(s.gameQuestions.sourceQuestionId, s.questions.id),
      ),
    );
  const unseen = db
    .select({ questionId: s.questions.id })
    .from(s.questions)
    .where(
      and(
        eq(s.questions.packId, s.gamePacks.packId),
        isNull(s.questions.retiredAt),
        notExists(copied),
      ),
    );
  return db
    .select({
      packId: s.gamePacks.packId,
      // PostgreSQL's bool_or aggregate has no Drizzle aggregate helper in 0.45.
      current: sql<boolean>`bool_or(${notExists(unseen)})`,
    })
    .from(s.accountPackCompletions)
    .innerJoin(
      s.gamePacks,
      and(
        eq(s.gamePacks.gameId, s.accountPackCompletions.gameId),
        eq(s.gamePacks.boardPosition, s.accountPackCompletions.boardPosition),
      ),
    )
    .where(
      and(
        eq(s.accountPackCompletions.accountId, accountId),
        inArray(s.gamePacks.packId, packIds),
      ),
    )
    .groupBy(s.gamePacks.packId);
}
