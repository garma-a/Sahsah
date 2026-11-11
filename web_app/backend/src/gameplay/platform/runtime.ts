import { single } from "./invariant.js";
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.module.js";
import { Admission } from "./admission.js";
import { revision } from "../contract.js";
import { GameplayProblem, requireState } from "./problem.js";
import type { GameplayOptions } from "./ports.js";
import { GameplayScheduler } from "./scheduler.js";
import { GameplayMetrics } from "./metrics.js";
import {
  existingIdentity,
  previewPressure,
  resourcePressure,
} from "./integrations.js";
import { previewIdentity, previewMode } from "../preview/identity.js";

@Injectable()
export class GameplayRuntime implements OnModuleInit, OnModuleDestroy {
  constructor(
    readonly database: DatabaseService,
    private config: ConfigService,
  ) {}
  options: GameplayOptions = {};
  readonly admission = new Admission();
  readonly scheduler = new GameplayScheduler();
  readonly metrics = new GameplayMetrics();
  private pressureTimer?: ReturnType<typeof setInterval>;
  configure(options: GameplayOptions = {}) {
    this.options = {
      ...options,
      enabled:
        options.enabled ?? this.config.get("GAMEPLAY_ENABLED") === "true",
    };
    if (!this.options.enabled) return;
    const preview = (this.options.preview ??= previewMode(process.env));
    this.options.verifyAccount ??= preview
      ? previewIdentity(preview)
      : existingIdentity(process.env);
    requireState(
      Number(process.env.DATABASE_POOL_MAX ?? 5) >= 3,
      "GAMEPLAY_POOL_TOO_SMALL",
      500,
    );
    this.options.pressure ??= preview
      ? previewPressure(process.env, this.metrics)
      : resourcePressure(process.env, this.metrics);
    // Admission closes at 85% of the ceiling: preview admits 20 rooms.
    const ceiling =
      options.capacity ??
      (preview
        ? { rooms: 24, members: 144, games: 24 }
        : process.env.NODE_ENV === "production"
          ? {
              rooms: Number(process.env.GAMEPLAY_CAPACITY_ROOMS),
              members: Number(process.env.GAMEPLAY_CAPACITY_MEMBERS),
              games: Number(process.env.GAMEPLAY_CAPACITY_GAMES),
            }
          : { rooms: 200, members: 1200, games: 200 });
    this.admission.configure(ceiling);
    if (process.env.NODE_ENV === "production") {
      requireState(
        this.options.verifyAccount &&
          this.options.pressure &&
          this.options.signMedia,
        "GAMEPLAY_CONFIGURATION_MISSING",
        500,
      );
      const base = new URL(
        process.env.GAMEPLAY_JOIN_BASE_URL ?? "http://invalid",
      );
      requireState(
        base.protocol === "https:" &&
          !base.username &&
          !base.password &&
          !base.search &&
          !base.hash,
        "INVALID_JOIN_BASE_URL",
        500,
      );
    }
  }
  async reconcileOccupancy() {
    const revision = this.admission.revision;
    // Keep all three bounded counts in one no-FROM statement/MVCC snapshot.
    // Drizzle 0.45 cannot execute select() without FROM; the result is explicitly typed.
    const result = await this.database.db.execute<{
      rooms: number;
      members: number;
      games: number;
    }>(sql`SELECT (SELECT count(*)::int FROM rooms WHERE closed_at IS NULL) AS rooms,
      (SELECT count(*)::int FROM room_memberships m JOIN rooms r ON r.id=m.room_id WHERE r.closed_at IS NULL AND m.left_at IS NULL AND m.removed_at IS NULL) AS members,
      (SELECT count(*)::int FROM games WHERE status='active') AS games`);
    this.admission.reconcile(
      single(result.rows, "OCCUPANCY_SINGLE_ROW"),
      revision,
    );
  }
  async onModuleInit() {
    if (!this.options.enabled) return;
    requireState(
      await this.database.ready(),
      "GAMEPLAY_DATABASE_UNAVAILABLE",
      503,
    );
    requireState(
      await this.database.claimGameplayProcess(),
      "GAMEPLAY_PROCESS_ALREADY_ACTIVE",
      503,
    );
    await this.reconcileOccupancy();
    if (this.options.pressure) {
      try {
        this.admission.initialize(await this.options.pressure());
      } catch {
        /* admission remains paused */
      }
      this.pressureTimer = setInterval(() => {
        void this.options.pressure!()
          .then((sample) => this.admission.update(sample))
          .catch(() => {});
      }, 1000);
      this.pressureTimer.unref();
    }
  }
  onModuleDestroy() {
    if (this.pressureTimer) clearInterval(this.pressureTimer);
    this.metrics.close();
  }
  enabled() {
    requireState(this.options.enabled, "GAMEPLAY_DISABLED", 503);
    try {
      this.database.db;
    } catch {
      throw new GameplayProblem(503, "GAMEPLAY_DATABASE_UNAVAILABLE");
    }
  }
}

// The historical test/load import resolves to this same focused runtime provider.
export { GameplayRuntime as GameplayService };
