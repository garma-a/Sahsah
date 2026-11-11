import { GameplayIdentity } from "../platform/identity.js";
import { scoped, enrichContext, log } from "../platform/logging.js";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import { requireState } from "../platform/problem.js";
import type { Actor, Tx, Room, Member } from "../platform/types.js";

@Injectable()
export class RoomAccess {
  constructor(readonly identity: GameplayIdentity) {}

  @scoped("platform.room-access.room")
  async room(db: Tx, roomId: string, lock = true): Promise<Room> {
    const query = db.select().from(s.rooms).where(eq(s.rooms.id, roomId));
    const waiting = performance.now();
    const room = (await (lock ? query.for("update") : query))[0];
    if (lock)
      log.debug("rooms.room.lock", { waitMs: performance.now() - waiting });
    requireState(room, "NOT_FOUND", 404);
    enrichContext({ roomId: room.id });
    return room;
  }
  async members(db: Tx, roomId: string) {
    return db
      .select()
      .from(s.roomMemberships)
      .where(
        and(
          eq(s.roomMemberships.roomId, roomId),
          isNull(s.roomMemberships.leftAt),
          isNull(s.roomMemberships.removedAt),
        ),
      )
      .orderBy(s.roomMemberships.joinedAt, s.roomMemberships.id);
  }
  async membership(
    db: Tx,
    room: Room,
    actor: Actor,
    live = true,
  ): Promise<Member> {
    if (actor.account)
      requireState(
        actor.account.expiresAt > Date.now(),
        "UNAUTHENTICATED",
        401,
      );
    const predicate = actor.member
      ? eq(s.roomMemberships.id, actor.member.id)
      : eq(s.roomMemberships.accountId, actor.account!.accountId);
    const member = (
      await db
        .select()
        .from(s.roomMemberships)
        .where(and(eq(s.roomMemberships.roomId, room.id), predicate))
        .orderBy(
          sql`(${s.roomMemberships.leftAt} IS NULL AND ${s.roomMemberships.removedAt} IS NULL) DESC`,
          sql`${s.roomMemberships.joinedAt} DESC`,
        )
    )[0];
    requireState(member, "NOT_FOUND", 404);
    if (live) {
      const permitted =
        !room.closedAt &&
        !member.leftAt &&
        !member.removedAt &&
        (!actor.member || (!member.accountId && !member.reconnectRevokedAt));
      if (!permitted) this.identity.forgetCredential(actor);
      requireState(permitted, "MEMBERSHIP_REVOKED", 403);
    }
    return member;
  }
}
