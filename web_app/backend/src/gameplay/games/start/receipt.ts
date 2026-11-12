import { inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../../../database/schema/index.js";
import { single } from "../../platform/invariant.js";
import type { Game } from "../../platform/types.js";
import type { StartState } from "./types.js";
export async function finishStart(state: StartState, game: Game) {
  const {
    operations,
    db,
    room,
    roomId,
    actor,
    operationId,
    hash,
    now,
    accounts,
  } = state;
  const gameId = game.id;
  await db
    .update(s.accounts)
    .set({ activeGameId: gameId, activeGameClaimedAt: now.toISOString() })
    .where(
      inArray(
        s.accounts.id,
        accounts.map((a) => a.id),
      ),
    );
  single(
    await db
      .insert(s.tokenLedgerEntries)
      .values({
        id: randomUUID(),
        accountId: room.ownerAccountId,
        entryKind: "game_debit",
        amount: -1,
        idempotencyKey: `start:${operationId}`,
        gameId,
        createdAt: now.toISOString(),
      })
      .returning(),
    "TOKENLEDGERENTRIES_WRITE_ROW",
  );
  const updated = await operations.rooms.bump(
    db,
    room,
    now,
    false,
    { currentGameId: gameId, presentationMode: "game" },
    false,
  );
  await operations.outbox.hint(
    db,
    roomId,
    updated.stateVersion,
    game.id,
    game.projectionVersion,
  );
  return operations.receipts.saveReceipt(
    db,
    updated,
    actor,
    operationId,
    "startGame",
    hash,
    now,
    {
      ...operations.rooms.fields(updated),
      ...operations.fields(game),
      controllerGeneration: String(game.controllerGeneration),
    },
  );
}
