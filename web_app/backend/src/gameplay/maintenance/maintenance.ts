import { DatabaseService } from "../../database/database.module.js";
import { GameplayOutbox } from "../platform/outbox.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { log, withContext, errorStack } from "../platform/logging.js";
import { single } from "../platform/invariant.js";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
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
          const due = await this.database.db.execute(
            sql`SELECT id FROM games WHERE status='active' AND idle_expires_at<=clock_timestamp() ORDER BY idle_expires_at,id LIMIT 5`,
          );
          games = due.rows.length;
          for (const row of due.rows) await this.games.expire(String(row.id));
          const rooms = await this.database.db.execute(
            sql`SELECT r.id FROM rooms r LEFT JOIN games g ON g.id=r.current_game_id WHERE r.closed_at IS NULL AND (g.id IS NULL OR g.status<>'active') AND greatest(r.last_lobby_activity_at,coalesce(g.ended_at,r.last_lobby_activity_at))+interval '24 hours'<=clock_timestamp() ORDER BY r.lobby_idle_expires_at,r.id LIMIT 5`,
          );
          roomsCount = rooms.rows.length;
          for (const row of rooms.rows)
            await this.rooms.expireRoom(String(row.id));
          await this.purge();
          await this.database.transaction(async (db) => {
            const dueCodes = await db.execute(
              sql`SELECT id FROM rooms WHERE invitation_code IS NOT NULL AND invitation_expires_at<=clock_timestamp() ORDER BY invitation_expires_at,id FOR UPDATE SKIP LOCKED LIMIT 100`,
            );
            invitations = dueCodes.rows.length;
            for (const row of dueCodes.rows) {
              const room = single(
                await db
                  .update(s.rooms)
                  .set({
                    invitationCode: null,
                    invitationIssuedAt: null,
                    invitationExpiresAt: null,
                    invitationRevokedAt: null,
                    stateVersion: sql`${s.rooms.stateVersion}+1`,
                  })
                  .where(eq(s.rooms.id, String(row.id)))
                  .returning(),
                "MAINTENANCE_ROOM_ROW",
              );
              await this.outbox.hint(db, room.id, room.stateVersion);
            }
          });
          await this.database.transaction(async (db) => {
            await db.execute(
              sql`DELETE FROM room_actions WHERE operation_id IN (SELECT operation_id FROM room_actions WHERE expires_at<=clock_timestamp() ORDER BY expires_at,operation_id LIMIT 100)`,
            );
            await db.execute(
              sql`DELETE FROM game_actions WHERE (game_id,command_id) IN (SELECT game_id,command_id FROM game_actions WHERE score_entry_kind IS NULL AND accepted_at<=clock_timestamp()-interval '7 days' ORDER BY accepted_at,game_id LIMIT 100)`,
            );
            await db.execute(
              sql`DELETE FROM outbox_events WHERE id IN (SELECT id FROM outbox_events WHERE state='succeeded' AND finished_at<=clock_timestamp()-interval '7 days' ORDER BY finished_at,id LIMIT 100)`,
            );
          });
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
    const events = await this.database.transaction(async (db) => {
      const result = await db.execute<{
        id: string;
        payload: { roomId: string };
        created_at: Date;
        deduplication_key: string;
      }>(sql`WITH candidates AS (SELECT id FROM outbox_events WHERE topic IN ('room.changed','game.changed','account.gameplay.changed') AND ((state='pending' AND available_at<=clock_timestamp()) OR (state='running' AND lease_until<=clock_timestamp())) AND attempt_count<max_attempts ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 50)
        UPDATE outbox_events e SET state='running',attempt_count=e.attempt_count+1,lease_token=${lease},lease_until=clock_timestamp()+interval '30 seconds' FROM candidates c WHERE e.id=c.id RETURNING e.id,e.payload,e.created_at,e.deduplication_key`);
      return result.rows;
    });
    log.debug("platform.outbox.dispatch", { count: events.length });
    // Hints already pushed in-process after their commit are only acknowledged.
    for (const roomId of new Set(
      events
        .filter((e) => !this.outbox.takePushed(e.deduplication_key))
        .map((e) => e.payload.roomId),
    ))
      this.realtime.invalidate(roomId);
    if (events.length) {
      await this.database.transaction((db) =>
        db.execute(
          sql`UPDATE outbox_events SET state='succeeded',finished_at=clock_timestamp(),lease_token=NULL,lease_until=NULL WHERE lease_token=${lease} AND state='running'`,
        ),
      );
      for (const e of events)
        this.runtime.metrics.dispatched(
          Math.max(0, Date.now() - new Date(e.created_at).getTime()),
        );
    }
    await this.database.transaction((db) =>
      db.execute(
        sql`UPDATE outbox_events SET state='dead',finished_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error_code='RETRY_EXHAUSTED' WHERE topic IN ('room.changed','game.changed','account.gameplay.changed') AND attempt_count=max_attempts AND ((state='pending') OR (state='running' AND lease_until<=clock_timestamp()))`,
      ),
    );
  }
  private async purge() {
    await this.database.transaction(async (db) => {
      const result = await db.execute(
        sql`SELECT id FROM games WHERE status<>'active' AND content_purged_at IS NULL AND content_purge_after<=clock_timestamp() ORDER BY content_purge_after,id FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      if (!result.rows.length) return;
      const id = String(single(result.rows, "PURGE_CANDIDATE_ROW").id),
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
