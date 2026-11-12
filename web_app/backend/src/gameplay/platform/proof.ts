import { createHash, timingSafeEqual } from "node:crypto";
import { GameplayProblem } from "./problem.js";

export function secretBytes(secret: unknown): Buffer {
  if (typeof secret !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(secret))
    throw new GameplayProblem(401, "INVALID_PROOF");
  const value = Buffer.from(secret, "base64url");
  if (value.length !== 32 || value.toString("base64url") !== secret)
    throw new GameplayProblem(401, "INVALID_PROOF");
  return value;
}
export function proof(
  purpose: string,
  resource: string,
  secret: unknown,
): Buffer {
  return createHash("sha256")
    .update(`sahsah:v1:${purpose}:${resource}\0`)
    .update(secretBytes(secret))
    .digest();
}
export function equalProof(a: Buffer | null | undefined, b: Buffer): boolean {
  return !!a && a.length === b.length && timingSafeEqual(a, b);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function digest(
  operation: string,
  resource: string,
  body: object,
): Buffer {
  const semantic: Record<string, unknown> = { ...body };
  for (const key of ["proposedControlSecret", "reconnectSecret"])
    if (key in semantic)
      semantic[key] = createHash("sha256")
        .update(secretBytes(semantic[key]))
        .digest("hex");
  return createHash("sha256")
    .update(canonical({ operation, resource, body: semantic }))
    .digest();
}
