import { completionHistory } from "./history.js";
import { DatabaseService } from "../../database/database.module.js";
import { RoomAccess } from "../rooms/access.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { scoped } from "../platform/logging.js";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, inArray, isNull, or } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import { digest } from "../platform/proof.js";
import { local } from "../games/content.js";
import { id } from "../contract.js";
import { requireState } from "../platform/problem.js";
import type { Actor, Member, Tx } from "../platform/types.js";
import type { Contract } from "../contract.js";
import { invariant } from "../platform/invariant.js";
type RosterMember = Pick<Member, "id" | "accountId" | "lobbyTeamNumber">;

export function language(value?: unknown) {
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
  constructor(
    readonly runtime: GameplayRuntime,
    readonly access: RoomAccess,
    readonly database: DatabaseService,
  ) {}
  @scoped("catalog.categories")
  async categories(
    query: Record<string, unknown>,
  ): Promise<Contract<"CategoryPage">> {
    this.runtime.enabled();
    const lang = language(query.language),
      { limit, cursor } = paging(query, 20);
    const { db } = this.database,
      c = s.categories,
      m = s.mediaAssets;
    const rows = await db
      .select({
        category: c,
        section: s.categorySections,
        coverKey: m.storageKey,
      })
      .from(c)
      .leftJoin(s.categorySections, eq(s.categorySections.id, c.sectionId))
      .leftJoin(
        m,
        and(
          eq(m.id, c.coverMediaAssetId),
          eq(m.state, "ready"),
          eq(m.accessScope, "public"),
          isNull(m.archivedAt),
        ),
      )
      .where(
        and(
          isNull(c.archivedAt),
          or(
            gt(c.displayOrder, cursor[0]),
            and(eq(c.displayOrder, cursor[0]), gt(c.id, cursor[1])),
          ),
        ),
      )
      .orderBy(c.displayOrder, c.id)
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    // Counts only packs a host can start: six current questions.
    const startable = page.length
      ? await db
          .select({ categoryId: s.questionPacks.categoryId })
          .from(s.questionPacks)
          .innerJoin(
            s.questions,
            and(
              eq(s.questions.packId, s.questionPacks.id),
              isNull(s.questions.retiredAt),
            ),
          )
          .where(
            and(
              inArray(
                s.questionPacks.categoryId,
                page.map((r) => r.category.id),
              ),
              eq(s.questionPacks.publicationState, "published"),
              isNull(s.questionPacks.archivedAt),
            ),
          )
          .groupBy(s.questionPacks.categoryId, s.questionPacks.id)
          .having(eq(count(), 6))
      : [];
    const covers = this.runtime.options.publicMediaBaseUrl;
    const last = page.at(-1);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      invariant(last, "CATALOG_PAGE_LAST");
      nextCursor = next(last.category.displayOrder, last.category.id);
    }
    return {
      items: page.map(({ category: r, section, coverKey }) => ({
        id: r.id,
        name: local(r.nameAr, r.nameFranco, lang),
        ...(r.descriptionAr
          ? { description: local(r.descriptionAr, r.descriptionFranco, lang) }
          : {}),
        ...(section
          ? {
              section: {
                id: section.id,
                name: local(section.nameAr, section.nameFranco, lang),
                displayOrder: section.displayOrder,
              },
            }
          : {}),
        ...(covers && coverKey ? { coverUrl: `${covers}/${coverKey}` } : {}),
        publishedPackCount: startable.filter((p) => p.categoryId === r.id)
          .length,
      })),
      ...(nextCursor ? { nextCursor } : {}),
    };
  }
  async eligibility(
    db: Tx,
    pack: typeof s.questionPacks.$inferSelect,
    members: RosterMember[],
  ) {
    return (await this.eligibilities(db, [pack], members)).get(pack.id)!;
  }
  async eligibilities(
    db: Tx,
    packs: (typeof s.questionPacks.$inferSelect)[],
    members: RosterMember[],
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
  @scoped("catalog.packs")
  async packs(
    actor: Actor | undefined,
    categoryId: string,
    query: Record<string, unknown>,
  ): Promise<Contract<"PackPage">> {
    this.runtime.enabled();
    language(query.language);
    const { limit, cursor } = paging(query, 20);
    requireState(
      query.freshOnly === undefined ||
        query.freshOnly === "true" ||
        query.freshOnly === "false",
      "INVALID_FILTER",
      400,
    );
    const roomId = query.roomId === undefined ? undefined : id(query.roomId);
    return this.database.transaction(
      async (db) => {
        let members: RosterMember[] = [];
        if (roomId) {
          requireState(actor, "UNAUTHENTICATED", 401);
          const room = await this.access.room(db, roomId, false);
          await this.access.membership(db, room, actor);
          members = await this.access.members(db, roomId);
        } else if (actor?.account)
          members = [
            {
              id: actor.account.accountId,
              accountId: actor.account.accountId,
              lobbyTeamNumber: null,
            },
          ];
        const rows = await db
          .select()
          .from(s.questionPacks)
          .where(
            and(
              eq(s.questionPacks.categoryId, categoryId),
              eq(s.questionPacks.publicationState, "published"),
              isNull(s.questionPacks.archivedAt),
              or(
                gt(s.questionPacks.packNumber, cursor[0]),
                and(
                  eq(s.questionPacks.packNumber, cursor[0]),
                  gt(s.questionPacks.id, cursor[1]),
                ),
              ),
            ),
          )
          .orderBy(s.questionPacks.packNumber, s.questionPacks.id)
          .limit(50);
        const eligibility = await this.eligibilities(db, rows, members);
        const own = actor?.account?.accountId;
        const history =
          own && rows.length
            ? await completionHistory(
                db,
                own,
                rows.map((p) => p.id),
              )
            : [];
        const items: Contract<"Pack">[] = [];
        let scanned: (typeof rows)[number] | undefined;
        for (const pack of rows) {
          scanned = pack;
          const e = eligibility.get(pack.id)!;
          if (e.questions.length !== 6) continue;
          if (query.freshOnly === "true" && !e.fresh) continue;
          let progress: Contract<"Pack">["progress"] | undefined;
          if (own) {
            const row = history.find((r) => r.packId === pack.id);
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
