import { eq } from "drizzle-orm";

import * as s from "../../../database/schema/index.js";
import { requireState } from "../../problem.js";

import type { GameOperations } from "../../games.js";
import type { Room, Tx } from "../../service.js";
export async function loadStartRoster(
  operations: GameOperations,
  db: Tx,
  room: Room,
) {
  const roomId = room.id;
  const roster = await operations.core.members(db, roomId);
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

  return { roster, selections };
}
