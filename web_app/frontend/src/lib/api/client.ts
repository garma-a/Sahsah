import { problemMessage } from "./problems";
import type { Id, Language, ProblemBody } from "./types";

/** The UI is Arabic only; the parameter is wired through so a later toggle needs no API change. */
export const LANGUAGE: Language = "ar";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
export const API_V1 = `${apiBase}/v1`;
export const REALTIME_URL = `${API_V1.replace(/^http/, "ws")}/realtime`;

export type Auth =
  | { kind: "none" }
  | { kind: "account"; credential: string }
  | { kind: "guest"; membershipId: Id; secret: string }
  | { kind: "host"; credential: string; controlSecret: string; generation: string };

export function bearer(auth: Auth): string | undefined {
  if (auth.kind === "account" || auth.kind === "host") return `Bearer ${auth.credential}`;
  if (auth.kind === "guest") return `Bearer g.${auth.membershipId}.${auth.secret}`;
  return undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body?: ProblemBody;
  readonly retryAfter?: number;
  constructor(status: number, code: string, body?: ProblemBody, retryAfter?: number) {
    super(problemMessage(code, status));
    this.status = status;
    this.code = code;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  auth?: Auth;
  body?: unknown;
  /** Stable per-intent key for effectful calls, saved before sending so a retry recovers the outcome. */
  operationId?: string;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

function headers(options: RequestOptions): Headers {
  const result = new Headers({ Accept: "application/json, application/problem+json" });
  const auth = options.auth ?? { kind: "none" };
  const authorization = bearer(auth);
  if (authorization) result.set("Authorization", authorization);
  if (auth.kind === "host") {
    result.set("X-Control-Secret", auth.controlSecret);
    result.set("X-Controller-Generation", auth.generation);
  }
  if (options.operationId) result.set("Idempotency-Key", options.operationId);
  if (options.body !== undefined) result.set("Content-Type", "application/json");
  return result;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_V1}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: headers(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new ApiError(0, timedOut ? "TIMEOUT" : "NETWORK");
  }
  if (response.ok) return (await response.json()) as T;
  let body: ProblemBody | undefined;
  try {
    body = (await response.json()) as ProblemBody;
  } catch {
    body = undefined;
  }
  const retryAfter = Number(response.headers.get("Retry-After")) || undefined;
  throw new ApiError(response.status, body?.code ?? "UNKNOWN", body, retryAfter);
}
