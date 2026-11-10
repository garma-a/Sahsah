import { readFileSync } from "node:fs";
import { Ajv, type ValidateFunction } from "ajv";
import addFormats = require("ajv-formats");
import { z } from "zod";
import type { Data } from "./ports.js";
import { GameplayProblem } from "./problem.js";

export const openapi = JSON.parse(
  readFileSync(new URL("./contracts/openapi.json", import.meta.url), "utf8"),
);
function convert(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(convert);
  if (!value || typeof value !== "object") return value;
  const source = value as Data;
  const result: Data = {};
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
export function inputSchema(name: string) {
  // Zod's Standard Schema interface integrates with Nest; AJV validates the
  // reviewed contract so input/output definitions cannot drift into permissive DTOs.
  return z
    .custom<Data>((value) => validator(name)(normalize(value)), {
      error: "Invalid request",
    })
    .transform((value) => normalize(value) as Data)
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
export function input(name: string, value: unknown): Data {
  if (!validator(name)(value)) throw new GameplayProblem(400, "INVALID_INPUT");
  return value as Data;
}
export function output(name: string, value: unknown): Data {
  if (!validator(name)(value))
    throw new GameplayProblem(500, "RESPONSE_CONTRACT_ERROR");
  return value as Data;
}
export const schemas = Object.fromEntries(
  Object.keys(openapi.components.schemas).map((name) => [
    name,
    inputSchema(name),
  ]),
);
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
