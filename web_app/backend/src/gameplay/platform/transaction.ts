import { GameplayOutbox } from "./outbox.js";
import { log, context, withContext } from "./logging.js";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.module.js";
import { databaseCode, databaseConstraint } from "./problem.js";
import { setTimeout as retryDelay } from "node:timers/promises";
import type { Tx } from "./types.js";

@Injectable()
export class GameplayTransactions {
  constructor(
    readonly outbox: GameplayOutbox,
    readonly database: DatabaseService,
  ) {}

  private committedLogs = new WeakMap<Tx, (() => void)[]>();
  afterCommit(db: Tx, work: () => void) {
    const captured = { ...context() };
    const logs = this.committedLogs.get(db) ?? [];
    logs.push(() => withContext(captured.scope, work, captured));
    this.committedLogs.set(db, logs);
  }
  async transaction<T>(work: (db: Tx) => Promise<T>): Promise<T> {
    // All callers are database-only, identified gameplay mutations. Retry the
    // entire rolled-back transaction; recheck the original intent/version.
    for (let attempt = 0; ; attempt++) {
      try {
        let committing: Tx | undefined;
        const result = await this.database.transaction((db) => {
          committing = db;
          return work(db);
        });
        // Push without waiting for the outbox poll. The durable hint remains
        // the safety net for a crash between commit and this line.
        if (committing)
          for (const writeLog of this.committedLogs.get(committing) ?? [])
            writeLog();
        if (committing) this.outbox.committed(committing);
        return result;
      } catch (error) {
        const code = databaseCode(error),
          constraint = databaseConstraint(error);
        const retry =
          code === "40001" ||
          code === "40P01" ||
          (code === "23505" &&
            ["rooms_invitation_code_unique", "rooms_one_open_owner"].includes(
              constraint ?? "",
            ));
        if (!retry || attempt >= 2) throw error;
        log.warn("platform.transaction.retry", { code, attempt: attempt + 1 });
        await retryDelay(10 * (attempt + 1));
      }
    }
  }
}
