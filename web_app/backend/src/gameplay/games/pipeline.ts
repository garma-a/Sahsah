import { eq, sql } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import type { GameOperations } from "../games.js";
import type { Actor } from "../service.js";
import { freshTime, plusDay } from "../service.js";
import type { Contract } from "../contract.js";
import { revision } from "../contract.js";
import { digest } from "../proof.js";
import { requireState } from "../problem.js";
import { single, versionIncrement } from "../invariant.js";
import { enrichContext, log, withContext } from "../logging.js";
import { handleCommand } from "./commands.js";
export async function runGameCommand(operations: GameOperations, actor: Actor, gameId: string, operationId: string, body: Contract<"GameCommand">): Promise<Contract<"Receipt">> {
    enrichContext({ gameId, operationId, accountId: actor.account?.accountId });
    let versionBefore = body.expectedGameVersion;
    let recovered = false;
    const hash = digest("gameCommand", gameId, body);
    return operations.core
      .transaction(async (db) => {
        let game = await operations.game(db, gameId);
        versionBefore = String(game.stateVersion);
        operations.host(game, actor);
        const prior = await operations.recover(db, gameId, operationId, hash);
        if (prior) { recovered = true; return prior; }
        const lockedAccounts = await operations.lockRoster(db, game);
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
          await operations.finish(db, game, now, "idle_timeout");
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
        const effect = await withContext(`games.commands.${name}`, () => handleCommand(name, { operations, db, game, actor, operationId, now }, body));
        if (effect.kind === "finished" || effect.kind === "unchanged") {
          if (effect.kind === "finished") game = effect.game;
          return operations.receipt(db, game, actor, operationId, name, hash, expected, now);
        }
        const { changes, score = {} } = effect;
        let complete = false;
        if (name === "resolve_question") {
          const count = await db.execute(
            sql`SELECT count(*)::int AS n FROM game_questions WHERE game_id=${gameId} AND resolved_at IS NOT NULL`,
          );
          complete = single(count.rows, "GAME_RESOLVED_COUNT_ROW").n === 36;
        }
        if (complete)
          game = await operations.finish(
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
        await operations.core.hint(
          db,
          game.roomId,
          0n,
          game.id,
          game.projectionVersion,
        );
        return operations.receipt(
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
