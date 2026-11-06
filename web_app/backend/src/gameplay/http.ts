import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { from, lastValueFrom } from "rxjs";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { GameplayService } from "./service.js";

@Injectable()
export class GameplayHttpInterceptor implements NestInterceptor {
  constructor(private core: GameplayService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp(),
      req = http.getRequest<Request>(),
      res = http.getResponse<Response>();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Request-ID", randomUUID());
    const started = performance.now();
    return from(
      this.core.scheduler.run(
        req.path.endsWith("/categories") ||
          req.path.includes("/packs") ||
          (req.path.includes("room-invitations") && req.method === "GET")
          ? "public"
          : "protected",
        async () => {
          const result = await lastValueFrom(next.handle());
          if (req.path.endsWith("/commands") && req.method === "POST")
            this.core.metrics.command(performance.now() - started);
          return result;
        },
      ),
    );
  }
}
