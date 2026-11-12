import { enrichContext } from "./logging.js";
import type { Contract } from "../contract.js";
import { single } from "./invariant.js";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import * as s from "../../database/schema/index.js";
import { equalProof } from "./proof.js";
import { id } from "../contract.js";
import { requireState } from "./problem.js";
import type { Actor, Tx, Room } from "./types.js";

@Injectable()
export class RoomReceipts {
  operation(req: Request) {
    const operationId = id(req.headers["idempotency-key"]);
    enrichContext({ operationId });
    return operationId;
  }
  async receipt(
    db: Tx,
    operationId: string,
    hash: Buffer,
  ): Promise<Contract<"Receipt"> | undefined> {
    const row = (
      await db
        .select()
        .from(s.roomActions)
        .where(eq(s.roomActions.operationId, operationId))
    )[0];
    if (!row) return;
    requireState(equalProof(row.requestDigest, hash), "OPERATION_CONFLICT");
    // Receipts are persisted from the typed receipt writer; recovery must not revalidate.
    return row.resultData as Contract<"Receipt">;
  }
  async saveReceipt(
    db: Tx,
    room: Room,
    actor: Actor,
    operationId: string,
    operationName: string,
    hash: Buffer,
    now: Date,
    outcome: Partial<Contract<"Receipt">>,
  ): Promise<Contract<"Receipt">> {
    const result: Contract<"Receipt"> = {
      operationId,
      roomId: room.id,
      acceptedAt: now.toISOString(),
      effect: "changed",
      ...outcome,
    };
    single(
      await db
        .insert(s.roomActions)
        .values({
          operationId,
          roomId: room.id,
          actorAccountId: actor.account?.accountId,
          actorMembershipId: actor.member?.id,
          actorProofHash: actor.member?.reconnectCredentialHash,
          operationName,
          requestDigest: hash,
          acceptedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
          resultData: result,
        })
        .returning(),
      "ROOMACTIONS_WRITE_ROW",
    );
    return result;
  }
}
