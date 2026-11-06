import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import * as s from "../database/schema/index.js";
import type { Data } from "./ports.js";
import { digest, equalProof, proof } from "./proof.js";
import { GameplayProblem, requireState } from "./problem.js";
import { revision } from "./contract.js";
import { CatalogService } from "./catalog.js";
import {
  GameplayService,
  freshTime,
  iso,
  plusDay,
  type Actor,
  type Room,
  type Tx,
  type Member,
} from "./service.js";

@Injectable()
export class RoomOperations {
  constructor(
    private core: GameplayService,
    private catalog: CatalogService,
  ) {}
  async bump(
    db: Tx,
    room: Room,
    now: Date,
    semantic: boolean,
    changes: Partial<typeof s.rooms.$inferInsert> = {},
    activity = true,
  ) {
    if (semantic)
      await db
        .update(s.roomPackSelections)
        .set({ repeatConsentBasis: null, repeatAcceptedAt: null })
        .where(eq(s.roomPackSelections.roomId, room.id));
    const [updated] = await db
      .update(s.rooms)
      .set({
        stateVersion: room.stateVersion + 1n,
        lobbyGeneration: room.lobbyGeneration + Number(semantic),
        ...(activity
          ? {
              lastLobbyActivityAt: now.toISOString(),
              lobbyIdleExpiresAt: plusDay(now),
            }
          : {}),
        ...changes,
      })
      .where(eq(s.rooms.id, room.id))
      .returning();
    await this.core.hint(db, room.id, updated.stateVersion);
    return updated;
  }
  fields(room: Room, member?: Member): Data {
    return {
      roomVersion: String(room.stateVersion),
      readyGeneration: room.lobbyGeneration,
      ...(member
        ? {
            membershipId: member.id,
            membershipVersion: String(member.stateVersion),
          }
        : {}),
    };
  }
  async lobby(db: Tx, room: Room, now: Date) {
    requireState(!room.closedAt, "ROOM_CLOSED", 410);
    const game = room.currentGameId
      ? (
          await db
            .select()
            .from(s.games)
            .where(eq(s.games.id, room.currentGameId))
        )[0]
      : undefined;
    requireState(!game || game.status !== "active", "GAME_ALREADY_STARTED");
    const base = Math.max(
      new Date(room.lastLobbyActivityAt).getTime(),
      game?.endedAt ? new Date(game.endedAt).getTime() : 0,
    );
    requireState(now.getTime() < base + 86400000, "ROOM_EXPIRED", 410);
    return game;
  }
  async invitation(actor: Actor, roomId: string): Promise<Data> {
    const room = await this.core.room(this.core.database.db, roomId, false);
    this.core.host(room, actor);
    requireState(
      !room.closedAt && room.invitationCode && !room.invitationRevokedAt,
      "INVITATION_UNAVAILABLE",
      410,
    );
    requireState(
      Date.now() < new Date(room.invitationExpiresAt!).getTime(),
      "INVITATION_EXPIRED",
      410,
    );
    const base =
      process.env.GAMEPLAY_JOIN_BASE_URL ?? "http://localhost:3000/join/";
    return {
      code: room.invitationCode,
      joinUrl: `${base.replace(/\/$/, "")}/${room.invitationCode}`,
      issuedAt: iso(room.invitationIssuedAt!),
      expiresAt: iso(room.invitationExpiresAt!),
    };
  }
  async preview(code: string): Promise<Data> {
    this.core.enabled();
    requireState(/^\d{6}$/.test(code), "INVALID_INVITATION", 400);
    const room = (
      await this.core.database.db
        .select()
        .from(s.rooms)
        .where(eq(s.rooms.invitationCode, code))
    )[0];
    requireState(
      room &&
        !room.closedAt &&
        !room.invitationRevokedAt &&
        Date.now() < new Date(room.invitationExpiresAt!).getTime(),
      "INVITATION_UNAVAILABLE",
      404,
    );
    const members = await this.core.members(this.core.database.db, room.id);
    const game = room.currentGameId
      ? (
          await this.core.database.db
            .select()
            .from(s.games)
            .where(eq(s.games.id, room.currentGameId))
        )[0]
      : undefined;
    return {
      joinable:
        members.length < 6 &&
        game?.status !== "active" &&
        this.core.admission.availability().admission === "open",
      teamOneName: room.teamOneName,
      teamTwoName: room.teamTwoName,
      availableSeats: Math.max(
        0,
        5 -
          members.filter((member) => member.accountId !== room.ownerAccountId)
            .length,
      ),
      expiresAt: iso(room.invitationExpiresAt!),
      admission: this.core.admission.availability().admission,
    };
  }
  async join(
    code: string,
    actor: Actor | undefined,
    operationId: string,
    body: Data,
  ): Promise<Data> {
    this.core.enabled();
    requireState(/^\d{6}$/.test(code), "INVALID_INVITATION", 400);
    const hash = digest("joinRoom", code, {
      ...body,
      account:
        body.identity === "account" ? actor?.account?.accountId : undefined,
    });
    const old = (
      await this.core.database.db
        .select()
        .from(s.roomMemberships)
        .where(eq(s.roomMemberships.joinRequestId, operationId))
    )[0];
    const authorizeSource = (member: Member) => {
      if (body.identity === "account")
        requireState(
          actor?.account?.accountId === member.accountId,
          "FORBIDDEN",
          403,
        );
      else
        requireState(
          equalProof(
            member.reconnectCredentialHash,
            proof("guest", member.id, body.reconnectSecret),
          ),
          "INVALID_PROOF",
          401,
        );
      requireState(
        equalProof(member.joinRequestDigest, hash),
        "OPERATION_CONFLICT",
      );
    };
    if (old) {
      authorizeSource(old);
      const room = await this.core.room(
        this.core.database.db,
        old.roomId,
        false,
      );
      const prior = await this.core.receipt(
        this.core.database.db,
        operationId,
        hash,
      );
      return {
        ...(prior ?? {
          operationId,
          roomId: old.roomId,
          acceptedAt: iso(old.joinedAt),
          effect: "changed",
          ...this.fields(room, old),
        }),
        accessState: room.closedAt
          ? "closed"
          : old.leftAt || old.removedAt || old.reconnectRevokedAt
            ? "revoked"
            : "live",
      };
    }
    if (body.identity === "account")
      requireState(actor?.account, "UNAUTHENTICATED", 401);
    return this.core.admission.allocate(`join:${operationId}`, hash, () =>
      this.core.transaction(async (db) => {
        const room = (
          await db
            .select()
            .from(s.rooms)
            .where(eq(s.rooms.invitationCode, code))
            .for("update")
        )[0];
        if (actor) await this.core.activeAccount(db, actor);
        const now = await freshTime(db);
        requireState(
          room &&
            !room.closedAt &&
            !room.invitationRevokedAt &&
            now.getTime() < new Date(room.invitationExpiresAt!).getTime(),
          "INVITATION_UNAVAILABLE",
          404,
        );
        await this.lobby(db, room, now);
        requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
        const members = await this.core.members(db, room.id);
        requireState(
          members.length < 6 &&
            members.filter((item) => item.accountId !== room.ownerAccountId)
              .length < 5,
          "ROOM_FULL",
        );
        if (actor?.account)
          requireState(
            !members.some(
              (item) => item.accountId === actor.account!.accountId,
            ),
            "ALREADY_JOINED",
          );
        const memberId = randomUUID();
        const [member] = await db
          .insert(s.roomMemberships)
          .values({
            id: memberId,
            roomId: room.id,
            accountId: actor?.account?.accountId,
            displayName: String(body.displayName).trim(),
            lobbyTeamNumber: Number(body.teamNumber),
            joinedAt: now.toISOString(),
            joinRequestId: operationId,
            joinRequestDigest: hash,
            ...(body.identity === "anonymous"
              ? {
                  reconnectCredentialHash: proof(
                    "guest",
                    memberId,
                    body.reconnectSecret,
                  ),
                  reconnectIssuedAt: now.toISOString(),
                }
              : {}),
          })
          .returning();
        const updated = await this.bump(db, room, now, true);
        return this.core.saveReceipt(
          db,
          updated,
          { ...actor, member },
          operationId,
          "joinRoom",
          hash,
          now,
          { ...this.fields(updated, member), accessState: "live" },
        );
      }),
    );
  }
  async rotate(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Data,
  ): Promise<Data> {
    const hash = digest("rotateInvitation", roomId, body);
    return this.core.transaction(async (db) => {
      const room = await this.core.room(db, roomId);
      this.core.host(room, actor);
      const prior = await this.core.receipt(db, operationId, hash);
      if (prior) return prior;
      const now = await freshTime(db);
      requireState(!room.closedAt, "ROOM_CLOSED", 410);
      const game = room.currentGameId
        ? (
            await db
              .select()
              .from(s.games)
              .where(eq(s.games.id, room.currentGameId))
          )[0]
        : undefined;
      if (game?.status !== "active") await this.lobby(db, room, now);
      requireState(
        revision(body.expectedRoomVersion) === room.stateVersion,
        "STALE_ROOM_VERSION",
        409,
        { currentRoomVersion: String(room.stateVersion) },
      );
      const updated = await this.bump(
        db,
        room,
        now,
        false,
        {
          invitationCode: String(randomInt(1000000)).padStart(6, "0"),
          invitationIssuedAt: now.toISOString(),
          invitationExpiresAt: plusDay(now),
          invitationRevokedAt: null,
        },
        false,
      );
      return this.core.saveReceipt(
        db,
        updated,
        actor,
        operationId,
        "rotateInvitation",
        hash,
        now,
        this.fields(updated),
      );
    });
  }
  async memberChange(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Data,
    ready: boolean,
  ): Promise<Data> {
    const operation = ready ? "setReadiness" : "updateOwnMembership",
      hash = digest(operation, roomId, {
        ...body,
        actor: actor.member?.id ?? actor.account?.accountId,
      });
    return this.core.transaction(async (db) => {
      const room = await this.core.room(db, roomId),
        member = await this.core.membership(db, room, actor);
      const prior = await this.core.receipt(db, operationId, hash);
      if (prior) return prior;
      const now = await freshTime(db);
      await this.lobby(db, room, now);
      requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
      requireState(
        member.accountId !== room.ownerAccountId,
        "HOST_SETUP_REQUIRED",
        403,
      );
      requireState(
        revision(body.expectedMembershipVersion) === member.stateVersion,
        "STALE_MEMBER_VERSION",
        409,
        { currentMembershipVersion: String(member.stateVersion) },
      );
      requireState(
        body.expectedReadyGeneration === room.lobbyGeneration,
        "STALE_READY_GENERATION",
        409,
        { currentReadyGeneration: room.lobbyGeneration },
      );
      const changes: Partial<typeof s.roomMemberships.$inferInsert> = {};
      let semantic = false;
      if (ready) {
        if (
          Boolean(body.ready) !==
          (member.readyForGeneration === room.lobbyGeneration)
        ) {
          changes.readyForGeneration = body.ready ? room.lobbyGeneration : null;
          changes.readyAt = body.ready ? now.toISOString() : null;
        }
      } else {
        requireState(
          body.displayName !== undefined || body.teamNumber !== undefined,
          "INVALID_INPUT",
          400,
        );
        if (
          body.displayName !== undefined &&
          String(body.displayName).trim() !== member.displayName
        )
          changes.displayName = String(body.displayName).trim();
        if (
          body.teamNumber !== undefined &&
          body.teamNumber !== member.lobbyTeamNumber
        ) {
          changes.lobbyTeamNumber = Number(body.teamNumber);
          semantic = true;
        }
      }
      if (!Object.keys(changes).length)
        return this.core.saveReceipt(
          db,
          room,
          { ...actor, member },
          operationId,
          operation,
          hash,
          now,
          { ...this.fields(room, member), effect: "none" },
        );
      const [updatedMember] = await db
        .update(s.roomMemberships)
        .set({ ...changes, stateVersion: member.stateVersion + 1n })
        .where(eq(s.roomMemberships.id, member.id))
        .returning();
      const updated = await this.bump(db, room, now, semantic);
      return this.core.saveReceipt(
        db,
        updated,
        { ...actor, member },
        operationId,
        operation,
        hash,
        now,
        this.fields(updated, updatedMember),
      );
    });
  }
  async saveSetup(
    actor: Actor,
    roomId: string,
    operationId: string,
    body: Data,
  ): Promise<Data> {
    const hash = digest("saveRoomSetup", roomId, body);
    return this.core.transaction(async (db) => {
      const room = await this.core.room(db, roomId);
      this.core.host(room, actor);
      const prior = await this.core.receipt(db, operationId, hash);
      if (prior) return prior;
      const now = await freshTime(db);
      await this.lobby(db, room, now);
      requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
      requireState(
        revision(body.expectedRoomVersion) === room.stateVersion,
        "STALE_ROOM_VERSION",
        409,
        { currentRoomVersion: String(room.stateVersion) },
      );
      const choices = body.selections as Data[];
      requireState(
        new Set(choices.map((item) => item.categoryId)).size ===
          choices.length &&
          new Set(choices.map((item) => item.boardPosition)).size ===
            choices.length,
        "INVALID_SELECTION",
        400,
      );
      const packs = choices.length
        ? await db
            .select()
            .from(s.questionPacks)
            .where(
              inArray(
                s.questionPacks.id,
                choices.map((item) => String(item.packId)),
              ),
            )
        : [];
      requireState(
        choices.every((choice) =>
          packs.some(
            (pack) =>
              pack.id === choice.packId &&
              pack.categoryId === choice.categoryId &&
              pack.publicationState === "published" &&
              !pack.archivedAt &&
              pack.contentRevision === BigInt(String(choice.observedRevision)),
          ),
        ),
        "SELECTION_CHANGED",
      );
      const old = await db
        .select()
        .from(s.roomPackSelections)
        .where(eq(s.roomPackSelections.roomId, roomId));
      const members = await this.core.members(db, roomId);
      const host = members.find(
        (item) => item.accountId === room.ownerAccountId,
      )!;
      const eligibility = await this.catalog.eligibilities(
        db,
        packs,
        members.map((m) =>
          m.id === host.id
            ? { ...m, lobbyTeamNumber: body.hostTeamNumber as number | null }
            : m,
        ),
      );
      for (const choice of choices)
        if (choice.repeatConsentBasis)
          requireState(
            eligibility.get(String(choice.packId))?.basis ===
              choice.repeatConsentBasis,
            "REPEAT_BASIS_CHANGED",
          );
      const semantic =
        host.lobbyTeamNumber !== body.hostTeamNumber ||
        old.length !== choices.length ||
        choices.some(
          (choice) =>
            !old.some(
              (item) =>
                item.boardPosition === choice.boardPosition &&
                item.packId === choice.packId &&
                String(item.observedRevision) === choice.observedRevision &&
                (item.repeatConsentBasis?.toString("hex") ?? undefined) ===
                  choice.repeatConsentBasis,
            ),
        );
      const cosmetic =
        room.teamOneName !== String(body.teamOneName).trim() ||
        room.teamTwoName !== String(body.teamTwoName).trim();
      if (!semantic && !cosmetic)
        return this.core.saveReceipt(
          db,
          room,
          actor,
          operationId,
          "saveRoomSetup",
          hash,
          now,
          { ...this.fields(room), effect: "none" },
        );
      const updated = await this.bump(db, room, now, semantic, {
        teamOneName: String(body.teamOneName).trim(),
        teamTwoName: String(body.teamTwoName).trim(),
      });
      if (host.lobbyTeamNumber !== body.hostTeamNumber)
        await db
          .update(s.roomMemberships)
          .set({
            lobbyTeamNumber: body.hostTeamNumber as number | null,
            stateVersion: host.stateVersion + 1n,
          })
          .where(eq(s.roomMemberships.id, host.id));
      await db
        .delete(s.roomPackSelections)
        .where(eq(s.roomPackSelections.roomId, roomId));
      if (choices.length)
        await db.insert(s.roomPackSelections).values(
          choices.map((choice) => ({
            roomId,
            boardPosition: Number(choice.boardPosition),
            categoryId: String(choice.categoryId),
            packId: String(choice.packId),
            observedRevision: BigInt(String(choice.observedRevision)),
            ...(choice.repeatConsentBasis
              ? {
                  repeatConsentBasis: Buffer.from(
                    String(choice.repeatConsentBasis),
                    "hex",
                  ),
                  repeatAcceptedAt: now.toISOString(),
                }
              : {}),
          })),
        );
      return this.core.saveReceipt(
        db,
        updated,
        actor,
        operationId,
        "saveRoomSetup",
        hash,
        now,
        this.fields(updated),
      );
    });
  }
}
