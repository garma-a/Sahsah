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
import { errorStack, log } from "./logging.js";
import { apiResourceLimits, capacityCeiling } from "./capacity.js";
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

const METRICS_INTERVAL_MS = 60000;

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
  private metricsTimer?: ReturnType<typeof setInterval>;
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
      ? previewPressure(process.env, this.metrics, this.scheduler)
      : resourcePressure(process.env, this.metrics, this.scheduler);
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
    await this.refreshCapacity();
    await this.reconcileOccupancy();
    if (this.options.pressure) {
      try {
        // Boot work (module loading, the first queries) is not load: judge from a clean loop reading.
        this.metrics.loop.reset();
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
    this.metricsTimer = setInterval(() => {
      this.reportMetrics();
      void this.refreshCapacity().catch((error: unknown) =>
        // Keep the last good ceiling; a failed read never widens or drops admission.
        log.warn("platform.capacity", { code: "CAPACITY_REFRESH_FAILED", stack: errorStack(error) }),
      );
    }, METRICS_INTERVAL_MS);
    this.metricsTimer.unref();
  }
  /**
   * Sets the admission ceiling from this container's current CPU and memory (or a measured
   * envelope), so a plan upgrade or downgrade is followed within a minute, without a restart.
   */
  private async refreshCapacity() {
    if (this.options.capacity) {
      this.admission.configure(this.options.capacity);
      return;
    }
    const local = Boolean(this.options.preview) || process.env.NODE_ENV !== "production";
    const limits = await apiResourceLimits(process.env, local);
    const { ceiling, basis } = capacityCeiling(process.env, limits);
    if (this.admission.configure(ceiling))
      log.info("platform.capacity", {
        code: basis === "measured" ? "CAPACITY_MEASURED" : "CAPACITY_FROM_RESOURCES",
        roomCeiling: ceiling.rooms,
        cpuLimitCores: limits.cpuCores,
        memoryLimitBytes: limits.memoryBytes,
      });
  }
  /** One structured line per interval: the signal for dashboards and alerts on the log platform. */
  private reportMetrics() {
    log.info("platform.metrics", {
      ...this.metrics.drain(),
      ...this.admission.usage(),
      roomCeiling: this.admission.limits()?.rooms,
      admission: this.admission.availability().admission,
    });
  }
  onModuleDestroy() {
    if (this.pressureTimer) clearInterval(this.pressureTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
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
