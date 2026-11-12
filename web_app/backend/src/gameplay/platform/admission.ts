import { log } from "./logging.js";
import { GameplayProblem, requireState } from "./problem.js";
import type { Contract } from "../contract.js";
import type { PressureSample } from "./ports.js";
export interface CapacityVector {
  rooms: number;
  members: number;
  games: number;
}
type Allocation = "create" | "join" | "start";
const capacityKeys: (keyof CapacityVector)[] = ["rooms", "members", "games"];
const delta: Record<Allocation, CapacityVector> = {
  create: { rooms: 1, members: 1, games: 0 },
  join: { rooms: 0, members: 1, games: 0 },
  start: { rooms: 0, members: 0, games: 1 },
};

export class Admission {
  private sample?: PressureSample;
  private pending = new Map<
    string,
    { digest: string; promise: Promise<unknown>; kind: Allocation }
  >();
  private closed = true;
  private healthySince = 0;
  private unavailableSince = Date.now();
  private occupancy?: CapacityVector;
  private ceiling?: CapacityVector;
  revision = 0;
  private loggedPaused = false;
  configure(ceiling: CapacityVector) {
    requireState(
      [ceiling.rooms, ceiling.members, ceiling.games].every(
        (v) => Number.isSafeInteger(v) && v > 0,
      ),
      "INVALID_CAPACITY_PROFILE",
      500,
    );
    this.ceiling = ceiling;
  }
  reconcile(counts: CapacityVector, revision: number) {
    if (this.revision === revision) this.occupancy = counts;
  }
  changed() {
    this.revision++;
  }
  update(sample: PressureSample) {
    const now = Date.now();
    if (
      ![sample.api, sample.database].every(
        (value) => Number.isFinite(value) && value >= 0,
      ) ||
      !Number.isFinite(sample.sampledAt) ||
      sample.sampledAt > now + 1000 ||
      !Number.isFinite(sample.databaseSampledAt ?? sample.sampledAt) ||
      (sample.databaseSampledAt ?? sample.sampledAt) > now + 1000 ||
      !Number.isFinite(sample.application ?? 0) ||
      (sample.application ?? 0) < 0
    )
      return;
    this.sample = sample;
    if (
      now - sample.sampledAt <= 5000 &&
      now - (sample.databaseSampledAt ?? sample.sampledAt) <= 30000
    )
      this.unavailableSince = 0;
    const load = Math.max(sample.api, sample.database, sample.application ?? 0);
    if (load >= 0.85) {
      this.closed = true;
      this.healthySince = 0;
    } else if (load <= 0.75 && this.fresh(now)) {
      if (!this.healthySince) this.healthySince = now;
      if (now - this.healthySince >= 30000) this.closed = false;
    } else this.healthySince = 0;
  }
  private fresh(now: number) {
    return (
      !!this.sample &&
      now - this.sample.sampledAt <= 5000 &&
      now - (this.sample.databaseSampledAt ?? this.sample.sampledAt) <= 30000
    );
  }
  initialize(sample: PressureSample) {
    this.update(sample);
    if (
      Math.max(sample.api, sample.database, sample.application ?? 0) < 0.75 &&
      this.fresh(Date.now())
    )
      this.closed = false;
  }
  availability(): Contract<"Availability"> {
    const now = Date.now();
    if (!this.fresh(now)) {
      if (!this.unavailableSince) this.unavailableSince = now;
      this.healthySince = 0;
      if (!this.sample || now - this.unavailableSince >= 15000)
        this.closed = true;
    }
    const full =
      !this.occupancy ||
      !this.ceiling ||
      capacityKeys.some(
        (key) => this.occupancy![key] >= Math.floor(this.ceiling![key] * 0.85),
      );
    const paused = this.closed || full;
    if (paused && !this.loggedPaused)
      log.warn("platform.admission.availability", { code: "ADMISSION_PAUSED" });
    this.loggedPaused = paused;
    return paused
      ? { admission: "paused", retryAfterSeconds: 15 }
      : { admission: "open" };
  }
  async allocate<T>(
    key: string,
    hash: Buffer,
    work: () => Promise<T>,
  ): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      requireState(
        existing.digest === hash.toString("hex"),
        "OPERATION_CONFLICT",
      );
      // The durable allocation key/digest identifies the same operation and result type.
      return existing.promise as Promise<T>;
    }
    const kind = key.split(":")[0];
    requireState(
      kind === "create" || kind === "join" || kind === "start",
      "INVALID_ALLOCATION",
      500,
    );
    const reserved = [...this.pending.values()].reduce(
      (counts, row) => ({
        rooms: counts.rooms + delta[row.kind].rooms,
        members: counts.members + delta[row.kind].members,
        games: counts.games + delta[row.kind].games,
      }),
      { rooms: 0, members: 0, games: 0 },
    );
    const over =
      this.occupancy &&
      this.ceiling &&
      capacityKeys.some(
        (k) =>
          this.occupancy![k] + reserved[k] + delta[kind][k] >
          Math.floor(this.ceiling![k] * 0.85),
      );
    if (
      this.availability().admission !== "open" ||
      over ||
      this.pending.size >= 2 ||
      (kind === "start" &&
        [...this.pending.values()].some((row) => row.kind === "start"))
    )
      throw new GameplayProblem(503, "SERVER_AT_CAPACITY");
    const promise = Promise.resolve()
      .then(work)
      .then((value) => {
        if (this.occupancy)
          for (const k of capacityKeys) this.occupancy[k] += delta[kind][k];
        this.revision++;
        return value;
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, { digest: hash.toString("hex"), promise, kind });
    return promise;
  }
}
