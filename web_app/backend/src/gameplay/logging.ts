import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { pino, type Logger, type LoggerOptions } from "pino";
import { pinoHttp } from "pino-http";
import type { LoggerService } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

export interface LogContext {
  requestId: string;
  operationId?: string;
  roomId?: string;
  gameId?: string;
  accountId?: string;
  scope: string;
}
export interface LogFields {
  code?: string;
  name?: string;
  outcome?: string;
  versionBefore?: string;
  versionAfter?: string;
  status?: number;
  durationMs?: number;
  closeCode?: number;
  attempt?: number;
  count?: number;
  games?: number;
  rooms?: number;
  invitations?: number;
  waitMs?: number;
  stack?: string;
}
export const logContext = new AsyncLocalStorage<LogContext>();
const processId = randomUUID();
export function context() {
  return logContext.getStore() ?? { requestId: processId, scope: "platform.process" };
}
export function withContext<T>(scope: string, work: () => T, fields: Partial<LogContext> = {}): T {
  return logContext.run({ ...context(), ...fields, scope }, work);
}
export function enrichContext(fields: Partial<Omit<LogContext, "scope" | "requestId">>) {
  const current = logContext.getStore();
  if (current) Object.assign(current, fields);
}
export function requestId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
    ? value
    : randomUUID();
}
export function logLevel(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "test" || env.NODE_TEST_CONTEXT) return "silent";
  return env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug");
}
/** Never serialize error messages, causes, SQL, parameters or arbitrary objects. */
export function errorStack(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return error.stack?.split("\n").filter((line) => /^\s+at .+\:\d+\:\d+\)?$/.test(line))
    .map((line) => line.replace(/https?:\/\/\S+/g, "[REDACTED]"))
    .join("\n");
}
export function loggerOptions(): LoggerOptions {
  return {
    level: logLevel(),
    base: undefined,
    // Pino otherwise copies err.message into msg before running serializers.
    hooks: { logMethod(args, method) {
      const [fields] = args;
      if (fields instanceof Error) method.call(this, { err: fields }, "");
      else if (fields && typeof fields === "object") {
        const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "msg"));
        method.call(this, safe, "");
      }
      else method.call(this, { code: "LOG_MESSAGE_OMITTED" }, "");
    } },
    mixin: () => ({ ...context() }),
    // Defense in depth; callers only send the bounded LogFields above.
    redact: { paths: [
      "req", "res", "body", "headers", "authorization", "credential", "token",
      "secret", "controlSecret", "reconnectSecret", "passcode", "previewPasscode",
      "invitationCode", "phone", "phoneE164", "url", "signedUrl",
      '["x-guest-proof"]', '["x-control-secret"]',
      "*.authorization", "*.credential", "*.secret", "*.passcode", "*.url",
    ], remove: true },
    serializers: { err: (error: unknown) => ({ stack: errorStack(error) }) },
  };
}
let logger: Logger | undefined;
export function rootLogger() {
  return logger ??= pino(loggerOptions());
}
export const log = {
  info(scope: string, fields: LogFields = {}) { withContext(scope, () => rootLogger().info(fields)); },
  warn(scope: string, fields: LogFields = {}) { withContext(scope, () => rootLogger().warn(fields)); },
  error(scope: string, fields: LogFields = {}) { withContext(scope, () => rootLogger().error(fields)); },
  debug(scope: string, fields: LogFields = {}) { withContext(scope, () => rootLogger().debug(fields)); },
};

export function requestLogging(): RequestHandler {
  const http = pinoHttp({
    logger: rootLogger(),
    genReqId: (req) => requestId(req.headers["x-request-id"]),
    quietReqLogger: true,
    quietResLogger: true,
    // Logging only the template prevents invitation codes and signed paths leaking.
    customSuccessObject: (req, res, value) => ({
      scope: "platform.http.complete",
      route: routeTemplate(req), status: res.statusCode, durationMs: value.responseTime,
    }),
    customErrorObject: (req, res, _error, value) => ({
      scope: "platform.http.complete",
      route: routeTemplate(req), status: res.statusCode, durationMs: value.responseTime,
    }),
    customLogLevel: () => "info",
    customSuccessMessage: () => "http",
    customErrorMessage: () => "http",
  });
  return (req, res, next) => {
    const requestContext = { requestId: requestId(req.headers["x-request-id"]), scope: "platform.http" };
    req.id = requestContext.requestId;
    res.setHeader("X-Request-Id", requestContext.requestId);
    logContext.run(requestContext, () => http(req, res, next));
  };
}
function routeTemplate(req: Request | import("node:http").IncomingMessage) {
  return "route" in req && req.route && typeof req.route.path === "string"
    ? req.route.path
    : "<unmatched>";
}

/** Nest may pass provider errors containing SQL/credentials: keep only stack frames. */
export class SafeNestLogger implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}
  log() {}
  debug() {}
  verbose() {}
  warn() { withContext("platform.nest.warn", () => this.logger.warn({ code: "NEST_WARNING" })); }
  error(error: unknown) {
    withContext("platform.nest.error", () => this.logger.error({ code: "NEST_ERROR", stack: errorStack(error) }));
  }
  fatal(error: unknown) { this.error(error); }
}
