import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import * as s from "../database/schema/index.js";
import {
  GameplayService,
  freshTime,
  iso,
  plusDay,
  type Actor,
  type Game,
  type Room,
  type Tx,
} from "./service.js";
import { GameOperations } from "./games.js";
import { language as validLanguage } from "./catalog.js";
import {
  answerView,
  local,
  questionView,
  suggested,
  timer,
} from "./content.js";
import { requireState } from "./problem.js";
import type { Data } from "./ports.js";

const winner = (a: bigint | number, b: bigint | number) =>
  a === b ? null : a > b ? 1 : 2;

@Injectable()
export class ProjectionService {
  constructor(
    private core: GameplayService,
    private games: GameOperations,
  ) {}
  async authorize(db: Tx, game: Game, actor: Actor, historical: boolean) {
    const predicate = actor.member
      ? eq(s.gamePlayers.roomMemberId, actor.member.id)
      : eq(s.gamePlayers.accountId, actor.account!.accountId);
    const player = (
      await db
        .select()
        .from(s.gamePlayers)
        .where(and(eq(s.gamePlayers.gameId, game.id), predicate))
    )[0];
    requireState(
      player && (!actor.member || player.accountId === null),
      "FORBIDDEN",
      403,
    );
    if (!historical) {
      const room = await this.core.room(db, game.roomId, false);
      await this.core.membership(db, room, actor);
      requireState(
        !player.leftAt && room.currentGameId === game.id,
        "PARTICIPATION_ENDED",
        403,
      );
      if (actor.account?.accountId === game.hostAccountId)
        this.games.host(game, actor);
    }
    return player;
  }
  async room(
    actor: Actor,
    roomId: string,
    requestedLanguage?: string,
  ): Promise<Data> {
    const language = validLanguage(requestedLanguage);
    return this.core.database.transaction(async (db) => {
      await db.execute(
        sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`,
      );
      const room = await this.core.room(db, roomId, false);
      await this.core.membership(db, room, actor);
      const audience =
        actor.account?.accountId === room.ownerAccountId ? "host" : "viewer";
      if (audience === "host") this.core.host(room, actor);
      const now = await freshTime(db);
      if (room.currentGameId && room.presentationMode === "game")
        return this.snapshot(
          db,
          room,
          await this.games.game(db, room.currentGameId, false),
          actor,
          language,
          now,
        );
      const previous = room.currentGameId
        ? await this.games.game(db, room.currentGameId, false)
        : undefined;
      const base = Math.max(
        new Date(room.lastLobbyActivityAt).getTime(),
        previous?.endedAt ? new Date(previous.endedAt).getTime() : 0,
      );
      requireState(now.getTime() < base + 86400000, "ROOM_EXPIRED", 410);
      const members = await this.core.members(db, roomId);
      const selections = await db
        .select()
        .from(s.roomPackSelections)
        .where(eq(s.roomPackSelections.roomId, roomId))
        .orderBy(s.roomPackSelections.boardPosition);
      return {
        source: { roomVersion: String(room.stateVersion) },
        serverTime: now.toISOString(),
        language,
        view: {
          phase: "lobby",
          audience,
          roomId,
          teamOneName: room.teamOneName,
          teamTwoName: room.teamTwoName,
          members: members.map((member) => ({
            id: member.id,
            displayName: member.displayName,
            teamNumber: member.lobbyTeamNumber,
            host: member.accountId === room.ownerAccountId,
            memberVersion: String(member.stateVersion),
            ready: member.readyForGeneration === room.lobbyGeneration,
          })),
          selections: selections.map((item) => ({
            boardPosition: item.boardPosition,
            categoryId: item.categoryId,
            packId: item.packId,
            observedRevision: String(item.observedRevision),
            ...(item.repeatConsentBasis
              ? { repeatConsentBasis: item.repeatConsentBasis.toString("hex") }
              : {}),
          })),
          readyGeneration: room.lobbyGeneration,
          idleExpiresAt: plusDay(new Date(base)),
          ...(room.currentGameId ? { previousGameId: room.currentGameId } : {}),
        },
      };
    });
  }
  async game(
    actor: Actor,
    gameId: string,
    requestedLanguage?: string,
    resultOnly = false,
  ): Promise<Data> {
    const language = validLanguage(requestedLanguage),
      initial = await this.games.game(this.core.database.db, gameId, false);
    await this.authorize(
      this.core.database.db,
      initial,
      actor,
      initial.status !== "active",
    );
    if (
      initial.status === "active" &&
      Date.now() >= new Date(initial.idleExpiresAt).getTime()
    )
      await this.games.expire(gameId);
    return this.core.database.transaction(async (db) => {
      await db.execute(
        sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`,
      );
      const game = await this.games.game(db, gameId, false),
        room = await this.core.room(db, game.roomId, false),
        now = await freshTime(db);
      await this.authorize(db, game, actor, game.status !== "active");
      if (resultOnly) {
        requireState(game.status !== "active", "RESULT_NOT_READY");
        return this.result(db, game, language);
      }
      return this.snapshot(db, room, game, actor, language, now);
    });
  }
  async result(db: Tx, game: Game, language: string): Promise<Data> {
    const questions = await db
      .select()
      .from(s.gameQuestions)
      .where(eq(s.gameQuestions.gameId, game.id));
    const packs = await db
      .select()
      .from(s.gamePacks)
      .where(eq(s.gamePacks.gameId, game.id))
      .orderBy(s.gamePacks.boardPosition);
    const awards = (number: number, rows = questions) =>
      rows
        .filter((q) => q.winningTeamNumber === number)
        .reduce((sum, q) => sum + (q.awardedPoints ?? 0), 0);
    return {
      gameId: game.id,
      roomId: game.roomId,
      status: game.status,
      endReason: game.endReason,
      endedAt: iso(game.endedAt!),
      resolvedQuestionCount: questions.filter((q) => q.resolvedAt).length,
      winningTeamNumber: winner(game.teamOneScore, game.teamTwoScore),
      teams: [1, 2].map((number) => {
        const score = number === 1 ? game.teamOneScore : game.teamTwoScore;
        return {
          number,
          name: number === 1 ? game.teamOneName : game.teamTwoName,
          score: String(score),
          questionAwardTotal: awards(number),
          manualAdjustmentTotal: String(score - BigInt(awards(number))),
        };
      }),
      categories: packs.map((pack) => {
        const qs = questions.filter(
            (q) => q.boardPosition === pack.boardPosition,
          ),
          a = awards(1, qs),
          b = awards(2, qs);
        return {
          boardPosition: pack.boardPosition,
          categoryId: pack.categoryId,
          name: local(pack.categoryNameAr, pack.categoryNameFranco, language),
          resolvedCount: qs.filter((q) => q.resolvedAt).length,
          teamOneAwardPoints: a,
          teamTwoAwardPoints: b,
          winningTeamNumber: winner(a, b),
        };
      }),
    };
  }
  async snapshot(
    db: Tx,
    room: Room,
    game: Game,
    actor: Actor,
    language: string,
    now: Date,
  ): Promise<Data> {
    await this.authorize(db, game, actor, game.status !== "active");
    const host = actor.account?.accountId === game.hostAccountId,
      audience = host ? "host" : "viewer";
    const base = {
      source: {
        roomVersion: String(room.stateVersion),
        gameId: game.id,
        gameVersion: String(game.stateVersion),
        gameProjectionVersion: String(game.projectionVersion),
      },
      serverTime: now.toISOString(),
      language,
    };
    if (game.status !== "active")
      return {
        ...base,
        view: {
          phase: "result",
          audience,
          result: await this.result(db, game, language),
        },
      };
    requireState(
      now.getTime() < new Date(game.idleExpiresAt).getTime(),
      "GAME_EXPIRED",
      410,
    );
    const teams = [1, 2].map((number) => ({
      number,
      name: number === 1 ? game.teamOneName : game.teamTwoName,
      score: String(number === 1 ? game.teamOneScore : game.teamTwoScore),
    }));
    const common = {
      audience,
      roomId: room.id,
      gameId: game.id,
      teams,
      idleExpiresAt: iso(game.idleExpiresAt),
    };
    if (!game.activeBoardPosition) {
      const packs = await db
        .select()
        .from(s.gamePacks)
        .where(eq(s.gamePacks.gameId, game.id))
        .orderBy(s.gamePacks.boardPosition);
      const questions = await db
        .select()
        .from(s.gameQuestions)
        .where(eq(s.gameQuestions.gameId, game.id))
        .orderBy(
          s.gameQuestions.boardPosition,
          s.gameQuestions.questionPosition,
        );
      return {
        ...base,
        view: {
          phase: "board",
          ...common,
          board: packs.map((pack) => ({
            boardPosition: pack.boardPosition,
            categoryId: pack.categoryId,
            packId: pack.packId,
            name: local(pack.categoryNameAr, pack.categoryNameFranco, language),
            tiles: questions
              .filter((q) => q.boardPosition === pack.boardPosition)
              .map((q) => ({
                questionPosition: q.questionPosition,
                basePoints: q.basePoints,
                state: q.resolvedAt
                  ? "resolved"
                  : q.revealedAt
                    ? "revealed"
                    : q.firstOpenedAt
                      ? "opened"
                      : "unopened",
                ...(q.resolvedAt
                  ? {
                      winningTeamNumber: q.winningTeamNumber,
                      awardedPoints: q.awardedPoints,
                    }
                  : {}),
              })),
          })),
        },
      };
    }
    const q = (
      await db
        .select()
        .from(s.gameQuestions)
        .where(
          this.games.slot({
            gameId: game.id,
            boardPosition: game.activeBoardPosition,
            questionPosition: game.activeQuestionPosition!,
          }),
        )
    )[0];
    requireState(q && q.contentSnapshot, "CONTENT_PURGED", 410);
    const media = await db
      .select({
        mediaRole: s.gameQuestionMedia.mediaRole,
        variantNumber: s.gameQuestionMedia.variantNumber,
        durationMs: s.mediaAssets.durationMs,
      })
      .from(s.gameQuestionMedia)
      .innerJoin(
        s.mediaAssets,
        eq(s.mediaAssets.id, s.gameQuestionMedia.mediaAssetId),
      )
      .where(
        and(
          eq(s.gameQuestionMedia.gameId, q.gameId),
          eq(s.gameQuestionMedia.boardPosition, q.boardPosition),
          eq(s.gameQuestionMedia.questionPosition, q.questionPosition),
        ),
      );
    const controls = ["return_to_board", "adjust_score", "end_game"];
    if (q.revealedAt) controls.push("resolve_question");
    else {
      if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format) && q.stageIndex < 2)
        controls.push("advance_hint");
      if (q.format === "IMAGE_MEMORY")
        controls.push(q.memoryImageVisible ? "hide_memory" : "show_memory");
      if (q.format !== "IMAGE_MEMORY" || q.memoryFirstHiddenAt) {
        controls.push("reveal_answer", "reset_timer");
        if (q.timerState === "running") controls.push("pause_timer");
        if (q.timerState === "paused") controls.push("resume_timer");
      }
    }
    return {
      ...base,
      view: {
        phase: q.revealedAt ? "answer" : "question",
        ...common,
        boardPosition: q.boardPosition,
        questionPosition: q.questionPosition,
        basePoints: q.basePoints,
        suggestedPoints: suggested(q),
        timer: timer(q, now),
        question: questionView(q, media, host, language),
        ...(q.revealedAt
          ? { answer: answerView(q, media, host, language) }
          : {}),
        ...(host
          ? {
              controls,
              ...(q.revealedAt
                ? {
                    feedback: {
                      version: String(q.feedbackVersion),
                      ...(q.feedbackVote ? { vote: q.feedbackVote } : {}),
                    },
                  }
                : {}),
            }
          : {}),
      },
    };
  }
}
