import { readFile } from "node:fs/promises";
import { availableParallelism, totalmem } from "node:os";
import type { CapacityVector } from "./admission.js";
import { requireState } from "./problem.js";

/** A full room: the host and five players. */
export const MEMBERS_PER_ROOM = 6;
/**
 * The API is one Node process: one JavaScript thread plus GC, libuv and crypto helpers. Cores past
 * this add almost no gameplay throughput, so room capacity stops scaling with CPU here (memory and
 * the database keep scaling). Past it, the next step is more API processes, not a bigger one.
 */
const USEFUL_API_CORES = 2;
/**
 * Starting rates per useful core and per GB of API memory until a load test on the deployed profile
 * replaces them (GAMEPLAY_CAPACITY_ROOMS_PER_CPU / _PER_GB). They only bound admission: live CPU,
 * memory, event-loop and database-slot pressure still refuse new rooms first when they run hot.
 */
const DEFAULT_ROOMS_PER_CPU = 60;
const DEFAULT_ROOMS_PER_GB = 80;
const MIN_ROOMS = 4;
const MAX_ROOMS = 2000;

export interface ResourceLimits {
  cpuCores: number;
  memoryBytes: number;
}

const positive = (value: string | undefined, code: string) => {
  const n = Number(value);
  requireState(value !== undefined && Number.isFinite(n) && n > 0, code, 500);
  return n;
};

/**
 * The CPU and memory this container may use right now, from cgroup v2 (what Railway and other
 * platforms set from the plan). Read on every call, so a plan or limit change is seen without a
 * restart. An unlimited cgroup falls back to GAMEPLAY_API_*_LIMIT_*, or to the host when allowed.
 */
export async function apiResourceLimits(
  env: NodeJS.ProcessEnv,
  hostFallback: boolean,
): Promise<ResourceLimits> {
  const [cpuMax, memoryMax] = await Promise.all([
    readFile("/sys/fs/cgroup/cpu.max", "utf8").catch(() => "max 100000"),
    readFile("/sys/fs/cgroup/memory.max", "utf8").catch(() => "max"),
  ]);
  const configured = (value: string | undefined, host: number) =>
    hostFallback && !value ? host : positive(value, "INVALID_RESOURCE_LIMIT");
  const [quota, period] = cpuMax.trim().split(/\s+/);
  const limits = {
    cpuCores:
      quota === "max"
        ? configured(env.GAMEPLAY_API_CPU_LIMIT_CORES, availableParallelism())
        : Number(quota) / Number(period),
    memoryBytes:
      memoryMax.trim() === "max"
        ? configured(env.GAMEPLAY_API_MEMORY_LIMIT_BYTES, totalmem())
        : Number(memoryMax.trim()),
  };
  requireState(
    Object.values(limits).every((v) => Number.isFinite(v) && v > 0),
    "INVALID_RESOURCE_LIMIT",
    500,
  );
  return limits;
}

/** Memory this container uses now (cgroup, cache-inclusive), or this process's RSS outside one. */
export async function apiMemoryUsed() {
  const current = await readFile("/sys/fs/cgroup/memory.current", "utf8").catch(() => "");
  return Number(current.trim()) || process.memoryUsage().rss;
}

/**
 * The admission ceiling for these resources. A measured envelope (all three GAMEPLAY_CAPACITY_*
 * values, from a load test) is used as given; otherwise the ceiling follows the resources, so a
 * bigger plan admits proportionally more rooms with no code or config change.
 */
export function capacityCeiling(
  env: NodeJS.ProcessEnv,
  limits: ResourceLimits,
): { ceiling: CapacityVector; basis: "measured" | "resources" } {
  const fixed = [env.GAMEPLAY_CAPACITY_ROOMS, env.GAMEPLAY_CAPACITY_MEMBERS, env.GAMEPLAY_CAPACITY_GAMES];
  if (fixed.some(Boolean)) {
    const [rooms, members, games] = fixed.map((v) => positive(v, "INVALID_CAPACITY_PROFILE"));
    return { ceiling: { rooms: rooms!, members: members!, games: games! }, basis: "measured" };
  }
  const perCpu = env.GAMEPLAY_CAPACITY_ROOMS_PER_CPU
      ? positive(env.GAMEPLAY_CAPACITY_ROOMS_PER_CPU, "INVALID_CAPACITY_PROFILE")
      : DEFAULT_ROOMS_PER_CPU,
    perGb = env.GAMEPLAY_CAPACITY_ROOMS_PER_GB
      ? positive(env.GAMEPLAY_CAPACITY_ROOMS_PER_GB, "INVALID_CAPACITY_PROFILE")
      : DEFAULT_ROOMS_PER_GB;
  const byCpu = Math.min(limits.cpuCores, USEFUL_API_CORES) * perCpu,
    byMemory = (limits.memoryBytes / 2 ** 30) * perGb;
  const rooms = Math.min(MAX_ROOMS, Math.max(MIN_ROOMS, Math.floor(Math.min(byCpu, byMemory))));
  return {
    ceiling: { rooms, members: rooms * MEMBERS_PER_ROOM, games: rooms },
    basis: "resources",
  };
}
