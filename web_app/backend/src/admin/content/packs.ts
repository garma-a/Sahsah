import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { SahsahDatabase } from "../../database/connection.js";
import { mediaAssets, gameQuestions, questionFormats, questionMedia, questions } from "../../database/schema/index.js";
import { questionContentIssues, type ContentIssue } from "../../gameplay/games/rules/question-content.js";

export type PackIssue = ContentIssue & { slot: number };

type Question = typeof questions.$inferSelect;
export type PackContent = {
  questions: Question[];
  media: (typeof questionMedia.$inferSelect)[];
  assets: (typeof mediaAssets.$inferSelect)[];
  /** The composed formats the questions use, whether or not they are archived. */
  formats: (typeof questionFormats.$inferSelect)[];
};

/** The current (not retired) questions of the packs, with their media pins and files. */
export async function loadPackContent(db: SahsahDatabase, packIds: string[], lock = false): Promise<PackContent> {
  if (!packIds.length) return { questions: [], media: [], assets: [], formats: [] };
  const base = db
    .select()
    .from(questions)
    .where(and(inArray(questions.packId, packIds), isNull(questions.retiredAt)))
    .orderBy(questions.packId, questions.slotNumber);
  const current = await (lock ? base.for("share") : base);
  const ids = current.map((q) => q.id);
  const media = ids.length ? await db.select().from(questionMedia).where(inArray(questionMedia.questionId, ids)) : [];
  const assetIds = [...new Set(media.map((m) => m.mediaAssetId))];
  const assets = assetIds.length ? await db.select().from(mediaAssets).where(inArray(mediaAssets.id, assetIds)) : [];
  const formatIds = [...new Set(current.flatMap((q) => (q.composedFormatId ? [q.composedFormatId] : [])))];
  const formats = formatIds.length ? await db.select().from(questionFormats).where(inArray(questionFormats.id, formatIds)) : [];
  return { questions: current, media, assets, formats };
}

/** Problems that keep one pack from being published or started, per slot. Empty means it is playable. */
export function packIssues(content: PackContent, packId: string): PackIssue[] {
  const issues: PackIssue[] = [];
  const mine = content.questions.filter((q) => q.packId === packId);
  for (let slot = 1; slot <= 6; slot++) {
    const question = mine.find((q) => q.slotNumber === slot);
    if (!question) {
      issues.push({ slot, code: "missing_question", message: "This slot has no question yet." });
      continue;
    }
    const pins = content.media.filter((m) => m.questionId === question.id);
    const files = content.assets.filter((a) => pins.some((p) => p.mediaAssetId === a.id));
    const row = content.formats.find((f) => f.id === question.composedFormatId);
    const composed = row && { code: row.code, nameEn: row.nameEn, labelAr: row.labelAr, baseKind: row.baseKind as "text", stageKinds: row.stageKinds as ("image" | "audio")[], answerKind: row.answerKind as "none", showPrompt: row.showPrompt };
    for (const issue of questionContentIssues(question, pins, files, composed)) issues.push({ ...issue, slot });
  }
  return issues;
}

/** Played, liked and disliked counts per question, from the games that copied it. Uses game_questions_source_history. */
export async function questionStats(db: SahsahDatabase, questionIds: string[]) {
  if (!questionIds.length) return new Map<string, { played: number; likes: number; dislikes: number }>();
  const rows = await db
    .select({
      id: gameQuestions.sourceQuestionId,
      played: sql<number>`count(*) FILTER (WHERE ${gameQuestions.firstOpenedAt} IS NOT NULL)::int`,
      likes: sql<number>`count(*) FILTER (WHERE ${gameQuestions.feedbackVote} = 'like')::int`,
      dislikes: sql<number>`count(*) FILTER (WHERE ${gameQuestions.feedbackVote} = 'dislike')::int`,
    })
    .from(gameQuestions)
    .where(inArray(gameQuestions.sourceQuestionId, questionIds))
    .groupBy(gameQuestions.sourceQuestionId);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function retiredQuestions(db: SahsahDatabase, packId: string) {
  return db
    .select({ id: questions.id, slot: questions.slotNumber, format: questions.format, promptAr: questions.promptAr, retiredAt: questions.retiredAt })
    .from(questions)
    .where(and(eq(questions.packId, packId), isNotNull(questions.retiredAt)))
    .orderBy(questions.slotNumber, questions.id)
    .limit(60);
}

