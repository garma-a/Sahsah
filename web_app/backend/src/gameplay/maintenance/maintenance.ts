import * as queries from "./queries.js";
import { invariant } from "../platform/invariant.js";
import { DatabaseService } from "../../database/database.module.js";
import { GameplayOutbox } from "../platform/outbox.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { log, withContext, errorStack } from "../platform/logging.js";
import { single } from "../platform/invariant.js";
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../../database/schema/index.js";
import { freshTime } from "../platform/clock.js";
import { GameOperations } from "../games/operations.js";
import { RoomLifecycle } from "../rooms/lifecycle.js";
import { GameplayRealtime } from "../realtime/gateway.js";
import { databaseCode } from "../platform/problem.js";

@Injectable()
export class GameplayMaintenance implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private stopped = false;
  private lastHousekeeping = 0;
  private lastDispatch = 0;
  private current?: Promise<void>;
  constructor(
    readonly runtime: GameplayRuntime,
    readonly outbox: GameplayOutbox,
    readonly database: DatabaseService,
    private games: GameOperations,
    private rooms: RoomLifecycle,
    private realtime: GameplayRealtime,
  ) {}
  onModuleInit() {
    if (!this.runtime.options.enabled) return;
    this.timer = setInterval(() => {
      if (!this.busy && !this.stopped) {
        this.current = withContext("maintenance.pass", () => this.pass(), {
          requestId: randomUUID(),
        });
      }
    }, 100);
    this.timer.unref();
  }
  private async pass() {
    this.busy = true;
    let games = 0,
      roomsCount = 0,
      invitations = 0;
    try {
      // Mutations push live views in-process after commit; this poll only
      // delivers maintenance changes and hints orphaned by a failed push.
      if (Date.now() - this.lastDispatch >= 500) {
        this.lastDispatch = Date.now();
        await this.runtime.scheduler.run("background", () => this.dispatch());
      }
      if (Date.now() - this.lastHousekeeping >= 1000) {
        this.lastHousekeeping = Date.now();
        await this.runtime.scheduler.run("background", async () => {
          const due = await queries.dueGames(this.database.db);
          games = due.length;
          for (const row of due) await this.games.expire(String(row.id));
          const rooms = await queries.dueRooms(this.database.db);
          roomsCount = rooms.length;
          for (const row of rooms) await this.rooms.expireRoom(String(row.id));
          await this.purge();
          await this.database.transaction(async (db) => {
            const dueCodes = await queries.expiredInvitations(db);
            invitations = dueCodes.length;
            for (const row of dueCodes) {
              const room = single(
                await db
                  .update(s.rooms)
                  .set({
                    invitationCode: null,
                    invitationIssuedAt: null,
                    invitationExpiresAt: null,
                    invitationRevokedAt: null,
                    // The locked row advances atomically in PostgreSQL.
                    stateVersion: sql<bigint>`${s.rooms.stateVersion}+1`,
                  })
                  .where(eq(s.rooms.id, String(row.id)))
                  .returning(),
                "MAINTENANCE_ROOM_ROW",
              );
              await this.outbox.hint(db, room.id, room.stateVersion);
            }
          });
          await this.database.transaction((db) =>
            queries.deleteOldReceipts(db),
          );
          await this.runtime.reconcileOccupancy();
        });
      }
    } catch (error) {
      // Budget refusal is routine. Diagnostics never include SQL or parameters.
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : (databaseCode(error) ?? "MAINTENANCE_FAILURE");
      if (code !== "WORK_BUDGET_EXHAUSTED")
        log.error("maintenance.pass", { code, stack: errorStack(error) });
    } finally {
      log.debug("maintenance.pass", { games, rooms: roomsCount, invitations });
      this.busy = false;
    }
  }
  private async dispatch() {
    const lease = randomUUID();
    const events = await this.database.transaction((db) =>
      queries.claimEvents(db, lease),
    );
    log.debug("platform.outbox.dispatch", { count: events.length });
    // Hints already pushed in-process after their commit are only acknowledged.
    for (const roomId of new Set(
      events
        .filter((e) => !this.outbox.takePushed(e.deduplicationKey))
        .map((e) => {
          invariant(typeof e.payload.roomId === "string", "OUTBOX_ROOM_HINT");
          return e.payload.roomId;
        }),
    ))
      this.realtime.invalidate(roomId);
    if (events.length) {
      await this.database.transaction((db) => queries.succeedEvents(db, lease));
      for (const e of events)
        this.runtime.metrics.dispatched(
          Math.max(0, Date.now() - new Date(e.createdAt).getTime()),
        );
    }
    await this.database.transaction((db) => queries.exhaustEvents(db));
  }
  private async purge() {
    await this.database.transaction(async (db) => {
      const result = await queries.purgeCandidates(db);
      if (!result.length) return;
      const id = String(single(result, "PURGE_CANDIDATE_ROW").id),
        game = await this.games.game(db, id),
        now = await freshTime(db);
      single(
        await db
          .update(s.games)
          .set({
            contentPurgedAt: now.toISOString(),
            projectionVersion: game.projectionVersion + 1n,
          })
          .where(eq(s.games.id, id))
          .returning(),
        "GAMES_WRITE_ROW",
      );
      await db
        .update(s.gameQuestions)
        .set({ contentSnapshot: null, contentPurgedAt: now.toISOString() })
        .where(eq(s.gameQuestions.gameId, id));
      await db
        .delete(s.gameQuestionMedia)
        .where(eq(s.gameQuestionMedia.gameId, id));
      await this.outbox.hint(
        db,
        game.roomId,
        0n,
        id,
        game.projectionVersion + 1n,
      );
    });
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.current;
  }
}
