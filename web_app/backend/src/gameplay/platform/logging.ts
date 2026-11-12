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
const parents = new WeakMap<LogContext, LogContext>();
export function context() {
  return (
    logContext.getStore() ?? { requestId: processId, scope: "platform.process" }
  );
}
export function withContext<T>(
  scope: string,
  work: () => T,
  fields: Partial<LogContext> = {},
): T {
  const parent = logContext.getStore();
  const next = { ...context(), ...fields, scope };
  if (parent && parent.requestId === next.requestId) parents.set(next, parent);
  return logContext.run(next, work);
}
export function enrichContext(
  fields: Partial<Omit<LogContext, "scope" | "requestId">>,
) {
  let current = logContext.getStore();
  while (current) {
    Object.assign(current, fields);
    current = parents.get(current);
  }
}
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Accept a caller's UUID so problem bodies, headers and logs share one ID. */
export function requestId(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value)
    ? value.toLowerCase()
    : randomUUID();
}
/** The current request or connection ID; a fresh UUID outside any context. */
export function currentRequestId() {
  return logContext.getStore()?.requestId ?? randomUUID();
}
export function logLevel(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "test" || env.NODE_TEST_CONTEXT) return "silent";
  return env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug");
}
function causeField(error: unknown, key: "code" | "constraint"): string | undefined {
  for (let e = error, depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    const value = (e as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}
// Messages of these runtime errors describe code defects, not request data.
const safeMessageErrors = new Set(["TypeError", "RangeError", "ReferenceError"]);
/**
 * A safe summary line plus stack frames. Database and driver messages can
 * contain SQL parameters and are never included; their code and constraint are.
 */
export function errorStack(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  const code = causeField(error, "code"),
    constraint = causeField(error, "constraint"),
    message = safeMessageErrors.has(error.name)
      ? `: ${error.message.slice(0, 200)}`
      : "";
  const summary = [
    `${error.name}${message}`,
    code ? `code=${code}` : "",
    constraint ? `constraint=${constraint}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const frames = error.stack
    ?.split("\n")
    .filter((line) => /^\s+at .+\:\d+\:\d+\)?$/.test(line));
  return [summary, ...(frames ?? [])]
    .join("\n")
    .replace(/https?:\/\/\S+/g, "[REDACTED]");
}
export function loggerOptions(): LoggerOptions {
  return {
    level: logLevel(),
    base: undefined,
    // Pino otherwise copies err.message into msg before running serializers.
    hooks: {
      logMethod(args, method) {
        const [fields] = args;
        if (fields instanceof Error) method.call(this, { err: fields }, "");
        else if (fields && typeof fields === "object") {
          const safe = Object.fromEntries(
            Object.entries(fields).filter(([key]) => key !== "msg"),
          );
          method.call(this, safe, "");
        } else method.call(this, { code: "LOG_MESSAGE_OMITTED" }, "");
      },
    },
    mixin: () => ({ ...context() }),
    // Defense in depth; callers only send the bounded LogFields above.
    redact: {
      paths: [
        "req",
        "res",
        "body",
        "headers",
        "authorization",
        "credential",
        "token",
        "secret",
        "controlSecret",
        "reconnectSecret",
        "passcode",
        "previewPasscode",
        "invitationCode",
        "phone",
        "phoneE164",
        "url",
        "signedUrl",
        '["x-guest-proof"]',
        '["x-control-secret"]',
        "*.authorization",
        "*.credential",
        "*.secret",
        "*.passcode",
        "*.url",
      ],
      remove: true,
    },
    serializers: { err: (error: unknown) => ({ stack: errorStack(error) }) },
  };
}
let logger: Logger | undefined;
export function rootLogger() {
  return (logger ??= pino(loggerOptions()));
}
export const log = {
  info(scope: string, fields: LogFields = {}) {
    withContext(scope, () => rootLogger().info(fields));
  },
  warn(scope: string, fields: LogFields = {}) {
    withContext(scope, () => rootLogger().warn(fields));
  },
  error(scope: string, fields: LogFields = {}) {
    withContext(scope, () => rootLogger().error(fields));
  },
  debug(scope: string, fields: LogFields = {}) {
    withContext(scope, () => rootLogger().debug(fields));
  },
};

export function requestLogging(): RequestHandler {
  const http = pinoHttp({
    logger: rootLogger(),
    genReqId: (req) =>
      typeof req.id === "string" ? req.id : requestId(req.headers["x-request-id"]),
    quietReqLogger: true,
    quietResLogger: true,
    // Logging only the template prevents invitation codes and signed paths leaking.
    customSuccessObject: (req, res, value) => ({
      scope: "platform.http.complete",
      route: routeTemplate(req),
      status: res.statusCode,
      durationMs: value.responseTime,
    }),
    customErrorObject: (req, res, _error, value) => ({
      scope: "platform.http.complete",
      route: routeTemplate(req),
      status: res.statusCode,
      durationMs: value.responseTime,
    }),
    customLogLevel: () => "info",
    customSuccessMessage: () => "http",
    customErrorMessage: () => "http",
  });
  return (req, res, next) => {
    const requestContext = {
      requestId: requestId(req.headers["x-request-id"]),
      scope: "platform.http",
    };
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
  warn() {
    withContext("platform.nest.warn", () =>
      this.logger.warn({ code: "NEST_WARNING" }),
    );
  }
  error(error: unknown) {
    withContext("platform.nest.error", () =>
      this.logger.error({ code: "NEST_ERROR", stack: errorStack(error) }),
    );
  }
  fatal(error: unknown) {
    this.error(error);
  }
}

/** Preserve the async scope across existing methods without changing their arguments. */
export function scoped(scope: string) {
  return function <A extends unknown[], R>(
    _target: object,
    _name: string,
    descriptor: TypedPropertyDescriptor<(...args: A) => R>,
  ) {
    const work = descriptor.value;
    if (work)
      descriptor.value = function (...args: A): R {
        return withContext(scope, () => work.apply(this, args));
      };
  };
}
