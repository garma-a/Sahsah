import { readFile } from "node:fs/promises";
import { availableParallelism, totalmem } from "node:os";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { PressureSample, VerifiedAccount } from "./ports.js";
import { requireState } from "./problem.js";
import type { GameplayMetrics } from "./metrics.js";

export function existingIdentity(
  env: NodeJS.ProcessEnv,
): ((token: string) => Promise<VerifiedAccount | undefined>) | undefined {
  if (!env.GAMEPLAY_IDENTITY_JWKS_URL) return;
  const url = new URL(env.GAMEPLAY_IDENTITY_JWKS_URL);
  requireState(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      env.GAMEPLAY_IDENTITY_ISSUER &&
      env.GAMEPLAY_IDENTITY_AUDIENCE,
    "INVALID_IDENTITY_CONFIGURATION",
    500,
  );
  const keys = createRemoteJWKSet(url, {
    timeoutDuration: 2000,
    cooldownDuration: 30000,
  });
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: env.GAMEPLAY_IDENTITY_ISSUER,
        audience: env.GAMEPLAY_IDENTITY_AUDIENCE,
        algorithms: ["RS256", "ES256"],
        requiredClaims: ["exp", "iat", "sub", "account_id"],
      });
      const account = z.uuid().safeParse(payload.account_id);
      if (account.success && payload.exp)
        return { accountId: account.data, expiresAt: payload.exp * 1000 };
    } catch {
      /* A provider failure never becomes an identity. */
    }
    return undefined;
  };
}

const dbMetric = z
  .object({
    cpuUsedCores: z.number().finite().nonnegative(),
    cpuLimitCores: z.number().finite().positive(),
    memoryUsedBytes: z.number().finite().nonnegative(),
    memoryLimitBytes: z.number().finite().positive(),
    sampledAt: z.iso.datetime(),
  })
  .strict();
const number = (value: string | undefined) => {
  const n = Number(value);
  requireState(Number.isFinite(n) && n > 0, "INVALID_RESOURCE_LIMIT", 500);
  return n;
};
/** Fraction of this process's CPU or memory limit in use, whichever is higher. */
function apiLoad(env: NodeJS.ProcessEnv, hostFallback = false) {
  let previousCpu = process.cpuUsage(),
    previousAt = performance.now();
  return async () => {
    const at = performance.now(),
      cpu = process.cpuUsage();
    const elapsedUs = Math.max(1, (at - previousAt) * 1000),
      cpuUsed =
        (cpu.user + cpu.system - previousCpu.user - previousCpu.system) /
        elapsedUs;
    previousCpu = cpu;
    previousAt = at;
    const [cpuMax, memoryMax, memoryCurrent] = await Promise.all([
      readFile("/sys/fs/cgroup/cpu.max", "utf8").catch(() => "max 100000"),
      readFile("/sys/fs/cgroup/memory.max", "utf8").catch(() => "max"),
      readFile("/sys/fs/cgroup/memory.current", "utf8").catch(() =>
        String(process.memoryUsage().rss),
      ),
    ]);
    const configured = (value: string | undefined, host: number) =>
      hostFallback && !value ? host : number(value);
    const cpuParts = cpuMax.trim().split(/\s+/);
    const cpuLimit =
      cpuParts[0] === "max"
        ? configured(env.GAMEPLAY_API_CPU_LIMIT_CORES, availableParallelism())
        : Number(cpuParts[0]) / Number(cpuParts[1]);
    const memoryLimit =
      memoryMax.trim() === "max"
        ? configured(env.GAMEPLAY_API_MEMORY_LIMIT_BYTES, totalmem())
        : Number(memoryMax.trim());
    requireState(
      cpuLimit > 0 &&
        Number.isFinite(cpuLimit) &&
        memoryLimit > 0 &&
        Number.isFinite(memoryLimit),
      "INVALID_RESOURCE_LIMIT",
      500,
    );
    return Math.max(
      cpuUsed / cpuLimit,
      Number(memoryCurrent.trim()) / memoryLimit,
    );
  };
}
/**
 * Preview admission: API process pressure only. The preview database has no
 * exporter, so the small fixed room ceiling bounds its load instead.
 */
export function previewPressure(
  env: NodeJS.ProcessEnv,
  metrics: GameplayMetrics,
): () => Promise<PressureSample> {
  const api = apiLoad(env, true);
  return async () => {
    const used = await api(),
      loop = metrics.loop.percentile(99) / 1000000;
    metrics.loop.reset();
    return {
      api: used,
      database: 0,
      sampledAt: Date.now(),
      application: loop / 200,
    };
  };
}
export function resourcePressure(
  env: NodeJS.ProcessEnv,
  metrics: GameplayMetrics,
): (() => Promise<PressureSample>) | undefined {
  if (!env.GAMEPLAY_DB_PRESSURE_URL) return;
  const url = new URL(env.GAMEPLAY_DB_PRESSURE_URL);
  requireState(
    url.protocol === "https:" && !url.username && !url.password,
    "INVALID_PRESSURE_SOURCE",
    500,
  );
  const expectedCpu = number(env.GAMEPLAY_DB_CPU_LIMIT_CORES),
    expectedMemory = number(env.GAMEPLAY_DB_MEMORY_LIMIT_BYTES);
  const api = apiLoad(env);
  let dbSample: z.infer<typeof dbMetric> | undefined,
    dbFetchedAt = 0;
  return async () => {
    const now = Date.now(),
      apiUsed = await api();
    if (!dbSample || now - dbFetchedAt >= 5000) {
      const response = await fetch(url, {
        headers: env.GAMEPLAY_DB_PRESSURE_TOKEN
          ? { Authorization: `Bearer ${env.GAMEPLAY_DB_PRESSURE_TOKEN}` }
          : {},
        signal: AbortSignal.timeout(2000),
        redirect: "error",
      });
      requireState(
        response.ok &&
          Number(response.headers.get("content-length") ?? 0) < 4096,
        "PRESSURE_UNAVAILABLE",
        503,
      );
      const text = await response.text();
      requireState(
        Buffer.byteLength(text) <= 4096,
        "PRESSURE_UNAVAILABLE",
        503,
      );
      const parsed = dbMetric.safeParse(JSON.parse(text));
      requireState(parsed.success, "PRESSURE_UNAVAILABLE", 503);
      requireState(
        parsed.data.cpuLimitCores === expectedCpu &&
          parsed.data.memoryLimitBytes === expectedMemory,
        "RESOURCE_PROFILE_CHANGED",
        503,
      );
      dbSample = parsed.data;
      dbFetchedAt = now;
    }
    const sourceAt = Date.parse(dbSample.sampledAt);
    requireState(sourceAt <= now + 1000, "INVALID_PRESSURE_TIME", 503);
    const loop = metrics.loop.percentile(99) / 1000000;
    metrics.loop.reset();
    return {
      api: apiUsed,
      database: Math.max(
        dbSample.cpuUsedCores / expectedCpu,
        dbSample.memoryUsedBytes / expectedMemory,
      ),
      sampledAt: now,
      databaseSampledAt: sourceAt,
      application: loop / 200,
    };
  };
}
