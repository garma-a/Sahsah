import { GameplayIdentity } from "./identity.js";
import { GameplayRuntime } from "./runtime.js";
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { from, lastValueFrom } from "rxjs";
import type { Request, RequestHandler, Response } from "express";
import type { IncomingMessage } from "node:http";
import { context as loggingContext, log } from "./logging.js";
import { GameplayRates, sourceKey } from "./rates.js";
import { requireState, sendProblem } from "./problem.js";

/** Number of platform proxies in front of the API; 0 trusts no forwarded address. */
export function trustedProxyHops(env: NodeJS.ProcessEnv) {
  const raw = env.TRUSTED_PROXY_HOPS ?? "0";
  requireState(/^[0-3]$/.test(raw), "INVALID_PROXY_CONFIGURATION", 500);
  return Number(raw);
}
/** Client address as seen through exactly the configured number of proxies. */
export function clientAddress(
  req: IncomingMessage,
  hops = trustedProxyHops(process.env),
) {
  const direct = req.socket.remoteAddress ?? "unknown";
  if (!hops) return direct;
  const forwarded = String(req.headers["x-forwarded-for"] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return [...forwarded, direct].at(-1 - hops) ?? forwarded[0] ?? direct;
}

/** Validated HTTP rate policy: per source address (edge) and per verified subject (gameplay). */
export function httpRatePolicy(env: NodeJS.ProcessEnv) {
  const setting = (name: string, fallback: number) => {
    const raw = env[name] || String(fallback);
    const n = Number(raw);
    requireState(
      /^\d+$/.test(raw) && Number.isSafeInteger(n) && n >= 1 && n <= 10000,
      "INVALID_HTTP_RATE_CONFIGURATION",
      500,
    );
    return n;
  };
  return {
    ipRate: setting("GAMEPLAY_HTTP_IP_RATE", 100),
    ipBurst: setting("GAMEPLAY_HTTP_IP_BURST", 240),
    subjectRate: setting("GAMEPLAY_HTTP_SUBJECT_RATE", 60),
    subjectBurst: setting("GAMEPLAY_HTTP_SUBJECT_BURST", 240),
  };
}

/**
 * First middleware after request logging, for every route (API, health, preview, AdminJS, unknown
 * paths): baseline security headers and one token bucket per source address, refused before any
 * body parsing, authentication or database work.
 */
export function edgeProtection(env: NodeJS.ProcessEnv): RequestHandler {
  const { ipRate, ipBurst } = httpRatePolicy(env),
    hops = trustedProxyHops(env),
    rates = new GameplayRates();
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    try {
      rates.take(`ip:${sourceKey(clientAddress(req, hops))}`, ipRate, ipBurst);
    } catch {
      log.warn("platform.http.edge", { code: "RATE_LIMITED", status: 429 });
      // A refill of one token at the configured rate: an honest wait, not a guess.
      return sendProblem(res, 429, "RATE_LIMITED", Math.max(1, Math.ceil(1 / ipRate)));
    }
    next();
  };
}

@Injectable()
export class GameplayHttpInterceptor implements NestInterceptor {
  private rates = new GameplayRates();
  private sources = new Map<string, number>();
  private policy = httpRatePolicy(process.env);
  constructor(
    readonly runtime: GameplayRuntime,
    readonly identity: GameplayIdentity,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp(),
      req = http.getRequest<Request>(),
      res = http.getResponse<Response>();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Request-ID", loggingContext().requestId);
    return from(this.execute(req, next));
  }
  private async execute(req: Request, next: CallHandler) {
    const started = performance.now(),
      path = req.path.toLowerCase();
    this.runtime.enabled();
    const invitation = path.includes("/room-invitations/"),
      anonymousJoin =
        invitation &&
        req.method === "POST" &&
        req.body?.identity === "anonymous";
    const allocation =
      req.method === "POST" &&
      (path.endsWith("/rooms") ||
        /\/rooms\/[^/]+\/games$/.test(path) ||
        anonymousJoin ||
        invitation);
    const publicRead =
      path.endsWith("/categories") ||
      path.includes("/packs") ||
      path.endsWith("/gameplay/availability") ||
      // ADR 0019: the card's code is its own credential; still rate limited per address.
      (req.method === "GET" && path.endsWith("/charades-card")) ||
      (invitation && req.method === "GET");
    let subject: string | undefined;
    if (anonymousJoin && typeof req.body.reconnectSecret === "string")
      subject = `proposal:${this.identity.fingerprint(req.body.reconnectSecret)}`;
    else if (
      !publicRead ||
      (req.headers.authorization && path.includes("/packs"))
    ) {
      const actor = await this.runtime.scheduler.run(
        this.identity.knownCredential(req.headers.authorization)
          ? "protected"
          : "public",
        () => this.identity.actor(req),
      );
      subject = actor.account
        ? `account:${actor.account.accountId}`
        : `guest:${actor.member!.id}`;
      this.rates.take(
        subject,
        this.policy.subjectRate,
        this.policy.subjectBurst,
      );
    }
    const operation =
      typeof req.headers["idempotency-key"] === "string"
        ? req.headers["idempotency-key"].toLowerCase()
        : "";
    const sourceKey = subject
      ? `${req.method}:${path}:${operation}:${subject}`
      : undefined;
    const recovery =
      !!sourceKey && (this.sources.get(sourceKey) ?? 0) > Date.now();
    const lane =
      publicRead || (allocation && !recovery) ? "public" : "protected";
    try {
      const result = await this.runtime.scheduler.run(lane, () =>
        lastValueFrom(next.handle()),
      );
      // The category list is identical for every caller, so browsers and the
      // CDN may reuse a success briefly. Everything else stays uncached.
      if (path.endsWith("/categories"))
        req.res!.setHeader("Cache-Control", "public, max-age=60");
      if (allocation && sourceKey) {
        if (this.sources.size >= 4096)
          this.sources.delete(this.sources.keys().next().value!);
        this.sources.set(sourceKey, Date.now() + 3600000);
      }
      if (path.endsWith("/commands") && req.method === "POST")
        this.runtime.metrics.command(performance.now() - started);
      return result;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        ["SERVER_AT_CAPACITY", "WORK_BUDGET_EXHAUSTED"].includes(
          String(error.code),
        )
      )
        this.runtime.metrics.refused++;
      throw error;
    }
  }
}
