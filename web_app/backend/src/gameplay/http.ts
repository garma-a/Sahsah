import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { from, lastValueFrom } from "rxjs";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { GameplayService } from "./service.js";
import { GameplayRates } from "./rates.js";
import { requireState } from "./problem.js";

@Injectable()
export class GameplayHttpInterceptor implements NestInterceptor,OnModuleInit {
  private rates = new GameplayRates();
  private sources = new Map<string, number>();
  private policy={ipRate:100,ipBurst:240,subjectRate:60,subjectBurst:240};
  constructor(private core: GameplayService,private config:ConfigService) {}
  onModuleInit(){
    if(!this.core.options.enabled)return;
    const setting=(name:string,fallback:number)=>{const raw=this.config.get<string>(name,String(fallback));const n=Number(raw);requireState(/^\d+$/.test(raw)&&Number.isSafeInteger(n)&&n>=1&&n<=10000,"INVALID_HTTP_RATE_CONFIGURATION",500);return n;};
    this.policy={ipRate:setting("GAMEPLAY_HTTP_IP_RATE",100),ipBurst:setting("GAMEPLAY_HTTP_IP_BURST",240),subjectRate:setting("GAMEPLAY_HTTP_SUBJECT_RATE",60),subjectBurst:setting("GAMEPLAY_HTTP_SUBJECT_BURST",240)};
  }
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp(),
      req = http.getRequest<Request>(),
      res = http.getResponse<Response>();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Request-ID", randomUUID());
    return from(this.execute(req, next));
  }
  private async execute(req: Request, next: CallHandler) {
    const started = performance.now(),
      path = req.path.toLowerCase();
    this.core.enabled();
    this.rates.take(`ip:${req.ip ?? req.socket.remoteAddress}`, this.policy.ipRate, this.policy.ipBurst);
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
      (invitation && req.method === "GET");
    let subject: string | undefined;
    if (anonymousJoin && typeof req.body.reconnectSecret === "string")
      subject = `proposal:${this.core.fingerprint(req.body.reconnectSecret)}`;
    else if (
      !publicRead ||
      (req.headers.authorization && path.includes("/packs"))
    ) {
      const actor = await this.core.scheduler.run(
        this.core.knownCredential(req.headers.authorization)
          ? "protected"
          : "public",
        () => this.core.actor(req),
      );
      subject = actor.account
        ? `account:${actor.account.accountId}`
        : `guest:${actor.member!.id}`;
      this.rates.take(subject, this.policy.subjectRate, this.policy.subjectBurst);
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
      const result = await this.core.scheduler.run(lane, () =>
        lastValueFrom(next.handle()),
      );
      if (allocation && sourceKey) {
        if (this.sources.size >= 4096)
          this.sources.delete(this.sources.keys().next().value!);
        this.sources.set(sourceKey, Date.now() + 3600000);
      }
      if (path.endsWith("/commands") && req.method === "POST")
        this.core.metrics.command(performance.now() - started);
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
        this.core.metrics.refused++;
      throw error;
    }
  }
}
