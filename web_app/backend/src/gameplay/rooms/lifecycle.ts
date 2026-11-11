import { DatabaseService } from "../../database/database.module.js";
import { GameplayTransactions } from "../platform/transaction.js";
import { GameplayOutbox } from "../platform/outbox.js";
import { RoomReceipts } from "../platform/receipts.js";
import { RoomAccess } from "./access.js";
import { GameplayIdentity } from "../platform/identity.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { scoped, log } from "../platform/logging.js";
import { single, writtenAtMost } from "../platform/invariant.js";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import { revision } from "../contract.js";
import { digest, equalProof, proof } from "../platform/proof.js";
import { requireState } from "../platform/problem.js";
import { GameOperations } from "../games/operations.js";
import { RoomOperations } from "./operations.js";
import { freshTime } from "../platform/clock.js";
import type { Actor, Room, Tx } from "../platform/types.js";
import type { Contract } from "../contract.js";

@Injectable()
export class RoomLifecycle {
  constructor(
    readonly runtime: GameplayRuntime,
    readonly identity: GameplayIdentity,
    readonly access: RoomAccess,
    readonly receipts: RoomReceipts,
    readonly outbox: GameplayOutbox,
    readonly transactions: GameplayTransactions,
    readonly database: DatabaseService,
    private rooms: RoomOperations,
    private games: GameOperations,
  ) {}
  async prepareCreate(actor: Actor, operationId: string) {
    this.runtime.enabled();
    if (!actor.account) return;
    const source = (
      await this.database.db
        .select({ id: s.rooms.id })
        .from(s.rooms)
        .where(eq(s.rooms.createRequestId, operationId))
    )[0];
    if (source) return;
    requireState(
      this.runtime.admission.availability().admission === "open",
      "SERVER_AT_CAPACITY",
      503,
    );
    const existing = (
      await this.database.db
        .select({ id: s.rooms.id })
        .from(s.rooms)
        .where(
          and(
            eq(s.rooms.ownerAccountId, actor.account.accountId),
            isNull(s.rooms.closedAt),
          ),
        )
    )[0];
    if (existing) await this.expireRoom(existing.id);
  }
  async prepareJoin(code: string, operationId: string) {
    this.runtime.enabled();
    const source = (
      await this.database.db
        .select({ id: s.roomMemberships.id })
        .from(s.roomMemberships)
        .where(eq(s.roomMemberships.joinRequestId, operationId))
    )[0];
    if (source) return;
    requireState(
      this.runtime.admission.availability().admission === "open",
      "SERVER_AT_CAPACITY",
      503,
    );
    const room = (
      await this.database.db
        .select({ id: s.rooms.id })
        .from(s.rooms)
        .where(eq(s.rooms.invitationCode, code))
    )[0];
    if (room) await this.expireRoom(room.id);
  }
  @scoped("lifecycle.current")
  async current(actor: Actor): Promise<Contract<"CurrentRoomResponse">> {
    requireState(actor.account, "UNAUTHENTICATED", 401);
    const row = (
      await this.database.db
        .select()
        .from(s.rooms)
        .where(
          and(
            eq(s.rooms.ownerAccountId, actor.account.accountId),
            isNull(s.rooms.closedAt),
          ),
        )
    )[0];
    if (!row) return {};
    await this.expireRoom(row.id);
    const room = await this.access.room(this.database.db, row.id, false);
    if (room.closedAt) return {};
    const game = room.currentGameId
      ? await this.games.game(this.database.db, room.currentGameId, false)
      : undefined;
    return {
      room: {
        roomId: room.id,
        roomVersion: String(room.stateVersion),
        focus:
          room.presentationMode === "lobby"
            ? "lobby"
            : game?.status === "active"
              ? "game"
              : "result",
        ...(room.currentGameId ? { currentGameId: room.currentGameId } : {}),
      },
    };
  }
  async status(
    actor: Actor,
    roomId: string,
  ): Promise<Contract<"ControlStatus">> {
    const room = await this.access.room(this.database.db, roomId, false);
    this.identity.host(room, actor, false);
    requireState(!room.closedAt, "ROOM_CLOSED", 410);
    const game = room.currentGameId
      ? await this.games.game(this.database.db, room.currentGameId, false)
      : undefined;
    return {
      roomId,
      roomControllerGeneration: String(room.controllerGeneration),
      ...(game
        ? {
            currentGameId: game.id,
            gameControllerGeneration: String(game.controllerGeneration),
          }
        : {}),
    };
  }
  @scoped("lifecycle.takeover")
  async takeover(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Contract<"TakeControl">,
  ): Promise<Contract<"Receipt">> {
    const hash = digest("takeControl", roomId, body);
    return this.transactions.transaction(async (db) => {
      const room = await this.access.room(db, roomId);
      this.identity.host(room, actor, false);
      const installed = equalProof(
        room.controllerCredentialHash,
        proof("room-control", roomId, body.proposedControlSecret),
      );
      const receipt = await this.receipts.receipt(db, operationId, hash);
      if (receipt) {
        requireState(installed, "CONTROLLER_FENCED", 403);
        return receipt;
      }
      requireState(!room.closedAt, "ROOM_CLOSED", 410);
      requireState(!installed, "FRESH_CONTROL_SECRET_REQUIRED", 409);
      requireState(
        revision(body.expectedControllerGeneration) ===
          room.controllerGeneration,
        "CONTROLLER_FENCED",
        403,
      );
      let game = room.currentGameId
        ? await this.games.game(db, room.currentGameId)
        : undefined;
      const now = await freshTime(db);
      if (
        game?.status === "active" &&
        now.getTime() >= new Date(game.idleExpiresAt).getTime()
      )
        game = await this.games.finish(db, game, now, "idle_timeout");
      if (!game || game.status !== "active")
        await this.rooms.lobby(db, room, now);
      const generation = room.controllerGeneration + 1n;
      if (game?.status === "active") {
        const updated = single(
          await db
            .update(s.games)
            .set({
              controllerCredentialHash: proof(
                "game-control",
                game.id,
                body.proposedControlSecret,
              ),
              controllerGeneration: generation,
              controllerAcquiredAt: now.toISOString(),
              stateVersion: game.stateVersion + 1n,
              projectionVersion: game.projectionVersion + 1n,
            })
            .where(eq(s.games.id, game.id))
            .returning(),
          "LIFECYCLE_UPDATED_ROW",
        );
        game = updated;
        await this.outbox.hint(db, roomId, 0n, game.id, game.projectionVersion);
      }
      const updated = await this.rooms.bump(
        db,
        room,
        now,
        false,
        {
          controllerGeneration: generation,
          controllerCredentialHash: proof(
            "room-control",
            roomId,
            body.proposedControlSecret,
          ),
          controllerAcquiredAt: now.toISOString(),
        },
        false,
      );
      return this.receipts.saveReceipt(
        db,
        updated,
        actor,
        operationId,
        "takeControl",
        hash,
        now,
        {
          roomVersion: String(updated.stateVersion),
          controllerGeneration: String(generation),
          ...(game ? this.games.fields(game) : {}),
        },
      );
    });
  }
  @scoped("lifecycle.replay")
  async replay(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Contract<"RoomMutation">,
  ): Promise<Contract<"Receipt">> {
    const hash = digest("openReplayLobby", roomId, body);
    this.identity.host(
      await this.access.room(this.database.db, roomId, false),
      actor,
    );
    await this.games.preflight(roomId);
    return this.transactions.transaction(async (db) => {
      const room = await this.access.room(db, roomId);
      this.identity.host(room, actor);
      const prior = await this.receipts.receipt(db, operationId, hash);
      if (prior) return prior;
      const now = await freshTime(db);
      const game = await this.rooms.lobby(db, room, now);
      requireState(game, "NO_PREVIOUS_GAME");
      requireState(
        revision(body.expectedRoomVersion) === room.stateVersion,
        "STALE_ROOM_VERSION",
      );
      if (room.presentationMode === "lobby")
        return this.receipts.saveReceipt(
          db,
          room,
          actor,
          operationId,
          "openReplayLobby",
          hash,
          now,
          { ...this.rooms.fields(room), effect: "none" },
        );
      const updated = await this.rooms.bump(db, room, now, true, {
        presentationMode: "lobby",
      });
      return this.receipts.saveReceipt(
        db,
        updated,
        actor,
        operationId,
        "openReplayLobby",
        hash,
        now,
        this.rooms.fields(updated),
      );
    });
  }
  @scoped("lifecycle.bind")
  async bind(
    actor: Actor,
    guest: Actor,
    roomId: string,
    operationId: string,
    body: Contract<"Binding">,
  ): Promise<Contract<"Receipt">> {
    requireState(actor.account && guest.member, "INVALID_PROOF", 401);
    const hash = digest("bindAccount", roomId, {
      ...body,
      account: actor.account.accountId,
      member: guest.member.id,
    });
    return this.transactions.transaction(async (db) => {
      const room = await this.access.room(db, roomId),
        member = await this.access.membership(db, room, guest, false);
      const prior = await this.receipts.receipt(db, operationId, hash);
      if (prior) return prior;
      requireState(
        !member.leftAt &&
          !member.removedAt &&
          !member.accountId &&
          !member.reconnectRevokedAt,
        "MEMBERSHIP_REVOKED",
        403,
      );
      await this.identity.activeAccount(db, actor);
      const now = await freshTime(db);
      await this.rooms.lobby(db, room, now);
      requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
      requireState(
        revision(body.expectedMembershipVersion) === member.stateVersion &&
          body.expectedReadyGeneration === room.lobbyGeneration,
        "STALE_MEMBER_VERSION",
      );
      const existing = await this.access.members(db, roomId);
      requireState(
        !existing.some((m) => m.accountId === actor.account!.accountId),
        "ALREADY_JOINED",
      );
      const updatedMember = single(
        await db
          .update(s.roomMemberships)
          .set({
            accountId: actor.account!.accountId,
            reconnectRevokedAt: now.toISOString(),
            stateVersion: member.stateVersion + 1n,
          })
          .where(eq(s.roomMemberships.id, member.id))
          .returning(),
        "LIFECYCLE_UPDATEDMEMBER_ROW",
      );
      const updated = await this.rooms.bump(db, room, now, true);
      return this.receipts.saveReceipt(
        db,
        updated,
        { ...actor, member },
        operationId,
        "bindAccount",
        hash,
        now,
        this.rooms.fields(updated, updatedMember),
      );
    });
  }
  @scoped("lifecycle.memberAction")
  async memberAction(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Partial<Contract<"RoomMutation">>,
    action: "leave" | "remove" | "unblock",
    memberId?: string,
  ): Promise<Contract<"Receipt">> {
    const hash = digest(action, roomId, {
      ...body,
      memberId: memberId ?? actor.member?.id ?? actor.account?.accountId,
    });
    return this.transactions.transaction(async (db) => {
      const room = await this.access.room(db, roomId);
      if (action !== "leave") this.identity.host(room, actor);
      const member =
        action === "leave"
          ? await this.access.membership(db, room, actor, false)
          : (
              await db
                .select()
                .from(s.roomMemberships)
                .where(
                  and(
                    eq(s.roomMemberships.roomId, roomId),
                    eq(s.roomMemberships.id, memberId!),
                  ),
                )
            )[0];
      requireState(member, "NOT_FOUND", 404);
      if (member.accountId === room.ownerAccountId && action === "leave")
        return this.closeLocked(
          db,
          room,
          actor,
          operationId,
          body,
          "leave",
          hash,
        );
      const prior = await this.receipts.receipt(db, operationId, hash);
      if (prior) return prior;
      requireState(!room.closedAt, "ROOM_CLOSED", 410);
      requireState(
        member.accountId !== room.ownerAccountId,
        "HOST_CLOSURE_REQUIRED",
        403,
      );
      if (action !== "leave")
        requireState(
          revision(body.expectedRoomVersion) === room.stateVersion,
          "STALE_ROOM_VERSION",
        );
      else
        requireState(
          !member.leftAt &&
            !member.removedAt &&
            (!actor.member ||
              (!member.accountId && !member.reconnectRevokedAt)),
          "MEMBERSHIP_REVOKED",
          403,
        );
      let game = room.currentGameId
        ? await this.games.game(db, room.currentGameId)
        : undefined;
      if (game?.status === "active" && action === "leave")
        await this.games.lockRoster(db, game);
      const now = await freshTime(db);
      if (
        game?.status === "active" &&
        now.getTime() >= new Date(game.idleExpiresAt).getTime()
      )
        game = await this.games.finish(db, game, now, "idle_timeout");
      if (action !== "leave" || game?.status !== "active")
        await this.rooms.lobby(db, room, now);
      if (action === "unblock")
        requireState(member.accountId && member.removedAt, "NO_ACCOUNT_BLOCK");
      const noEffect =
        action === "unblock"
          ? !!member.removalLiftedAt
          : action === "remove"
            ? !!member.removedAt
            : !!member.leftAt;
      if (noEffect)
        return this.receipts.saveReceipt(
          db,
          room,
          actor,
          operationId,
          action,
          hash,
          now,
          { ...this.rooms.fields(room, member), effect: "none" },
        );
      if (game?.status === "active" && action === "leave") {
        if (member.accountId) await this.games.accounts(db, [member.accountId]);
        await db
          .update(s.gamePlayers)
          .set({ leftAt: now.toISOString() })
          .where(
            and(
              eq(s.gamePlayers.gameId, game.id),
              eq(s.gamePlayers.roomMemberId, member.id),
              isNull(s.gamePlayers.leftAt),
            ),
          );
        // A conditional claim release may already be clear; preserve its zero-row result.
        if (member.accountId)
          await writtenAtMost(
            db
              .update(s.accounts)
              .set({ activeGameId: null, activeGameClaimedAt: null })
              .where(
                and(
                  eq(s.accounts.id, member.accountId),
                  eq(s.accounts.activeGameId, game.id),
                ),
              )
              .returning(),
            1,
            "ACCOUNT_CLAIM_RELEASE_COUNT",
          );
        const changed = single(
          await db
            .update(s.games)
            .set({
              stateVersion: game.stateVersion + 1n,
              projectionVersion: game.projectionVersion + 1n,
            })
            .where(eq(s.games.id, game.id))
            .returning(),
          "LIFECYCLE_CHANGED_ROW",
        );
        await this.outbox.hint(
          db,
          roomId,
          0n,
          game.id,
          changed.projectionVersion,
        );
      }
      const changes =
        action === "unblock"
          ? {
              removalLiftedAt: now.toISOString(),
              removalLiftedByAccountId: room.ownerAccountId,
            }
          : action === "remove"
            ? { removedAt: now.toISOString() }
            : { leftAt: now.toISOString() };
      const updatedMember = single(
        await db
          .update(s.roomMemberships)
          .set({ ...changes, stateVersion: member.stateVersion + 1n })
          .where(eq(s.roomMemberships.id, member.id))
          .returning(),
        "LIFECYCLE_UPDATEDMEMBER_ROW",
      );
      const updated = await this.rooms.bump(
        db,
        room,
        now,
        action !== "unblock",
        {},
        game?.status !== "active",
      );
      return this.receipts.saveReceipt(
        db,
        updated,
        action === "leave" ? { ...actor, member } : actor,
        operationId,
        action,
        hash,
        now,
        this.rooms.fields(updated, updatedMember),
      );
    });
  }
  @scoped("lifecycle.closeLocked")
  async closeLocked(
    db: Tx,
    room: Room,
    actor: Actor,
    operationId: string,
    body: Partial<Contract<"RoomMutation">>,
    name: string,
    hash: Buffer,
  ): Promise<Contract<"Receipt">> {
    this.identity.host(room, actor);
    const prior = await this.receipts.receipt(db, operationId, hash);
    if (prior) return prior;
    requireState(!room.closedAt, "ROOM_CLOSED", 410);
    requireState(
      revision(body.expectedRoomVersion) === room.stateVersion,
      "STALE_ROOM_VERSION",
    );
    const game = room.currentGameId
      ? await this.games.game(db, room.currentGameId)
      : undefined;
    if (game?.status === "active") await this.games.lockRoster(db, game);
    const now = await freshTime(db);
    if (game?.status === "active")
      await this.games.finish(
        db,
        game,
        now,
        now.getTime() >= new Date(game.idleExpiresAt).getTime()
          ? "idle_timeout"
          : "host_left",
      );
    const updated = await this.closeRows(db, room, now);
    return this.receipts.saveReceipt(
      db,
      updated,
      actor,
      operationId,
      name,
      hash,
      now,
      this.rooms.fields(updated),
    );
  }
  async closeRows(db: Tx, room: Room, now: Date) {
    await db
      .update(s.roomMemberships)
      .set({
        leftAt: now.toISOString(),
        stateVersion: sql`${s.roomMemberships.stateVersion}+1`,
      })
      .where(
        and(
          eq(s.roomMemberships.roomId, room.id),
          isNull(s.roomMemberships.leftAt),
          isNull(s.roomMemberships.removedAt),
        ),
      );
    return this.rooms.bump(
      db,
      room,
      now,
      true,
      {
        closedAt: now.toISOString(),
        invitationRevokedAt: room.invitationCode ? now.toISOString() : null,
      },
      false,
    );
  }
  @scoped("lifecycle.close")
  async close(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Contract<"RoomMutation">,
  ) {
    return this.transactions.transaction(async (db) =>
      this.closeLocked(
        db,
        await this.access.room(db, roomId),
        actor,
        operationId,
        body,
        "closeRoom",
        digest("closeRoom", roomId, body),
      ),
    );
  }
  @scoped("lifecycle.expireRoom")
  async expireRoom(roomId: string) {
    const initial = await this.access.room(this.database.db, roomId, false);
    if (initial.closedAt) return;
    if (initial.currentGameId) await this.games.expire(initial.currentGameId);
    await this.transactions.transaction(async (db) => {
      const room = await this.access.room(db, roomId);
      if (room.closedAt) return;
      const game = room.currentGameId
          ? await this.games.game(db, room.currentGameId, false)
          : undefined,
        now = await freshTime(db);
      if (game?.status === "active") return;
      const base = Math.max(
        new Date(room.lastLobbyActivityAt).getTime(),
        game?.endedAt ? new Date(game.endedAt).getTime() : 0,
      );
      if (now.getTime() >= base + 86400000) {
        await this.closeRows(db, room, now);
        this.transactions.afterCommit(db, () =>
          log.info("rooms.expireRoom", { outcome: "expired" }),
        );
      }
    });
  }
}
