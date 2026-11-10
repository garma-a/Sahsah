import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import * as s from "../database/schema/index.js";
import { digest } from "./proof.js";
import { local } from "./content.js";
import { id } from "./contract.js";
import { requireState } from "./problem.js";
import {
  GameplayService,
  type Actor,
  type Member,
  type Tx,
} from "./service.js";
import type { Data } from "./ports.js";

export function language(value?: string) {
  requireState(
    value === undefined || value === "ar" || value === "franco",
    "INVALID_LANGUAGE",
    400,
  );
  return value ?? "ar";
}
function paging(query: Record<string, unknown>, fallback: number) {
  const limit = query.limit === undefined ? fallback : Number(query.limit);
  requireState(
    Number.isInteger(limit) && limit >= 1 && limit <= 50,
    "INVALID_LIMIT",
    400,
  );
  let cursor: [number, string] = [-1, "00000000-0000-0000-0000-000000000000"];
  if (query.cursor !== undefined) {
    try {
      requireState(
        typeof query.cursor === "string" && query.cursor.length <= 512,
        "INVALID_CURSOR",
        400,
      );
      cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
    } catch {
      requireState(false, "INVALID_CURSOR", 400);
    }
    requireState(
      Array.isArray(cursor) &&
        cursor.length === 2 &&
        Number.isSafeInteger(cursor[0]) &&
        cursor[0] >= 0,
      "INVALID_CURSOR",
      400,
    );
    id(cursor[1]);
  }
  return { limit, cursor };
}
const next = (n: number, id: string) =>
  Buffer.from(JSON.stringify([n, id])).toString("base64url");

@Injectable()
export class CatalogService {
  constructor(private core: GameplayService) {}
  async categories(query: Record<string, unknown>): Promise<Data> {
    this.core.enabled();
    const lang = language(query.language as string | undefined),
      { limit, cursor } = paging(query, 20);
    // Counts only packs a host can start: six current questions.
    const result = await this.core.database.db
      .execute(sql`SELECT c.id,c.name_ar,c.name_franco,c.display_order,c.description_ar,c.description_franco,
      g.id AS section_id,g.name_ar AS section_ar,g.name_franco AS section_franco,g.display_order AS section_order,
      (SELECT m.storage_key FROM media_assets m WHERE m.id=c.cover_media_asset_id AND m.state='ready' AND m.access_scope='public' AND m.archived_at IS NULL) AS cover_key,
      (SELECT count(*)::int FROM question_packs p WHERE p.category_id=c.id AND p.publication_state='published' AND p.archived_at IS NULL
        AND (SELECT count(*) FROM questions q WHERE q.pack_id=p.id AND q.retired_at IS NULL)=6) AS count
      FROM categories c LEFT JOIN category_sections g ON g.id=c.section_id
      WHERE c.archived_at IS NULL AND (c.display_order,c.id)>(${cursor[0]},${cursor[1]}::uuid)
      ORDER BY c.display_order,c.id LIMIT ${limit + 1}`);
    const rows = result.rows as {
      id: string;
      name_ar: string;
      name_franco: string | null;
      display_order: number;
      description_ar: string | null;
      description_franco: string | null;
      section_id: string | null;
      section_ar: string;
      section_franco: string | null;
      section_order: number;
      cover_key: string | null;
      count: number;
    }[];
    const covers = this.core.options.publicMediaBaseUrl;
    return {
      items: rows.slice(0, limit).map((r) => ({
        id: r.id,
        name: local(r.name_ar, r.name_franco, lang),
        ...(r.description_ar
          ? {
              description: local(r.description_ar, r.description_franco, lang),
            }
          : {}),
        ...(r.section_id
          ? {
              section: {
                id: r.section_id,
                name: local(r.section_ar, r.section_franco, lang),
                displayOrder: r.section_order,
              },
            }
          : {}),
        ...(covers && r.cover_key
          ? { coverUrl: `${covers}/${r.cover_key}` }
          : {}),
        publishedPackCount: r.count,
      })),
      ...(rows.length > limit
        ? {
            nextCursor: next(rows[limit - 1].display_order, rows[limit - 1].id),
          }
        : {}),
    };
  }
  async eligibility(
    db: Tx,
    pack: typeof s.questionPacks.$inferSelect,
    members: Member[],
  ) {
    return (await this.eligibilities(db, [pack], members)).get(pack.id)!;
  }
  async eligibilities(
    db: Tx,
    packs: (typeof s.questionPacks.$inferSelect)[],
    members: Member[],
  ) {
    const questions = packs.length
      ? await db
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
          .orderBy(s.questions.packId, s.questions.slotNumber)
      : [];
    const accounts = members
      .flatMap((m) => (m.accountId ? [m.accountId] : []))
      .sort();
    const exposures =
      accounts.length && questions.length
        ? await db
            .select()
            .from(s.accountQuestionExposures)
            .where(
              and(
                inArray(s.accountQuestionExposures.accountId, accounts),
                inArray(
                  s.accountQuestionExposures.questionId,
                  questions.map((q) => q.id),
                ),
              ),
            )
        : [];
    return new Map(
      packs.map((pack) => {
        const qs = questions.filter((q) => q.packId === pack.id),
          ids = new Set(qs.map((q) => q.id)),
          es = exposures.filter((e) => ids.has(e.questionId));
        const basis = digest("pack-eligibility-v1", pack.id, {
          revision: String(pack.contentRevision),
          roster: members
            .map((m) => ({
              id: m.id,
              accountId: m.accountId,
              team: m.lobbyTeamNumber,
            }))
            .sort((a, b) => (a.id < b.id ? -1 : 1)),
          questions: qs.map((q) => q.id),
          exposures: es.map((e) => `${e.accountId}:${e.questionId}`).sort(),
        }).toString("hex");
        return [
          pack.id,
          { questions: qs, exposures: es, basis, fresh: es.length === 0 },
        ];
      }),
    );
  }
  async packs(
    actor: Actor | undefined,
    categoryId: string,
    query: Record<string, unknown>,
  ): Promise<Data> {
    this.core.enabled();
    language(query.language as string | undefined);
    const { limit, cursor } = paging(query, 20);
    requireState(
      query.freshOnly === undefined ||
        query.freshOnly === "true" ||
        query.freshOnly === "false",
      "INVALID_FILTER",
      400,
    );
    const roomId = query.roomId === undefined ? undefined : id(query.roomId);
    return this.core.database.transaction(
      async (db) => {
        let members: Member[] = [];
        if (roomId) {
          requireState(actor, "UNAUTHENTICATED", 401);
          const room = await this.core.room(db, roomId, false);
          await this.core.membership(db, room, actor);
          members = await this.core.members(db, roomId);
        } else if (actor?.account)
          members = [
            {
              id: actor.account.accountId,
              accountId: actor.account.accountId,
              lobbyTeamNumber: null,
            } as Member,
          ];
        const rows = await db
          .select()
          .from(s.questionPacks)
          .where(
            and(
              eq(s.questionPacks.categoryId, categoryId),
              eq(s.questionPacks.publicationState, "published"),
              isNull(s.questionPacks.archivedAt),
              sql`(${s.questionPacks.packNumber},${s.questionPacks.id}) > (${cursor[0]},${cursor[1]}::uuid)`,
            ),
          )
          .orderBy(s.questionPacks.packNumber, s.questionPacks.id)
          .limit(50);
        const eligibility = await this.eligibilities(db, rows, members);
        const own = actor?.account?.accountId;
        const history =
          own && rows.length
            ? await db.execute(sql`SELECT p.pack_id, bool_or(NOT EXISTS(SELECT 1 FROM questions q WHERE q.pack_id=p.pack_id AND q.retired_at IS NULL AND NOT EXISTS(SELECT 1 FROM game_questions gq WHERE gq.game_id=c.game_id AND gq.board_position=c.board_position AND gq.source_question_id=q.id))) AS current
        FROM account_pack_completions c JOIN game_packs p USING(game_id,board_position) WHERE c.account_id=${own} AND p.pack_id IN (${sql.join(
          rows.map((p) => sql`${p.id}::uuid`),
          sql`,`,
        )}) GROUP BY p.pack_id`)
            : { rows: [] };
        const items: Data[] = [];
        let scanned: (typeof rows)[number] | undefined;
        for (const pack of rows) {
          scanned = pack;
          const e = eligibility.get(pack.id)!;
          if (e.questions.length !== 6) continue;
          if (query.freshOnly === "true" && !e.fresh) continue;
          let progress: Data | undefined;
          if (own) {
            const row = history.rows.find((r) => r.pack_id === pack.id) as
              { current: boolean } | undefined;
            progress = {
              completed: row?.current ?? false,
              updated: !!row && !row.current,
              exposed: e.exposures.some((x) => x.accountId === own),
            };
          }
          items.push({
            id: pack.id,
            categoryId,
            packNumber: pack.packNumber,
            contentRevision: String(pack.contentRevision),
            questionCount: 6,
            ...(progress ? { progress } : {}),
            ...(roomId
              ? {
                  freshForGroup: e.fresh,
                  repeatRequired: !e.fresh,
                  eligibilityBasis: e.basis,
                }
              : {}),
          });
          if (items.length === limit) break;
        }
        return {
          items,
          ...(scanned && (rows.length === 50 || scanned.id !== rows.at(-1)?.id)
            ? { nextCursor: next(scanned.packNumber, scanned.id) }
            : {}),
        };
      },
      { consistentRead: true },
    );
  }
}
