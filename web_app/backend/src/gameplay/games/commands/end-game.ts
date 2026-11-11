import { type Handler } from "../command-types.js";
export const end_game: Handler<"end_game"> = async (ctx) => {
  const { body, game, now, db, operations, operationId } = ctx;
  return { kind: "finished", game: await operations.finish(db, game, now, "host_ended") };
};
