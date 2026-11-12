import { ApiError } from "./client";

export const GENERIC_ERROR = "حصلت مشكلة. جرّب تاني.";

/** The friendly Arabic text for anything a request can throw. */
export function messageOf(cause: unknown, fallback = GENERIC_ERROR): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

/** A receipt field the flow cannot continue without: absence is a server fault, never a silent default. */
export function requireField<T>(value: T | undefined): T {
  if (value === undefined) throw new ApiError(500, "INTERNAL_ERROR");
  return value;
}

/** A 409 means the room moved on: the caller should take the current projection before retrying. */
export function isConflict(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === 409;
}

/** Anything thrown by a request as an ApiError, so state can carry one shape. */
export function asApiError(cause: unknown, code = "NETWORK"): ApiError {
  return cause instanceof ApiError ? cause : new ApiError(0, code);
}
