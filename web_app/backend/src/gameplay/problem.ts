import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { context, log, errorStack } from "./logging.js";
import type { Response } from "express";
import type { JsonObject } from "../database/schema/types.js";

export class GameplayProblem extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: JsonObject = {},
  ) {
    super(code);
  }
}
export function requireState(
  condition: unknown,
  code = "INVALID_TRANSITION",
  status = 409,
  details: JsonObject = {},
): asserts condition {
  if (!condition) throw new GameplayProblem(status, code, details);
}
export function databaseCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  const e = error;
  return ("code" in e && typeof e.code === "string" ? e.code : undefined) ?? databaseCode("cause" in e ? e.cause : undefined);
}
export function databaseConstraint(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  const value = error;
  return ("constraint" in value && typeof value.constraint === "string" ? value.constraint : undefined) ?? databaseConstraint("cause" in value ? value.cause : undefined);
}
@Catch()
export class GameplayProblemFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let problem = error instanceof GameplayProblem ? error : undefined;
    const code = databaseCode(error);
    if (!problem && code && ["23505", "23514", "23503"].includes(code))
      problem = new GameplayProblem(409, "STATE_CONFLICT");
    if (
      !problem &&
      code &&
      ["40001", "40P01", "57014", "55P03", "53300", "08006"].includes(code)
    )
      problem = new GameplayProblem(503, "SERVICE_BUSY");
    const status =
      problem?.status ??
      (error instanceof HttpException ? error.getStatus() : 500);
    const applicationCode =
      problem?.code ??
      (status === 400
        ? "INVALID_INPUT"
        : status === 401
          ? "UNAUTHENTICATED"
          : "INTERNAL_ERROR");
    if (status === 429 || status === 503)
      response.setHeader("Retry-After", "15");
    const requestId = context().requestId;
    if (status >= 500) log.error("platform.problem.catch", { code: applicationCode, status, stack: errorStack(error) });
    else if (error instanceof GameplayProblem) log.warn("platform.problem.catch", { code: applicationCode, status });
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("Cache-Control", "private, no-store");
    response
      .status(status)
      .type("application/problem+json")
      .json({
        type: `urn:sahsah:problem:${applicationCode.toLowerCase()}`,
        title: applicationCode.replaceAll("_", " "),
        status,
        code: applicationCode,
        requestId,
        ...(problem?.details ?? {}),
      });
  }
}
