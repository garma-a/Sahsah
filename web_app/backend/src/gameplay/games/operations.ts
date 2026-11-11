import { DatabaseService } from "../../database/database.module.js";
import { GameplayTransactions } from "../platform/transaction.js";
import { GameplayOutbox } from "../platform/outbox.js";
import { RoomReceipts } from "../platform/receipts.js";
import { RoomAccess } from "../rooms/access.js";
import { GameplayIdentity } from "../platform/identity.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { startGame } from "./start/index.js";
import { runGameCommand } from "./pipeline.js";
import { isPosition } from "./rules/positions.js";
import { writtenAtMost } from "../platform/invariant.js";
import { scoped, enrichContext, log } from "../platform/logging.js";
import { single, invariant, versionIncrement } from "../platform/invariant.js";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../../database/schema/index.js";
import { CatalogService } from "../catalog/catalog.js";
import { remaining } from "./content.js";
import { revision } from "../contract.js";
import { digest, equalProof, proof } from "../platform/proof.js";
import { requireState } from "../platform/problem.js";
import type { Contract } from "../contract.js";
import { RoomOperations } from "../rooms/operations.js";
import { freshTime } from "../platform/clock.js";
import type { Actor, Game, Question, Tx } from "../platform/types.js";

@Injectable()
export class GameOperations {
  constructor(
    readonly runtime: GameplayRuntime,
    readonly identity: GameplayIdentity,
    readonly access: RoomAccess,
    readonly receipts: RoomReceipts,
    readonly outbox: GameplayOutbox,
    readonly transactions: GameplayTransactions,
    readonly database: DatabaseService,
    readonly rooms: RoomOperations,
    readonly catalog: CatalogService,
  ) {}
  async game(db: Tx, gameId: string, lock = true): Promise<Game> {
    const query = db.select().from(s.games).where(eq(s.games.id, gameId));
    const waiting = performance.now();
    const game = (await (lock ? query.for("update") : query))[0];
    if (lock)
      log.debug("games.game.lock", { waitMs: performance.now() - waiting });
    requireState(game, "NOT_FOUND", 404);
    enrichContext({ gameId: game.id, roomId: game.roomId });
    return game;
  }
  host(game: Game, actor: Actor, control = true) {
    requireState(
      actor.account && actor.account.expiresAt > Date.now(),
      "FORBIDDEN",
      403,
    );
    requireState(
      actor.account?.accountId === game.hostAccountId,
      "FORBIDDEN",
      403,
    );
    if (control)
      requireState(
        actor.generation === game.controllerGeneration &&
          equalProof(
            game.controllerCredentialHash,
            proof("game-control", game.id, actor.controlSecret),
          ),
        "CONTROLLER_FENCED",
        403,
      );
  }
  async accounts(db: Tx, ids: string[]) {
    return ids.length
      ? db
          .select()
          .from(s.accounts)
          .where(inArray(s.accounts.id, [...new Set(ids)].sort()))
          .orderBy(s.accounts.id)
          .for("update")
      : [];
  }
  async lockRoster(db: Tx, game: Game) {
    const players = await db
      .select()
      .from(s.gamePlayers)
      .where(eq(s.gamePlayers.gameId, game.id));
    return this.accounts(db, [
      game.hostAccountId,
      ...players.flatMap((p) => (p.accountId ? [p.accountId] : [])),
    ]);
  }
  fields(
    game: Game,
  ): Pick<
    Contract<"GameCommandReceipt">,
    "gameId" | "gameVersion" | "gameProjectionVersion"
  > {
    return {
      gameId: game.id,
      gameVersion: String(game.stateVersion),
      gameProjectionVersion: String(game.projectionVersion),
    };
  }
  async recover(db: Tx, gameId: string, operationId: string, hash: Buffer) {
    const row = (
      await db
        .select()
        .from(s.gameActions)
        .where(
          and(
            eq(s.gameActions.gameId, gameId),
            eq(s.gameActions.commandId, operationId),
          ),
        )
    )[0];
    if (!row) return;
    requireState(equalProof(row.requestDigest, hash), "OPERATION_CONFLICT");
    // Durable game receipts come from the typed writer; replay does not revalidate.
    return row.resultData as Contract<"Receipt">;
  }
  async receipt(
    db: Tx,
    game: Game,
    actor: Actor,
    operationId: string,
    name: string,
    hash: Buffer,
    expected: bigint,
    now: Date,
    outcome: Partial<Contract<"Receipt">> = {},
    score: Partial<typeof s.gameActions.$inferInsert> = {},
  ): Promise<Contract<"Receipt">> {
    const result: Contract<"Receipt"> = {
      operationId,
      roomId: game.roomId,
      acceptedAt: now.toISOString(),
      effect:
        game.stateVersion === expected && !outcome.feedbackVersion
          ? "none"
          : "changed",
      ...this.fields(game),
      ...outcome,
    };
    single(
      await db
        .insert(s.gameActions)
        .values({
          gameId: game.id,
          commandId: operationId,
          hostAccountId: actor.account!.accountId,
          commandName: name,
          requestDigest: hash,
          controllerGeneration: game.controllerGeneration,
          expectedVersion: expected,
          resultVersion: game.stateVersion,
          resultData: result,
          acceptedAt: now.toISOString(),
          ...score,
        })
        .returning(),
      "GAMEACTIONS_WRITE_ROW",
    );
    return result;
  }
  @scoped("games.finish")
  async finish(
    db: Tx,
    game: Game,
    now: Date,
    reason: "completed" | "host_ended" | "host_left" | "idle_timeout",
  ): Promise<Game> {
    if (game.status !== "active") return game;
    const ended =
      reason === "idle_timeout" ? new Date(game.idleExpiresAt) : now;
    const endedAt =
      reason === "idle_timeout" ? game.idleExpiresAt : now.toISOString();
    const players = await db
      .select()
      .from(s.gamePlayers)
      .where(eq(s.gamePlayers.gameId, game.id));
    await this.accounts(db, [
      game.hostAccountId,
      ...players.flatMap((p) => (p.accountId ? [p.accountId] : [])),
    ]);
    const running = await db
      .select()
      .from(s.gameQuestions)
      .where(
        and(
          eq(s.gameQuestions.gameId, game.id),
          eq(s.gameQuestions.timerState, "running"),
        ),
      );
    for (const q of running) {
      const ms = remaining(q, ended);
      single(
        await db
          .update(s.gameQuestions)
          .set({
            timerState: ms ? "paused" : "elapsed",
            remainingMs: ms,
            timerDeadlineAt: null,
            resumeTimerOnReopen: false,
          })
          .where(this.slot(q))
          .returning(),
        "GAMEQUESTIONS_WRITE_ROW",
      );
    }
    const updated = single(
      await db
        .update(s.games)
        .set({
          status: reason === "idle_timeout" ? "expired" : "finished",
          endReason: reason,
          endedAt,
          contentPurgeAfter: sql`${endedAt}::timestamptz + interval '12 months'`,
          stateVersion: game.stateVersion + 1n,
          projectionVersion: game.projectionVersion + 1n,
          teamOneScore: game.teamOneScore,
          teamTwoScore: game.teamTwoScore,
          activeBoardPosition: null,
          activeQuestionPosition: null,
        })
        .where(eq(s.games.id, game.id))
        .returning(),
      "GAMES_UPDATED_ROW",
    );
    await db
      .update(s.accounts)
      .set({ activeGameId: null, activeGameClaimedAt: null })
      .where(eq(s.accounts.activeGameId, game.id));
    if (!game.firstQuestionOpenedAt) {
      const debit = (
        await db
          .select()
          .from(s.tokenLedgerEntries)
          .where(
            and(
              eq(s.tokenLedgerEntries.gameId, game.id),
              eq(s.tokenLedgerEntries.entryKind, "game_debit"),
            ),
          )
      )[0];
      requireState(debit, "GAME_DEBIT_MISSING", 500);
      await writtenAtMost(
        db
          .insert(s.tokenLedgerEntries)
          .values({
            id: randomUUID(),
            accountId: game.hostAccountId,
            entryKind: "game_restoration",
            amount: 1,
            idempotencyKey: `unopened:${game.id}`,
            gameId: game.id,
            sourceDebitId: debit.id,
            sourceDebitKind: "game_debit",
            restorationReason: "unopened_game",
            createdAt: now.toISOString(),
          })
          .onConflictDoNothing()
          .returning(),
        1,
        "TOKENLEDGERENTRIES_WRITE_COUNT",
      );
    }
    await this.outbox.hint(
      db,
      game.roomId,
      0n,
      game.id,
      updated.projectionVersion,
    );
    // A room-only maintenance pass derives its lobby deadline from endedAt;
    // never acquire room after game, even through a membership trigger.
    versionIncrement(game.stateVersion, updated.stateVersion);
    versionIncrement(game.projectionVersion, updated.projectionVersion);
    this.transactions.afterCommit(db, () =>
      log.info("games.finish", { outcome: updated.status }),
    );
    return updated;
  }
  @scoped("games.expire")
  async expire(gameId: string) {
    return this.transactions.transaction(async (db) => {
      const game = await this.game(db, gameId),
        now = await freshTime(db);
      if (
        game.status === "active" &&
        now.getTime() >= new Date(game.idleExpiresAt).getTime()
      )
        return this.finish(db, game, now, "idle_timeout");
      return game;
    });
  }
  async preflight(roomId: string) {
    const room = await this.access.room(this.database.db, roomId, false);
    if (room.currentGameId) await this.expire(room.currentGameId);
    const members = await this.access.members(this.database.db, roomId),
      ids = members.flatMap((m) => (m.accountId ? [m.accountId] : []));
    const accounts = ids.length
      ? await this.database.db
          .select()
          .from(s.accounts)
          .where(inArray(s.accounts.id, ids))
      : [];
    for (const id of [
      ...new Set(
        accounts.flatMap((a) => (a.activeGameId ? [a.activeGameId] : [])),
      ),
    ].sort())
      await this.expire(id);
  }
  @scoped("games.start")
  async start(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Contract<"StartGame">,
  ): Promise<Contract<"Receipt">> {
    return startGame(this, actor, roomId, operationId, body);
  }
  slot(q: Pick<Question, "gameId" | "boardPosition" | "questionPosition">) {
    invariant(
      isPosition(q.boardPosition) && isPosition(q.questionPosition),
      "QUESTION_POSITIONS",
    );
    return and(
      eq(s.gameQuestions.gameId, q.gameId),
      eq(s.gameQuestions.boardPosition, q.boardPosition),
      eq(s.gameQuestions.questionPosition, q.questionPosition),
    );
  }
  async exposure(db: Tx, game: Game, q: Question, now: Date) {
    const players = await db
      .select()
      .from(s.gamePlayers)
      .where(
        and(eq(s.gamePlayers.gameId, game.id), isNull(s.gamePlayers.leftAt)),
      );
    const accounts = await this.accounts(
      db,
      players.flatMap((p) => (p.accountId ? [p.accountId] : [])),
    );
    const eligible = accounts.filter(
      (a) => a.state === "active" && a.activeGameId === game.id,
    );
    if (eligible.length)
      await writtenAtMost(
        db
          .insert(s.accountQuestionExposures)
          .values(
            eligible.map((a) => ({
              accountId: a.id,
              questionId: q.sourceQuestionId,
              firstGameId: game.id,
              firstExposedAt: now.toISOString(),
            })),
          )
          .onConflictDoNothing()
          .returning(),
        eligible.length,
        "ACCOUNTQUESTIONEXPOSURES_WRITE_COUNT",
      );
  }
  async completion(db: Tx, game: Game, q: Question, now: Date) {
    const all = await db
      .select()
      .from(s.gameQuestions)
      .where(
        and(
          eq(s.gameQuestions.gameId, game.id),
          eq(s.gameQuestions.boardPosition, q.boardPosition),
        ),
      );
    if (!all.every((x) => x.resolvedAt)) return;
    const players = await db
      .select()
      .from(s.gamePlayers)
      .where(
        and(eq(s.gamePlayers.gameId, game.id), isNull(s.gamePlayers.leftAt)),
      );
    const accounts = await this.accounts(
      db,
      players.flatMap((p) => (p.accountId ? [p.accountId] : [])),
    );
    const eligible = accounts.filter(
      (a) => a.state === "active" && a.activeGameId === game.id,
    );
    if (eligible.length)
      await writtenAtMost(
        db
          .insert(s.accountPackCompletions)
          .values(
            eligible.map((a) => ({
              accountId: a.id,
              gameId: game.id,
              boardPosition: q.boardPosition,
              completedAt: now.toISOString(),
            })),
          )
          .onConflictDoNothing()
          .returning(),
        eligible.length,
        "ACCOUNTPACKCOMPLETIONS_WRITE_COUNT",
      );
  }
  @scoped("games.command")
  async command(
    actor: Actor,
    gameId: string,
    operationId: string,
    body: Contract<"GameCommand">,
  ): Promise<Contract<"Receipt">> {
    return runGameCommand(this, actor, gameId, operationId, body);
  }
  @scoped("games.feedback")
  async feedback(
    actor: Actor,
    gameId: string,
    boardPosition: number,
    questionPosition: number,
    operationId: string,
    body: Contract<"FeedbackRequest">,
  ) {
    const hash = digest("feedback", gameId, {
      ...body,
      boardPosition,
      questionPosition,
    });
    return this.transactions.transaction(async (db) => {
      const game = await this.game(db, gameId);
      this.host(game, actor, false);
      const prior = await this.recover(db, gameId, operationId, hash);
      if (prior) return prior;
      requireState(
        (await this.accounts(db, [game.hostAccountId]))[0]?.state === "active",
        "UNAUTHENTICATED",
        401,
      );
      const now = await freshTime(db),
        q = (
          await db
            .select()
            .from(s.gameQuestions)
            .where(this.slot({ gameId, boardPosition, questionPosition }))
        )[0];
      requireState(q, "NOT_FOUND", 404);
      requireState(!q.contentPurgedAt, "CONTENT_PURGED", 410);
      requireState(q.revealedAt, "ANSWER_NOT_REVEALED");
      requireState(
        revision(body.expectedFeedbackVersion) === q.feedbackVersion,
        "STALE_FEEDBACK_VERSION",
      );
      if (q.feedbackVote === body.vote)
        return this.receipt(
          db,
          game,
          actor,
          operationId,
          "feedback",
          hash,
          game.stateVersion,
          now,
          { feedbackVersion: String(q.feedbackVersion), effect: "none" },
        );
      single(
        await db
          .update(s.gameQuestions)
          .set({
            feedbackVote: body.vote,
            feedbackVersion: q.feedbackVersion + 1n,
            feedbackByAccountId: game.hostAccountId,
            feedbackCreatedAt: q.feedbackCreatedAt ?? now.toISOString(),
            feedbackUpdatedAt: now.toISOString(),
          })
          .where(this.slot(q))
          .returning(),
        "GAMEQUESTIONS_WRITE_ROW",
      );
      const updated = single(
        await db
          .update(s.games)
          .set({ projectionVersion: game.projectionVersion + 1n })
          .where(eq(s.games.id, gameId))
          .returning(),
        "GAMES_UPDATED_ROW",
      );
      versionIncrement(game.projectionVersion, updated.projectionVersion);
      invariant(
        updated.stateVersion === game.stateVersion,
        "FEEDBACK_GAME_VERSION_STABLE",
      );
      await this.outbox.hint(
        db,
        game.roomId,
        0n,
        gameId,
        updated.projectionVersion,
      );
      return this.receipt(
        db,
        updated,
        actor,
        operationId,
        "feedback",
        hash,
        game.stateVersion,
        now,
        { feedbackVersion: String(q.feedbackVersion + 1n) },
      );
    });
  }
}
