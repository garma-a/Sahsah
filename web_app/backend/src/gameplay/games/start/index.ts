import { eq } from "drizzle-orm";
import * as s from "../../../database/schema/index.js";
import { digest, equalProof } from "../../proof.js";
import { requireState } from "../../problem.js";
import { freshTime, iso } from "../../service.js";
import type { Actor, Tx } from "../../service.js";
import type { GameOperations } from "../../games.js";
import type { Contract } from "../../contract.js";
import { loadStartRoster } from "./roster.js";
import { lockStartContent } from "./content.js";
import { validateStart } from "./validation.js";
import { createGameSnapshot } from "./create-game.js";
import { copyQuestionSnapshots } from "./questions.js";
import { finishStart } from "./receipt.js";
export async function startGame(
  operations: GameOperations,
  actor: Actor,
  roomId: string,
  operationId: string,
  body: Contract<"StartGame">,
): Promise<Contract<"Receipt">> {
  const hash = digest("startGame", roomId, body);
  const original = (
    await operations.core.database.db
      .select()
      .from(s.games)
      .where(eq(s.games.startRequestId, operationId))
  )[0];
  if (original) {
    operations.host(original, actor, false);
    requireState(
      original.roomId === roomId &&
        equalProof(original.startRequestDigest, hash),
      "OPERATION_CONFLICT",
    );
    const receipt = await operations.core.receipt(
      operations.core.database.db,
      operationId,
      hash,
    );
    if (receipt) return receipt;
    const room = await operations.core.room(
      operations.core.database.db,
      roomId,
      false,
    );
    return {
      operationId,
      roomId,
      acceptedAt: iso(original.startedAt),
      effect: "changed",
      roomVersion: String(room.stateVersion),
      readyGeneration: room.lobbyGeneration,
      ...operations.fields(original),
      controllerGeneration: String(original.controllerGeneration),
    };
  }
  const initialRoom = await operations.core.room(
    operations.core.database.db,
    roomId,
    false,
  );
  operations.core.host(initialRoom, actor);
  requireState(
    operations.core.admission.availability().admission === "open",
    "SERVER_AT_CAPACITY",
    503,
  );
  await operations.preflight(roomId);
  return operations.core.admission.allocate(`start:${operationId}`, hash, () =>
    operations.core.transaction((db) =>
      startLocked(operations, db, actor, roomId, operationId, body, hash),
    ),
  );
}

async function startLocked(
  operations: GameOperations,
  db: Tx,
  actor: Actor,
  roomId: string,
  operationId: string,
  body: Contract<"StartGame">,
  hash: Buffer,
) {
  const room = await operations.core.room(db, roomId);
  operations.core.host(room, actor);
  const prior = await operations.core.receipt(db, operationId, hash);
  if (prior) return prior;
  const { roster, selections } = await loadStartRoster(operations, db, room);
  const content = await lockStartContent(db, selections);
  const accounts = await operations.accounts(
    db,
    roster.flatMap((m) => (m.accountId ? [m.accountId] : [])),
  );
  const now = await freshTime(db);
  const state = {
    operations,
    db,
    actor,
    roomId,
    operationId,
    body,
    hash,
    room,
    roster,
    selections,
    content,
    accounts,
    now,
  };
  await validateStart(state);
  const game = await createGameSnapshot(state);
  await copyQuestionSnapshots(state, game.id);
  return finishStart(state, game);
}
