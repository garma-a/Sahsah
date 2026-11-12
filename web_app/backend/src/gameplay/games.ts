import { writtenAtMost, written } from "./invariant.js";
import { scoped, enrichContext, log, errorStack } from "./logging.js";
import { single, invariant, versionIncrement } from "./invariant.js";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../database/schema/index.js";
import type { JsonObject } from "../database/schema/types.js";
import { CatalogService } from "./catalog.js";
import { points, remaining, settings, suggested } from "./content.js";
import { revision } from "./contract.js";
import { digest, equalProof, proof } from "./proof.js";
import { requireState } from "./problem.js";
import type { Contract } from "./contract.js";
import { RoomOperations } from "./rooms.js";
import {
  GameplayService,
  freshTime,
  iso,
  plusDay,
  type Actor,
  type Game,
  type Question,
  type Tx,
} from "./service.js";

@Injectable()
export class GameOperations {
  constructor(
    private core: GameplayService,
    private rooms: RoomOperations,
    private catalog: CatalogService,
  ) {}
  async game(db: Tx, gameId: string, lock = true): Promise<Game> {
    const query = db.select().from(s.games).where(eq(s.games.id, gameId));
    const waiting = performance.now();
    const game = (await (lock ? query.for("update") : query))[0];
    if (lock) log.debug("games.game.lock", { waitMs: performance.now() - waiting });
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
  fields(game: Game): Pick<Contract<"GameCommandReceipt">, "gameId" | "gameVersion" | "gameProjectionVersion"> {
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
    single(await db.insert(s.gameActions).values({
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
    }).returning(), "GAMEACTIONS_WRITE_ROW");
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
      single(await db
        .update(s.gameQuestions)
        .set({
          timerState: ms ? "paused" : "elapsed",
          remainingMs: ms,
          timerDeadlineAt: null,
          resumeTimerOnReopen: false,
        })
        .where(this.slot(q)).returning(), "GAMEQUESTIONS_WRITE_ROW");
    }
    const updated = single(await db
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
      .returning(), "GAMES_UPDATED_ROW");
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
      await writtenAtMost(db
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
        .onConflictDoNothing().returning(), 1, "TOKENLEDGERENTRIES_WRITE_COUNT");
    }
    await this.core.hint(
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
    this.core.afterCommit(db, () => log.info("games.finish", { outcome: updated.status }));
    return updated;
  }
  @scoped("games.expire")
  async expire(gameId: string) {
    return this.core.transaction(async (db) => {
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
    const room = await this.core.room(this.core.database.db, roomId, false);
    if (room.currentGameId) await this.expire(room.currentGameId);
    const members = await this.core.members(this.core.database.db, roomId),
      ids = members.flatMap((m) => (m.accountId ? [m.accountId] : []));
    const accounts = ids.length
      ? await this.core.database.db
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
    const hash = digest("startGame", roomId, body);
    const original = (
      await this.core.database.db
        .select()
        .from(s.games)
        .where(eq(s.games.startRequestId, operationId))
    )[0];
    if (original) {
      this.host(original, actor, false);
      requireState(
        original.roomId === roomId &&
          equalProof(original.startRequestDigest, hash),
        "OPERATION_CONFLICT",
      );
      const receipt = await this.core.receipt(
        this.core.database.db,
        operationId,
        hash,
      );
      if (receipt) return receipt;
      const room = await this.core.room(this.core.database.db, roomId, false);
      return {
        operationId,
        roomId,
        acceptedAt: iso(original.startedAt),
        effect: "changed",
        roomVersion: String(room.stateVersion),
        readyGeneration: room.lobbyGeneration,
        ...this.fields(original),
        controllerGeneration: String(original.controllerGeneration),
      };
    }
    const initialRoom = await this.core.room(
      this.core.database.db,
      roomId,
      false,
    );
    this.core.host(initialRoom, actor);
    requireState(
      this.core.admission.availability().admission === "open",
      "SERVER_AT_CAPACITY",
      503,
    );
    await this.preflight(roomId);
    return this.core.admission.allocate(`start:${operationId}`, hash, () =>
      this.core.transaction(async (db) => {
        const room = await this.core.room(db, roomId);
        this.core.host(room, actor);
        const prior = await this.core.receipt(db, operationId, hash);
        if (prior) return prior;
        const roster = await this.core.members(db, roomId);
        requireState(
          roster.length > 0 &&
            roster.length <= 6 &&
            roster.every(
              (m) =>
                m.accountId === room.ownerAccountId ||
                m.readyForGeneration === room.lobbyGeneration,
            ),
          "MEMBERS_NOT_READY",
        );
        const selections = await db
          .select()
          .from(s.roomPackSelections)
          .where(eq(s.roomPackSelections.roomId, roomId))
          .orderBy(s.roomPackSelections.boardPosition);
        requireState(
          selections.length === 6 &&
            selections.every((v, i) => v.boardPosition === i + 1),
          "SIX_CATEGORIES_REQUIRED",
        );
        // Stable catalog locks prevent publication/media edits racing the copy.
        const categories = await db
          .select()
          .from(s.categories)
          .where(
            inArray(
              s.categories.id,
              selections.map((p) => p.categoryId).sort(),
            ),
          )
          .orderBy(s.categories.id)
          .for("share");
        const packs = await db
          .select()
          .from(s.questionPacks)
          .where(
            inArray(s.questionPacks.id, selections.map((p) => p.packId).sort()),
          )
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
        const accounts = await this.accounts(
          db,
          roster.flatMap((m) => (m.accountId ? [m.accountId] : [])),
        );
        const now = await freshTime(db);
        await this.rooms.lobby(db, room, now);
        requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
        requireState(
          revision(body.expectedRoomVersion) === room.stateVersion &&
            body.expectedReadyGeneration === room.lobbyGeneration,
          "STALE_ROOM_VERSION",
        );
        requireState(
          accounts.every((a) => a.state === "active" && !a.activeGameId),
          "ACCOUNT_ALREADY_PLAYING",
        );
        requireState(
          accounts.find((a) => a.id === room.ownerAccountId)!.tokenBalance >= 1,
          "INSUFFICIENT_TOKENS",
        );
        const eligibility = await this.catalog.eligibilities(db, packs, roster);
        for (const choice of selections) {
          const pack = packs.find((p) => p.id === choice.packId),
            category = categories.find((c) => c.id === choice.categoryId);
          requireState(
            category &&
              !category.archivedAt &&
              pack &&
              !pack.archivedAt &&
              pack.publicationState === "published" &&
              pack.categoryId === category.id &&
              pack.contentRevision === choice.observedRevision,
            "SELECTION_CHANGED",
          );
          requireState(
            category.nameAr.trim().length > 0 &&
              category.nameAr.length <= 160 &&
              (!category.nameFranco || category.nameFranco.length <= 160),
            "CONTENT_NOT_READY",
          );
          const e = eligibility.get(pack.id)!;
          requireState(e.questions.length === 6, "CONTENT_NOT_READY");
          requireState(
            e.fresh ||
              (choice.repeatAcceptedAt &&
                choice.repeatConsentBasis?.toString("hex") === e.basis),
            "REPEAT_CONSENT_REQUIRED",
            409,
            { packId: pack.id, eligibilityBasis: e.basis },
          );
        }
        const gameId = randomUUID();
        const sequence = await db.execute(
          sql`SELECT coalesce(max(sequence_number),0)+1 AS n FROM games WHERE room_id=${roomId}`,
        );
        const game = single(await db
          .insert(s.games)
          .values({
            id: gameId,
            roomId,
            sequenceNumber: Number(single(sequence.rows, "GAME_SEQUENCE_ROW").n),
            startRequestId: operationId,
            startRequestDigest: hash,
            hostAccountId: room.ownerAccountId,
            teamOneName: room.teamOneName,
            teamTwoName: room.teamTwoName,
            startedAt: now.toISOString(),
            lastGameplayAt: now.toISOString(),
            idleExpiresAt: plusDay(now),
            controllerCredentialHash: proof(
              "game-control",
              gameId,
              actor.controlSecret,
            ),
            controllerGeneration: room.controllerGeneration,
            controllerAcquiredAt: now.toISOString(),
          })
          .returning(), "GAMES_GAME_ROW");
        enrichContext({ gameId, roomId, operationId });
        this.core.afterCommit(db, () => log.info("games.start", { outcome: "created" }));
        const ordered = [...roster].sort((a, b) =>
          a.accountId === room.ownerAccountId
            ? -1
            : b.accountId === room.ownerAccountId
              ? 1
              : a.id < b.id
                ? -1
                : 1,
        );
        await written(db.insert(s.gamePlayers).values(
          ordered.map((m, i) => ({
            gameId,
            roomId,
            roomMemberId: m.id,
            seatNumber: i + 1,
            accountId: m.accountId,
            teamNumber: m.lobbyTeamNumber,
            displayName: m.displayName,
            joinedAt: now.toISOString(),
          })),
        ).returning(), ordered.length, "GAMEPLAYERS_WRITE_COUNT");
        await written(db.insert(s.gamePacks).values(
          selections.map((choice) => {
            const pack = packs.find((p) => p.id === choice.packId)!,
              category = categories.find((c) => c.id === choice.categoryId)!;
            return {
              gameId,
              categoryId: category.id,
              packId: pack.id,
              boardPosition: choice.boardPosition,
              packNumber: pack.packNumber,
              sourceContentRevision: pack.contentRevision,
              categoryNameAr: category.nameAr,
              categoryNameFranco: category.nameFranco,
              repeatAcceptedAt: choice.repeatAcceptedAt,
              repeatAcceptedBySeat: choice.repeatAcceptedAt ? 1 : null,
            };
          }),
        ).returning(), selections.length, "GAMEPACKS_WRITE_COUNT");
        const copied: (typeof s.gameQuestions.$inferInsert)[] = [],
          pins: (typeof s.gameQuestionMedia.$inferInsert)[] = [];
        for (const q of questions) {
          const choice = selections.find((p) => p.packId === q.packId)!;
          const qmedia = media.filter((m) => m.questionId === q.id);
          const stages = qmedia
            .filter((m) => m.mediaRole === "hint_image")
            .sort((a, b) => a.variantNumber - b.variantNumber);
          const cfg = settings(
            q.format,
            {
              ...q.formatConfig,
              ...(["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format)
                ? { stageSuggestions: stages.map((m) => m.suggestedPoints) }
                : {}),
            },
            points(q.slotNumber),
          );
          requireState(
            q.promptAr.trim().length > 0 &&
              q.promptAr.length <= 4000 &&
              q.answerAr.trim().length > 0 &&
              q.answerAr.length <= 4000 &&
              (!q.promptFranco || q.promptFranco.length <= 4000) &&
              (!q.answerFranco || q.answerFranco.length <= 4000),
            "CONTENT_NOT_READY",
          );
          const has = (role: string, variant = 0) =>
            qmedia.some(
              (m) => m.mediaRole === role && m.variantNumber === variant,
            );
          if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format))
            requireState(
              [0, 1, 2].every((v) => has("hint_image", v)) &&
                has("answer_image"),
              "CONTENT_NOT_READY",
            );
          else if (q.format.startsWith("IMAGE_"))
            requireState(
              has("prompt_image") &&
                (["IMAGE_PERSON", "IMAGE_COLOR", "IMAGE_MEMORY"].includes(
                  q.format,
                )
                  ? has("answer_image")
                  : true),
              "CONTENT_NOT_READY",
            );
          if (q.format.startsWith("AUDIO_"))
            requireState(
              has("question_audio") &&
                (q.format !== "AUDIO_REVERSE" ||
                  !cfg.allowForward ||
                  has("answer_audio")),
              "CONTENT_NOT_READY",
            );
          const original = qmedia.find(
            (m) =>
              m.mediaRole ===
              (q.format.startsWith("AUDIO_") ? "source_audio" : "answer_image"),
          )?.mediaAssetId;
          const rendition = (role: string, operation: string, variant = 0) => {
            const m = qmedia.find(
                (m) => m.mediaRole === role && m.variantNumber === variant,
              ),
              asset = assets.find((a) => a.id === m?.mediaAssetId);
            requireState(
              asset &&
                original &&
                asset.id !== original &&
                asset.sourceAssetId === original &&
                asset.transformSpec.operation === operation,
              "UNSAFE_MEDIA_RENDITION",
            );
          };
          if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format))
            for (const stage of [0, 1, 2])
              rendition(
                "hint_image",
                q.format === "IMAGE_BLUR" ? "blur" : "crop",
                stage,
              );
          if (["IMAGE_PERSON", "IMAGE_COLOR"].includes(q.format))
            rendition(
              "prompt_image",
              q.format === "IMAGE_COLOR" ? "grayscale" : "crop",
            );
          if (q.format === "AUDIO_REVERSE")
            rendition("question_audio", "reverse");
          for (const m of qmedia) {
            if (m.mediaRole.startsWith("source_")) continue;
            const asset = assets.find((a) => a.id === m.mediaAssetId)!;
            requireState(
              asset.state === "ready" &&
                !asset.archivedAt &&
                asset.accessScope === "private" &&
                ["r2", "local"].includes(asset.storageProvider) &&
                asset.contentType &&
                asset.contentType.length <= 100 &&
                asset.byteSize !== null &&
                (asset.widthPx === null || asset.widthPx <= 16384) &&
                (asset.heightPx === null || asset.heightPx <= 16384),
              "CONTENT_NOT_READY",
            );
            requireState(
              (m.mediaRole.endsWith("audio") &&
                asset.mediaKind === "audio" &&
                asset.durationMs &&
                asset.durationMs <= 1800000) ||
                (!m.mediaRole.endsWith("audio") && asset.mediaKind === "image"),
              "CONTENT_NOT_READY",
            );
            pins.push({
              gameId,
              boardPosition: choice.boardPosition,
              questionPosition: q.slotNumber,
              mediaRole: m.mediaRole,
              variantNumber: m.variantNumber,
              mediaAssetId: m.mediaAssetId,
            });
          }
          copied.push({
            gameId,
            boardPosition: choice.boardPosition,
            questionPosition: q.slotNumber,
            sourceQuestionId: q.id,
            basePoints: points(q.slotNumber),
            format: q.format,
            contentSnapshot: {
              promptAr: q.promptAr,
              promptFranco: q.promptFranco,
              answerAr: q.answerAr,
              answerFranco: q.answerFranco,
              config: cfg,
            },
          });
        }
        requireState(copied.length === 36, "CONTENT_NOT_READY");
        await written(db.insert(s.gameQuestions).values(copied).returning(), copied.length, "GAMEQUESTIONS_WRITE_COUNT");
        if (pins.length) await written(db.insert(s.gameQuestionMedia).values(pins).returning(), pins.length, "GAMEQUESTIONMEDIA_WRITE_COUNT");
        await db
          .update(s.accounts)
          .set({ activeGameId: gameId, activeGameClaimedAt: now.toISOString() })
          .where(
            inArray(
              s.accounts.id,
              accounts.map((a) => a.id),
            ),
          );
        single(await db.insert(s.tokenLedgerEntries).values({
          id: randomUUID(),
          accountId: room.ownerAccountId,
          entryKind: "game_debit",
          amount: -1,
          idempotencyKey: `start:${operationId}`,
          gameId,
          createdAt: now.toISOString(),
        }).returning(), "TOKENLEDGERENTRIES_WRITE_ROW");
        const updated = await this.rooms.bump(
          db,
          room,
          now,
          false,
          { currentGameId: gameId, presentationMode: "game" },
          false,
        );
        await this.core.hint(
          db,
          roomId,
          updated.stateVersion,
          game.id,
          game.projectionVersion,
        );
        return this.core.saveReceipt(
          db,
          updated,
          actor,
          operationId,
          "startGame",
          hash,
          now,
          {
            ...this.rooms.fields(updated),
            ...this.fields(game),
            controllerGeneration: String(game.controllerGeneration),
          },
        );
      }),
    );
  }
  slot(q: Pick<Question, "gameId" | "boardPosition" | "questionPosition">) {
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
      await writtenAtMost(db
        .insert(s.accountQuestionExposures)
        .values(
          eligible.map((a) => ({
            accountId: a.id,
            questionId: q.sourceQuestionId,
            firstGameId: game.id,
            firstExposedAt: now.toISOString(),
          })),
        )
        .onConflictDoNothing().returning(), eligible.length, "ACCOUNTQUESTIONEXPOSURES_WRITE_COUNT");
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
      await writtenAtMost(db
        .insert(s.accountPackCompletions)
        .values(
          eligible.map((a) => ({
            accountId: a.id,
            gameId: game.id,
            boardPosition: q.boardPosition,
            completedAt: now.toISOString(),
          })),
        )
        .onConflictDoNothing().returning(), eligible.length, "ACCOUNTPACKCOMPLETIONS_WRITE_COUNT");
  }
  @scoped("games.command")
  async command(
    actor: Actor,
    gameId: string,
    operationId: string,
    body: Contract<"GameCommand">,
  ): Promise<Contract<"Receipt">> {
    enrichContext({ gameId, operationId, accountId: actor.account?.accountId });
    let versionBefore = body.expectedGameVersion;
    let recovered = false;
    const hash = digest("gameCommand", gameId, body);
    return this.core
      .transaction(async (db) => {
        let game = await this.game(db, gameId);
        versionBefore = String(game.stateVersion);
        this.host(game, actor);
        const prior = await this.recover(db, gameId, operationId, hash);
        if (prior) { recovered = true; return prior; }
        const lockedAccounts = await this.lockRoster(db, game);
        requireState(
          lockedAccounts.find((a) => a.id === game.hostAccountId)?.state ===
            "active",
          "UNAUTHENTICATED",
          401,
        );
        const now = await freshTime(db),
          expected = revision(body.expectedGameVersion);
        if (
          game.status === "active" &&
          now.getTime() >= new Date(game.idleExpiresAt).getTime()
        ) {
          await this.finish(db, game, now, "idle_timeout");
          return { expired: true };
        }
        requireState(game.status === "active", "GAME_FINISHED");
        requireState(
          expected === game.stateVersion,
          "STALE_GAME_VERSION",
          409,
          { currentGameVersion: String(game.stateVersion) },
        );
        const name = body.name;
        if (name === "end_game") {
          game = await this.finish(db, game, now, "host_ended");
          return this.receipt(
            db,
            game,
            actor,
            operationId,
            name,
            hash,
            expected,
            now,
          );
        }
        let score: Partial<typeof s.gameActions.$inferInsert> = {},
          changes: Partial<Game> = {};
        if (name === "adjust_score") {
          const team = Number(body.teamNumber),
            before = team === 1 ? game.teamOneScore : game.teamTwoScore,
            after = BigInt(String(body.targetTotal));
          if (before === after)
            return this.receipt(
              db,
              game,
              actor,
              operationId,
              name,
              hash,
              expected,
              now,
            );
          changes =
            team === 1 ? { teamOneScore: after } : { teamTwoScore: after };
          score = {
            scoreEntryKind: "manual_adjustment",
            scoreTeamNumber: team,
            scoreTotalBefore: before,
            scoreTotalAfter: after,
            scoreDelta: after - before,
          };
        } else {
          const q = (
            await db
              .select()
              .from(s.gameQuestions)
              .where(
                this.slot({
                  gameId,
                  boardPosition: Number(body.boardPosition),
                  questionPosition: Number(body.questionPosition),
                }),
              )
          )[0];
          requireState(q && !q.resolvedAt, "QUESTION_UNAVAILABLE");
          const qc: Partial<typeof s.gameQuestions.$inferInsert> = {};
          const checkpoint = (navigation = false) => {
            const ms = remaining(q, now);
            Object.assign(qc, {
              timerState: ms ? "paused" : "elapsed",
              remainingMs: ms,
              timerDeadlineAt: null,
              resumeTimerOnReopen: ms > 0 && navigation,
            });
          };
          const run = (ms: number) =>
            Object.assign(qc, {
              timerState: "running",
              remainingMs: ms,
              timerDeadlineAt: new Date(now.getTime() + ms).toISOString(),
              resumeTimerOnReopen: false,
            });
          if (name === "open_question") {
            requireState(
              game.activeBoardPosition === null,
              "RETURN_TO_BOARD_FIRST",
            );
            changes = {
              activeBoardPosition: q.boardPosition,
              activeQuestionPosition: q.questionPosition,
              firstQuestionOpenedAt:
                game.firstQuestionOpenedAt ?? now.toISOString(),
            };
            if (!q.firstOpenedAt) {
              qc.firstOpenedAt = now.toISOString();
              if (q.format !== "IMAGE_MEMORY") run(60000);
              await this.exposure(db, game, q, now);
            } else if (q.resumeTimerOnReopen && !q.revealedAt)
              run(q.remainingMs);
          } else {
            requireState(
              game.activeBoardPosition === q.boardPosition &&
                game.activeQuestionPosition === q.questionPosition &&
                q.firstOpenedAt,
              "QUESTION_NOT_CURRENT",
            );
            if (name === "return_to_board") {
              if (q.timerState === "running") checkpoint(true);
              changes = {
                activeBoardPosition: null,
                activeQuestionPosition: null,
              };
            } else if (name === "resolve_question") {
              requireState(q.revealedAt, "ANSWER_NOT_REVEALED");
              const winner = body.winningTeamNumber;
              requireState(
                winner !== null ||
                  body.awardedPoints === undefined ||
                  body.awardedPoints === 0,
                "INVALID_AWARD",
                400,
              );
              const award =
                winner === null
                  ? 0
                  : body.awardedPoints === undefined
                    ? suggested(q)
                    : Number(body.awardedPoints);
              requireState(award <= q.basePoints, "AWARD_EXCEEDS_CAP", 400);
              Object.assign(qc, {
                winningTeamNumber: winner,
                awardedPoints: award,
                resolvedAt: now.toISOString(),
                resolvedByAccountId: game.hostAccountId,
                resolutionCommandId: operationId,
                resumeTimerOnReopen: false,
              });
              changes = {
                activeBoardPosition: null,
                activeQuestionPosition: null,
              };
              if (winner !== null) {
                const before =
                    winner === 1 ? game.teamOneScore : game.teamTwoScore,
                  after = before + BigInt(award);
                Object.assign(
                  changes,
                  winner === 1
                    ? { teamOneScore: after }
                    : { teamTwoScore: after },
                );
                score = {
                  scoreEntryKind: "question_award",
                  scoreTeamNumber: winner,
                  scoreDelta: BigInt(award),
                  scoreTotalBefore: before,
                  scoreTotalAfter: after,
                  scoreSourceBoardPosition: q.boardPosition,
                  scoreSourceQuestionPosition: q.questionPosition,
                };
              }
            } else {
              requireState(!q.revealedAt, "ANSWER_ALREADY_REVEALED");
              if (name === "advance_hint") {
                requireState(
                  ["IMAGE_BLUR", "IMAGE_ZOOM"].includes(q.format) &&
                    q.stageIndex < 2,
                  "HINT_UNAVAILABLE",
                );
                qc.stageIndex = q.stageIndex + 1;
              } else if (name === "show_memory") {
                requireState(
                  q.format === "IMAGE_MEMORY" && !q.memoryImageVisible,
                  "MEMORY_UNAVAILABLE",
                );
                qc.memoryFirstShownAt =
                  q.memoryFirstShownAt ?? now.toISOString();
                qc.memoryImageVisible = true;
              } else if (name === "hide_memory") {
                requireState(
                  q.format === "IMAGE_MEMORY" && q.memoryImageVisible,
                  "MEMORY_UNAVAILABLE",
                );
                qc.memoryImageVisible = false;
                if (!q.memoryFirstHiddenAt) {
                  qc.memoryFirstHiddenAt = now.toISOString();
                  run(60000);
                }
              } else {
                requireState(
                  q.format !== "IMAGE_MEMORY" || q.memoryFirstHiddenAt,
                  "MEMORY_HIDE_REQUIRED",
                );
                if (name === "pause_timer") {
                  requireState(q.timerState === "running", "TIMER_NOT_RUNNING");
                  checkpoint();
                } else if (name === "resume_timer") {
                  requireState(q.timerState === "paused", "TIMER_NOT_PAUSED");
                  run(q.remainingMs);
                } else if (name === "reset_timer") {
                  requireState(q.timerState !== "ready", "TIMER_NOT_STARTED");
                  run(60000);
                } else if (name === "reveal_answer") {
                  if (q.timerState === "running") checkpoint();
                  qc.revealedAt = now.toISOString();
                  qc.resumeTimerOnReopen = false;
                  if (q.format === "IMAGE_MEMORY") qc.memoryImageVisible = true;
                } else requireState(false, "INVALID_COMMAND", 400);
              }
            }
          }
          if (Object.keys(qc).length)
            single(await db.update(s.gameQuestions).set(qc).where(this.slot(q)).returning(), "GAMEQUESTIONS_WRITE_ROW");
          if (name === "resolve_question")
            await this.completion(db, game, q, now);
        }
        let complete = false;
        if (name === "resolve_question") {
          const count = await db.execute(
            sql`SELECT count(*)::int AS n FROM game_questions WHERE game_id=${gameId} AND resolved_at IS NOT NULL`,
          );
          complete = single(count.rows, "GAME_RESOLVED_COUNT_ROW").n === 36;
        }
        if (complete)
          game = await this.finish(
            db,
            { ...game, ...changes },
            now,
            "completed",
          );
        else {
          const updated = single(await db
            .update(s.games)
            .set({
              ...changes,
              stateVersion: expected + 1n,
              projectionVersion: game.projectionVersion + 1n,
              lastGameplayAt: now.toISOString(),
              idleExpiresAt: plusDay(now),
            })
            .where(eq(s.games.id, game.id))
            .returning(), "GAMES_UPDATED_ROW");
          versionIncrement(game.stateVersion, updated.stateVersion);
          versionIncrement(game.projectionVersion, updated.projectionVersion);
          game = updated;
        }
        await this.core.hint(
          db,
          game.roomId,
          0n,
          game.id,
          game.projectionVersion,
        );
        return this.receipt(
          db,
          game,
          actor,
          operationId,
          name,
          hash,
          expected,
          now,
          {},
          score,
        );
      })
      .then((result) => {
        requireState(!("expired" in result), "GAME_EXPIRED", 410);
        log.info(`games.commands.${body.name}`, { name: body.name, versionBefore, versionAfter: result.gameVersion, outcome: recovered ? "replayed" : result.effect });
        return result;
      }).catch((error: unknown) => {
        log.info(`games.commands.${body.name}`, { name: body.name, versionBefore, outcome: error instanceof Error && "code" in error ? String(error.code) : "failed" });
        throw error;
      });
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
    return this.core.transaction(async (db) => {
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
      single(await db
        .update(s.gameQuestions)
        .set({
          feedbackVote: body.vote,
          feedbackVersion: q.feedbackVersion + 1n,
          feedbackByAccountId: game.hostAccountId,
          feedbackCreatedAt: q.feedbackCreatedAt ?? now.toISOString(),
          feedbackUpdatedAt: now.toISOString(),
        })
        .where(this.slot(q)).returning(), "GAMEQUESTIONS_WRITE_ROW");
      const updated = single(await db
        .update(s.games)
        .set({ projectionVersion: game.projectionVersion + 1n })
        .where(eq(s.games.id, gameId))
        .returning(), "GAMES_UPDATED_ROW");
      versionIncrement(game.projectionVersion, updated.projectionVersion);
      invariant(updated.stateVersion === game.stateVersion, "FEEDBACK_GAME_VERSION_STABLE");
      await this.core.hint(
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
