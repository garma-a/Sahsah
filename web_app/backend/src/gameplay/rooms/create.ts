import { GameplayTransactions } from "../platform/transaction.js";
import { GameplayOutbox } from "../platform/outbox.js";
import { RoomReceipts } from "../platform/receipts.js";
import { GameplayIdentity } from "../platform/identity.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { written } from "../platform/invariant.js";
import { scoped, enrichContext, log } from "../platform/logging.js";
import type { Contract } from "../contract.js";
import { single } from "../platform/invariant.js";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.module.js";
import * as s from "../../database/schema/index.js";
import { digest, equalProof, proof } from "../platform/proof.js";
import { requireState } from "../platform/problem.js";
import type { Actor } from "../platform/types.js";
import { freshTime, iso, plusDay } from "../platform/clock.js";

@Injectable()
export class RoomCreation {
  constructor(
    readonly runtime: GameplayRuntime,
    readonly identity: GameplayIdentity,
    readonly receipts: RoomReceipts,
    readonly outbox: GameplayOutbox,
    readonly transactions: GameplayTransactions,
    readonly database: DatabaseService,
  ) {}

  @scoped("rooms.create.create")
  async create(
    actor: Actor,
    operationId: string,
    body: Contract<"CreateRoom">,
  ): Promise<Contract<"Receipt">> {
    requireState(actor.account, "UNAUTHENTICATED", 401);
    const hash = digest("createRoom", actor.account.accountId, body);
    const original = (
      await this.database.db
        .select()
        .from(s.rooms)
        .where(eq(s.rooms.createRequestId, operationId))
    )[0];
    if (original) {
      this.identity.host(original, actor, false);
      requireState(
        equalProof(original.createRequestDigest, hash),
        "OPERATION_CONFLICT",
      );
      const receipt = await this.receipts.receipt(
        this.database.db,
        operationId,
        hash,
      );
      if (receipt) return receipt;
      const member = (
        await this.database.db
          .select()
          .from(s.roomMemberships)
          .where(
            and(
              eq(s.roomMemberships.roomId, original.id),
              eq(s.roomMemberships.accountId, original.ownerAccountId),
            ),
          )
      )[0];
      return {
        operationId,
        roomId: original.id,
        roomVersion: "0",
        membershipId: member?.id,
        membershipVersion: "0",
        controllerGeneration: "1",
        readyGeneration: 1,
        acceptedAt: iso(original.createdAt),
        effect: "changed",
      };
    }
    return this.runtime.admission.allocate(
      `create:${actor.account.accountId}:${operationId}`,
      hash,
      () =>
        this.transactions.transaction(async (db) => {
          const existing = (
            await db
              .select()
              .from(s.rooms)
              .where(
                and(
                  eq(s.rooms.ownerAccountId, actor.account!.accountId),
                  isNull(s.rooms.closedAt),
                ),
              )
          )[0];
          requireState(
            !existing,
            "ROOM_ALREADY_OPEN",
            409,
            existing ? { existingRoomId: existing.id } : {},
          );
          const account = await this.identity.activeAccount(db, actor);
          const now = await freshTime(db),
            roomId = randomUUID(),
            memberId = randomUUID();
          const room = single(
            await db
              .insert(s.rooms)
              .values({
                id: roomId,
                ownerAccountId: actor.account!.accountId,
                teamOneName: String(body.teamOneName).trim(),
                teamTwoName: String(body.teamTwoName).trim(),
                createRequestId: operationId,
                createRequestDigest: hash,
                controllerCredentialHash: proof(
                  "room-control",
                  roomId,
                  body.proposedControlSecret,
                ),
                controllerAcquiredAt: now.toISOString(),
                createdAt: now.toISOString(),
                lastLobbyActivityAt: now.toISOString(),
                lobbyIdleExpiresAt: plusDay(now),
                invitationCode: String(randomInt(1000000)).padStart(6, "0"),
                invitationIssuedAt: now.toISOString(),
                invitationExpiresAt: plusDay(now),
              })
              .returning(),
            "SERVICE_ROOM_ROW",
          );
          single(
            await db
              .insert(s.roomMemberships)
              .values({
                id: memberId,
                roomId,
                accountId: actor.account!.accountId,
                displayName: account!.displayName!,
                lobbyTeamNumber: body.hostTeamNumber,
                joinedAt: now.toISOString(),
              })
              .returning(),
            "ROOMMEMBERSHIPS_WRITE_ROW",
          );
          enrichContext({ roomId, accountId: actor.account!.accountId });
          const selections = body.selections;
          if (selections.length)
            await written(
              db
                .insert(s.roomPackSelections)
                .values(
                  selections.map((item) => ({
                    roomId,
                    boardPosition: Number(item.boardPosition),
                    categoryId: String(item.categoryId),
                    packId: String(item.packId),
                    observedRevision: BigInt(String(item.observedRevision)),
                  })),
                )
                .returning(),
              selections.length,
              "ROOMPACKSELECTIONS_WRITE_COUNT",
            );
          await this.outbox.hint(db, room.id, room.stateVersion);
          this.transactions.afterCommit(db, () =>
            log.info("rooms.create", { outcome: "created" }),
          );
          return this.receipts.saveReceipt(
            db,
            room,
            actor,
            operationId,
            "createRoom",
            hash,
            now,
            {
              roomVersion: "0",
              membershipId: memberId,
              membershipVersion: "0",
              controllerGeneration: "1",
              readyGeneration: 1,
            },
          );
        }),
    );
  }
}
