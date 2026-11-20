import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { PressureSample, VerifiedAccount } from "./ports.js";
import { requireState } from "./problem.js";
import type { GameplayMetrics } from "./metrics.js";
import type { GameplayScheduler } from "./scheduler.js";
import { apiMemoryUsed, apiResourceLimits } from "./capacity.js";

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
/** Fraction of this container's CPU or memory limit in use, whichever is higher. */
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
    const [limits, memoryUsed] = await Promise.all([
      apiResourceLimits(env, hostFallback),
      apiMemoryUsed(),
    ]);
    return Math.max(cpuUsed / limits.cpuCores, memoryUsed / limits.memoryBytes);
  };
}
/**
 * Application pressure: event-loop p99 against a 200 ms budget, and the share of the last interval
 * every database work slot was busy. The second is how the API sees its database saturating even
 * without a database exporter, so the preview's ceiling can follow its resources safely.
 */
function applicationLoad(metrics: GameplayMetrics, scheduler: GameplayScheduler) {
  const loop = metrics.loop.percentile(99) / 1000000;
  metrics.loop.reset();
  return Math.max(loop / 200, scheduler.saturation());
}
/** Preview admission: API process and application pressure (no database exporter, ADR 0017). */
export function previewPressure(
  env: NodeJS.ProcessEnv,
  metrics: GameplayMetrics,
  scheduler: GameplayScheduler,
): () => Promise<PressureSample> {
  const api = apiLoad(env, true);
  return async () => ({
    api: await api(),
    database: 0,
    sampledAt: Date.now(),
    application: applicationLoad(metrics, scheduler),
  });
}
/**
 * Production admission: API, database (from its exporter) and application pressure. Each is a
 * fraction of the limits reported at that moment, so a database plan change is followed, not
 * refused.
 */
export function resourcePressure(
  env: NodeJS.ProcessEnv,
  metrics: GameplayMetrics,
  scheduler: GameplayScheduler,
): (() => Promise<PressureSample>) | undefined {
  if (!env.GAMEPLAY_DB_PRESSURE_URL) return;
  const url = new URL(env.GAMEPLAY_DB_PRESSURE_URL);
  requireState(
    url.protocol === "https:" && !url.username && !url.password,
    "INVALID_PRESSURE_SOURCE",
    500,
  );
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
      dbSample = parsed.data;
      dbFetchedAt = now;
    }
    const sourceAt = Date.parse(dbSample.sampledAt);
    requireState(sourceAt <= now + 1000, "INVALID_PRESSURE_TIME", 503);
    return {
      api: apiUsed,
      database: Math.max(
        dbSample.cpuUsedCores / dbSample.cpuLimitCores,
        dbSample.memoryUsedBytes / dbSample.memoryLimitBytes,
      ),
      sampledAt: now,
      databaseSampledAt: sourceAt,
      application: applicationLoad(metrics, scheduler),
    };
  };
}
