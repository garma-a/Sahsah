import { writtenAtMost } from "./invariant.js";
import { log, errorStack } from "./logging.js";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as s from "../../database/schema/index.js";
import type { Tx } from "./types.js";

@Injectable()
export class GameplayOutbox {
  onCommitted?: (roomId: string) => void;
  private hinted = new WeakMap<Tx, Map<string, string>>();
  private pushed = new Set<string>();
  takePushed(deduplicationKey: string) {
    return this.pushed.delete(deduplicationKey);
  }
  async hint(
    db: Tx,
    roomId: string,
    version: bigint,
    gameId?: string,
    gameProjection?: bigint,
  ) {
    const resource = gameId ?? roomId,
      deduplicationKey = `${gameId ? "game" : "room"}:${resource}:${gameProjection ?? version}`;
    const hints = this.hinted.get(db) ?? new Map<string, string>();
    this.hinted.set(db, hints.set(deduplicationKey, roomId));
    await writtenAtMost(
      db
        .insert(s.outboxEvents)
        .values({
          id: randomUUID(),
          deduplicationKey,
          topic: gameId ? "game.changed" : "room.changed",
          resourceKind: gameId ? "game" : "room",
          resourceId: resource,
          payload: { roomId, ...(gameId ? { gameId } : {}) },
          // Evaluate database wall time separately for both existing timestamp fields.
          availableAt: sql<string>`clock_timestamp()`,
          createdAt: sql<string>`clock_timestamp()`,
        })
        .onConflictDoNothing()
        .returning(),
      1,
      "OUTBOXEVENTS_WRITE_COUNT",
    );
  }
  committed(db: Tx) {
    const hints = this.hinted.get(db);
    if (hints && this.onCommitted) {
      for (const key of hints.keys()) {
        if (this.pushed.size >= 4096)
          this.pushed.delete(this.pushed.values().next().value!);
        this.pushed.add(key);
      }
      for (const roomId of new Set(hints.values())) {
        try {
          this.onCommitted(roomId);
        } catch (error) {
          log.warn("platform.transaction.push", {
            code: "IN_PROCESS_PUSH_FAILED",
            stack: errorStack(error),
          });
          throw error;
        }
      }
    }
  }
}
