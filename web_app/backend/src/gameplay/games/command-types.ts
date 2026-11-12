import type { Contract } from "../contract.js";
import type { GameOperations } from "../games.js";
import type { Actor, Game, Tx } from "../service.js";
import type * as s from "../../database/schema/index.js";
export type Command = Contract<"GameCommand">;
export type CommandName = Command["name"];
export type CommandBodies = {
  [N in CommandName]: Extract<Command, { name: N }>;
};
export interface ActionContext {
  operations: GameOperations;
  db: Tx;
  game: Game;
  actor: Actor;
  operationId: string;
  now: Date;
}
export type CommandContext<N extends CommandName> = ActionContext & {
  body: CommandBodies[N];
};
export type ScoreEntry = Partial<typeof s.gameActions.$inferInsert>;
export type CommandEffect =
  | { kind: "unchanged" }
  | { kind: "finished"; game: Game }
  | { kind: "changed"; changes: Partial<Game>; score?: ScoreEntry };
export type Handler<N extends CommandName> = (
  context: CommandContext<N>,
) => Promise<CommandEffect>;
export type HandlerMap = { [N in CommandName]: Handler<N> };
