import { sql } from "drizzle-orm";

/** The one place that decides what lands in the "needs attention" queues that are not a plain state. */
export const QUEUE_RULES = {
  /** A draft pack with fewer current questions than this is unfinished (one per slot). */
  draftSlotsRequired: 6,
  /** A question needs at least this many votes before its dislike share counts. */
  dislikeMinVotes: 20,
  /** ...and at least this share of those votes must be dislikes. */
  dislikeMinSharePercent: 40,
} as const;

/**
 * Unfinished drafts: a draft, not archived pack of an active category with fewer than six current
 * questions. Cheap on purpose: one partial index plus the current-slot index per pack. A complete
 * draft that still fails publish validation is not listed here; its pack page shows the problems.
 * Used by both the home count and the Content list so the two always agree.
 */
export const incompleteDraftsFrom = sql`
  FROM question_packs p
  JOIN categories c ON c.id = p.category_id AND c.archived_at IS NULL
  WHERE p.publication_state = 'draft' AND p.archived_at IS NULL
    AND (SELECT count(*) FROM questions q WHERE q.pack_id = p.id AND q.retired_at IS NULL) < ${QUEUE_RULES.draftSlotsRequired}`;

/**
 * Current questions whose votes are mostly dislikes. The totals come from the vote index alone;
 * only the few questions over the threshold are looked up afterwards.
 */
export const dislikedQuestionVotes = sql`
  SELECT source_question_id AS question_id, count(*)::int AS votes,
         (count(*) FILTER (WHERE feedback_vote = 'dislike'))::int AS dislikes
  FROM game_questions WHERE feedback_vote IS NOT NULL
  GROUP BY source_question_id
  HAVING count(*) >= ${QUEUE_RULES.dislikeMinVotes}
     AND count(*) FILTER (WHERE feedback_vote = 'dislike') * 100 >= ${QUEUE_RULES.dislikeMinSharePercent} * count(*)`;
