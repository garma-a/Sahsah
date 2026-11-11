import { readFileSync } from "node:fs";
import { Ajv, type ValidateFunction } from "ajv";
import addFormats = require("ajv-formats");
import { z } from "zod";
import type { WireTypes } from "./contracts/wire-types.js";
import { makeSchemas } from "./contracts/schema-registry.js";
export type Contract<N extends keyof typeof schemas> = z.output<(typeof schemas)[N]>;
import { GameplayProblem } from "./platform/problem.js";

export const openapi = JSON.parse(
  readFileSync(new URL("./contracts/openapi.json", import.meta.url), "utf8"),
);
function convert(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convert);
  if (!value || typeof value !== "object") return value;
  const source = Object.fromEntries(Object.entries(value));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) {
    if (["nullable", "discriminator", "writeOnly"].includes(key)) continue;
    result[key] =
      key === "$ref"
        ? String(item).replace("#/components/schemas/", "#/definitions/")
        : convert(item);
  }
  if (source.nullable && typeof result.type === "string")
    result.type = [result.type, "null"];
  return result;
}
const ajv = new Ajv({ strict: false, allErrors: false, validateFormats: true });
addFormats.default(ajv);
ajv.addSchema({
  $id: "sahsah",
  definitions: convert(openapi.components.schemas),
});
const validators = new Map<string, ValidateFunction>();
export function validator(name: string): ValidateFunction {
  let validate = validators.get(name);
  if (!validate) {
    validate = ajv.compile({ $ref: `sahsah#/definitions/${name}` });
    validators.set(name, validate);
  }
  return validate;
}
export function inputSchema<T>(name: string): z.ZodType<T> {
  // Zod's Standard Schema interface integrates with Nest; AJV validates the
  // reviewed contract so input/output definitions cannot drift into permissive DTOs.
  return z
    .custom<T>((value) => validator(name)(normalize(value)), {
      error: "Invalid request",
    })
    // Normalization trims strings and preserves the AJV-validated object shape.
    .transform((value) => normalize(value) as T)
    .meta({ id: name });
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        ["displayName", "teamOneName", "teamTwoName"].includes(key) &&
        typeof item === "string"
          ? item.trim()
          : normalize(item),
      ]),
    );
  return value;
}
export function input<N extends keyof WireTypes>(name: N, value: unknown): WireTypes[N] {
  if (!validator(name)(value)) throw new GameplayProblem(400, "INVALID_INPUT");
  // AJV validated this exact contract; its cached validator erases the generic.
  return value as WireTypes[N];
}
export function output<N extends keyof WireTypes>(name: N, value: unknown): WireTypes[N] {
  if (!validator(name)(value)) throw new GameplayProblem(500, "RESPONSE_CONTRACT_ERROR");
  // AJV validated this exact contract; its cached validator erases the generic.
  return value as WireTypes[N];
}
export const schemas = makeSchemas(inputSchema);
export const uuid = z.uuid();
export function id(value: unknown): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new GameplayProblem(400, "INVALID_IDENTIFIER");
  return parsed.data.toLowerCase();
}
export function position(value: string): number {
  if (!/^[1-6]$/.test(value))
    throw new GameplayProblem(400, "INVALID_POSITION");
  return Number(value);
}
export function revision(value: unknown): bigint {
  if (!validator("Revision")(value))
    throw new GameplayProblem(400, "INVALID_VERSION");
  return BigInt(String(value));
}
