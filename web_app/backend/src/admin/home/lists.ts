import { sql } from "drizzle-orm";
import type { SahsahDatabase } from "../../database/connection.js";
import { StaffError } from "../staff-service.js";
import { dislikedQuestionVotes, incompleteDraftsFrom } from "./queues.js";

export const LIST_PAGE_SIZE = 25;
const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
const UUID = /^[0-9a-f-]{36}$/;

/** The Content lists the Home queues link to. Same definitions as the counts, in `queues.ts`. */
export async function incompleteDrafts(db: SahsahDatabase, cursor: string) {
  const match = cursor ? CURSOR.exec(cursor) : null;
  if (cursor && !match) throw new StaffError("invalid_cursor");
  const rows = (await db.execute(sql`
    SELECT p.id, p.pack_number, p.created_at::text AS created_at, c.id AS category_id, c.name_ar AS category_name_ar,
           (SELECT count(*)::int FROM questions q WHERE q.pack_id = p.id AND q.retired_at IS NULL) AS filled
    ${incompleteDraftsFrom}
    ${match ? sql`AND (p.created_at, p.id) > (${match[1]}::timestamptz, ${match[2]}::uuid)` : sql``}
    ORDER BY p.created_at, p.id LIMIT ${LIST_PAGE_SIZE + 1}`)).rows as { id: string; pack_number: number; created_at: string; category_id: string; category_name_ar: string; filled: number }[];
  const page = rows.slice(0, LIST_PAGE_SIZE), last = page.at(-1);
  return {
    rows: page.map((r) => ({ id: r.id, packNumber: r.pack_number, createdAt: r.created_at, categoryId: r.category_id, categoryNameAr: r.category_name_ar, filled: r.filled })),
    nextCursor: rows.length > LIST_PAGE_SIZE && last ? `${last.created_at}|${last.id}` : null,
  };
}

export async function dislikedQuestions(db: SahsahDatabase, cursor: string) {
  if (cursor && !UUID.test(cursor)) throw new StaffError("invalid_cursor");
  const rows = (await db.execute(sql`
    SELECT q.id, q.slot_number, q.prompt_ar, v.votes, v.dislikes, p.id AS pack_id, p.pack_number, c.name_ar AS category_name_ar
    FROM (${dislikedQuestionVotes}) v
    JOIN questions q ON q.id = v.question_id AND q.retired_at IS NULL
    JOIN question_packs p ON p.id = q.pack_id
    JOIN categories c ON c.id = p.category_id
    ${cursor ? sql`WHERE v.question_id > ${cursor}::uuid` : sql``}
    ORDER BY v.question_id LIMIT ${LIST_PAGE_SIZE + 1}`)).rows as { id: string; slot_number: number; prompt_ar: string; votes: number; dislikes: number; pack_id: string; pack_number: number; category_name_ar: string }[];
  const page = rows.slice(0, LIST_PAGE_SIZE), last = page.at(-1);
  return {
    rows: page.map((r) => ({ id: r.id, slot: r.slot_number, promptAr: r.prompt_ar.slice(0, 140), votes: r.votes, dislikes: r.dislikes, packId: r.pack_id, packNumber: r.pack_number, categoryNameAr: r.category_name_ar })),
    nextCursor: rows.length > LIST_PAGE_SIZE && last ? last.id : null,
  };
}
