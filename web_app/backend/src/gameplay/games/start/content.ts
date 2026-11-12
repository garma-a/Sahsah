import { and, inArray, isNull } from "drizzle-orm";

import * as s from "../../../database/schema/index.js";

import type { Tx } from "../../service.js";
import type { Selections } from "./types.js";
export async function lockStartContent(db: Tx, selections: Selections) {
  // Stable catalog locks prevent publication/media edits racing the copy.
  const categories = await db
    .select()
    .from(s.categories)
    .where(inArray(s.categories.id, selections.map((p) => p.categoryId).sort()))
    .orderBy(s.categories.id)
    .for("share");
  const packs = await db
    .select()
    .from(s.questionPacks)
    .where(inArray(s.questionPacks.id, selections.map((p) => p.packId).sort()))
    .orderBy(s.questionPacks.id)
    .for("share");
  const questions = await db
    .select()
    .from(s.questions)
    .where(
      and(
        inArray(
          s.questions.packId,
          packs.map((p) => p.id),
        ),
        isNull(s.questions.retiredAt),
      ),
    )
    .orderBy(s.questions.id)
    .for("share");
  const media = await db
    .select()
    .from(s.questionMedia)
    .where(
      inArray(
        s.questionMedia.questionId,
        questions.map((q) => q.id),
      ),
    )
    .orderBy(
      s.questionMedia.questionId,
      s.questionMedia.mediaRole,
      s.questionMedia.variantNumber,
    )
    .for("share");
  const assets = media.length
    ? await db
        .select()
        .from(s.mediaAssets)
        .where(
          inArray(
            s.mediaAssets.id,
            [...new Set(media.map((m) => m.mediaAssetId))].sort(),
          ),
        )
        .orderBy(s.mediaAssets.id)
        .for("share")
    : [];

  return { categories, packs, questions, media, assets };
}
