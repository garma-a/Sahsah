import { eq, max, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../../../database/schema/index.js";
import { single, written } from "../../platform/invariant.js";
import { orderSeats } from "../rules/turn-order.js";
import { enrichContext, log } from "../../platform/logging.js";
import { proof } from "../../platform/proof.js";
import { plusDay } from "../../platform/clock.js";
import type { StartState } from "./types.js";
export async function createGameSnapshot(state: StartState) {
  const {
    operations,
    db,
    actor,
    room,
    roomId,
    operationId,
    hash,
    now,
    roster,
    selections,
    content: { packs, categories },
  } = state;
  const gameId = randomUUID();
  const sequence = await db
    .select({
      // Preserve PostgreSQL integer coalesce/max/+1 for the room-local sequence.
      n: sql<number>`coalesce(${max(s.games.sequenceNumber)},0)+1`,
    })
    .from(s.games)
    .where(eq(s.games.roomId, roomId));
  const game = single(
    await db
      .insert(s.games)
      .values({
        id: gameId,
        roomId,
        sequenceNumber: Number(single(sequence, "GAME_SEQUENCE_ROW").n),
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
      .returning(),
    "GAMES_GAME_ROW",
  );
  enrichContext({ gameId, roomId, operationId });
  operations.transactions.afterCommit(db, () =>
    log.info("games.start", { outcome: "created" }),
  );
  const ordered = orderSeats(roster, room.ownerAccountId);
  await written(
    db
      .insert(s.gamePlayers)
      .values(
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
      )
      .returning(),
    ordered.length,
    "GAMEPLAYERS_WRITE_COUNT",
  );
  await written(
    db
      .insert(s.gamePacks)
      .values(
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
      )
      .returning(),
    selections.length,
    "GAMEPACKS_WRITE_COUNT",
  );

  return game;
}
