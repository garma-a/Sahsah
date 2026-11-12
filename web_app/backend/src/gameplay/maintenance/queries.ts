import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import type { Tx } from "../platform/types.js";

// PostgreSQL wall-clock and calendar intervals must retain their database semantics.
const wallClock = sql<string>`clock_timestamp()`;
const weekAgo = sql<string>`clock_timestamp()-interval '7 days'`;
const leaseDeadline = sql<string>`clock_timestamp()+interval '30 seconds'`;
const topics = ["room.changed", "game.changed", "account.gameplay.changed"];
const expiredLease = () =>
  and(
    eq(s.outboxEvents.state, "running"),
    lte(s.outboxEvents.leaseUntil, wallClock),
  );

export function dueGames(db: Tx) {
  return db
    .select({ id: s.games.id })
    .from(s.games)
    .where(
      and(eq(s.games.status, "active"), lte(s.games.idleExpiresAt, wallClock)),
    )
    .orderBy(s.games.idleExpiresAt, s.games.id)
    .limit(5);
}
export function dueRooms(db: Tx) {
  // greatest/coalesce and a calendar interval match the effective lobby deadline.
  const deadline = sql<string>`greatest(${s.rooms.lastLobbyActivityAt},coalesce(${s.games.endedAt},${s.rooms.lastLobbyActivityAt}))+interval '24 hours'`;
  return db
    .select({ id: s.rooms.id })
    .from(s.rooms)
    .leftJoin(s.games, eq(s.games.id, s.rooms.currentGameId))
    .where(
      and(
        isNull(s.rooms.closedAt),
        or(isNull(s.games.id), ne(s.games.status, "active")),
        lte(deadline, wallClock),
      ),
    )
    .orderBy(s.rooms.lobbyIdleExpiresAt, s.rooms.id)
    .limit(5);
}
export function expiredInvitations(db: Tx) {
  return db
    .select({ id: s.rooms.id })
    .from(s.rooms)
    .where(
      and(
        isNotNull(s.rooms.invitationCode),
        lte(s.rooms.invitationExpiresAt, wallClock),
      ),
    )
    .orderBy(s.rooms.invitationExpiresAt, s.rooms.id)
    .for("update", { skipLocked: true })
    .limit(100);
}
export async function deleteOldReceipts(db: Tx) {
  await db
    .delete(s.roomActions)
    .where(
      inArray(
        s.roomActions.operationId,
        db
          .select({ operationId: s.roomActions.operationId })
          .from(s.roomActions)
          .where(lte(s.roomActions.expiresAt, wallClock))
          .orderBy(s.roomActions.expiresAt, s.roomActions.operationId)
          .limit(100),
      ),
    );
  // Drizzle 0.45 has no tuple-column helper; keep the exact composite IN identity.
  await db.delete(s.gameActions).where(
    inArray(
      sql<
        [string, string]
      >`(${s.gameActions.gameId},${s.gameActions.commandId})`,
      db
        .select({
          gameId: s.gameActions.gameId,
          commandId: s.gameActions.commandId,
        })
        .from(s.gameActions)
        .where(
          and(
            isNull(s.gameActions.scoreEntryKind),
            lte(s.gameActions.acceptedAt, weekAgo),
          ),
        )
        .orderBy(s.gameActions.acceptedAt, s.gameActions.gameId)
        .limit(100),
    ),
  );
  await db.delete(s.outboxEvents).where(
    inArray(
      s.outboxEvents.id,
      db
        .select({ id: s.outboxEvents.id })
        .from(s.outboxEvents)
        .where(
          and(
            eq(s.outboxEvents.state, "succeeded"),
            lte(s.outboxEvents.finishedAt, weekAgo),
          ),
        )
        .orderBy(s.outboxEvents.finishedAt, s.outboxEvents.id)
        .limit(100),
    ),
  );
}
export function claimEvents(db: Tx, lease: string) {
  const candidates = db.$with("candidates").as(
    db
      .select({ id: s.outboxEvents.id })
      .from(s.outboxEvents)
      .where(
        and(
          inArray(s.outboxEvents.topic, topics),
          or(
            and(
              eq(s.outboxEvents.state, "pending"),
              lte(s.outboxEvents.availableAt, wallClock),
            ),
            expiredLease(),
          ),
          lt(s.outboxEvents.attemptCount, s.outboxEvents.maxAttempts),
        ),
      )
      .orderBy(s.outboxEvents.availableAt, s.outboxEvents.id)
      .for("update", { skipLocked: true })
      .limit(50),
  );
  return db
    .with(candidates)
    .update(s.outboxEvents)
    .set({
      state: "running",
      // Increment in PostgreSQL while the candidate rows remain locked.
      attemptCount: sql<number>`${s.outboxEvents.attemptCount}+1`,
      leaseToken: lease,
      leaseUntil: leaseDeadline,
    })
    .from(candidates)
    .where(eq(s.outboxEvents.id, candidates.id))
    .returning({
      id: s.outboxEvents.id,
      payload: s.outboxEvents.payload,
      createdAt: s.outboxEvents.createdAt,
      deduplicationKey: s.outboxEvents.deduplicationKey,
    });
}
export function succeedEvents(db: Tx, lease: string) {
  return db
    .update(s.outboxEvents)
    .set({
      state: "succeeded",
      finishedAt: wallClock,
      leaseToken: null,
      leaseUntil: null,
    })
    .where(
      and(
        eq(s.outboxEvents.leaseToken, lease),
        eq(s.outboxEvents.state, "running"),
      ),
    );
}
export function exhaustEvents(db: Tx) {
  return db
    .update(s.outboxEvents)
    .set({
      state: "dead",
      finishedAt: wallClock,
      leaseToken: null,
      leaseUntil: null,
      lastErrorCode: "RETRY_EXHAUSTED",
    })
    .where(
      and(
        inArray(s.outboxEvents.topic, topics),
        eq(s.outboxEvents.attemptCount, s.outboxEvents.maxAttempts),
        or(eq(s.outboxEvents.state, "pending"), expiredLease()),
      ),
    );
}
export function purgeCandidates(db: Tx) {
  return db
    .select({ id: s.games.id })
    .from(s.games)
    .where(
      and(
        ne(s.games.status, "active"),
        isNull(s.games.contentPurgedAt),
        lte(s.games.contentPurgeAfter, wallClock),
      ),
    )
    .orderBy(s.games.contentPurgeAfter, s.games.id)
    .for("update", { skipLocked: true })
    .limit(1);
}
