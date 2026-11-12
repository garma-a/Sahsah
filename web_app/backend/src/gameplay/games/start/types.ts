import type { GameOperations } from "../operations.js";
import type { Actor, Member, Room, Tx } from "../../platform/types.js";
import type { Contract } from "../../contract.js";
import type * as s from "../../../database/schema/index.js";
import type { lockStartContent } from "./content.js";
export type Selections = (typeof s.roomPackSelections.$inferSelect)[];
export type Content = Awaited<ReturnType<typeof lockStartContent>>;
export interface StartState {
  operations: GameOperations;
  db: Tx;
  actor: Actor;
  roomId: string;
  operationId: string;
  body: Contract<"StartGame">;
  hash: Buffer;
  room: Room;
  roster: Member[];
  selections: Selections;
  content: Content;
  accounts: Awaited<ReturnType<GameOperations["accounts"]>>;
  now: Date;
}
