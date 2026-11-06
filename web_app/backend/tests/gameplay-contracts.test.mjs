import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { GameplayController } from "../dist/gameplay/controller.js";
import { openapi } from "../dist/gameplay/contract.js";

test("Nest route, status, request and response contracts match the reviewed OpenAPI", async () => {
  assert.deepEqual(
    openapi,
    JSON.parse(
      await readFile(
        new URL("../../../docs/api/openapi.json", import.meta.url),
      ),
    ),
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        new URL(
          "../src/gameplay/contracts/realtime.schema.json",
          import.meta.url,
        ),
      ),
    ),
    JSON.parse(
      await readFile(
        new URL("../../../docs/api/realtime.schema.json", import.meta.url),
      ),
    ),
  );
  const operations = [];
  for (const name of Object.getOwnPropertyNames(GameplayController.prototype)) {
    const fn = GameplayController.prototype[name];
    if (typeof fn !== "function" || !Reflect.hasMetadata("method", fn))
      continue;
    const method =
      RequestMethod[Reflect.getMetadata("method", fn)].toLowerCase();
    const path =
      "/" + Reflect.getMetadata("path", fn).replace(/:([A-Za-z]+)/g, "{$1}");
    const operation = openapi.paths[path]?.[method];
    assert.ok(operation, `${method} ${path}`);
    const status =
      Reflect.getMetadata("__httpCode__", fn) ??
      (method === "post" ? 201 : 200);
    assert.ok(operation.responses[String(status)], `${name} status ${status}`);
    const expectedBody = operation.requestBody?.content[
      "application/json"
    ].schema.$ref
      ?.split("/")
      .at(-1);
    const args =
      Reflect.getMetadata("__routeArguments__", GameplayController, name) ?? {};
    const actualBody = Object.entries(args)
      .find(([key]) => key.startsWith("3:"))?.[1]
      .schema?.meta()?.id;
    assert.equal(actualBody, expectedBody, `${name} request`);
    const expectedOutput = operation.responses[String(status)].content[
      "application/json"
    ].schema.$ref
      .split("/")
      .at(-1);
    const actualOutput = Reflect.getMetadata(
      "class_serializer:options",
      fn,
    )?.schema?.meta()?.id;
    assert.equal(actualOutput, expectedOutput, `${name} response`);
    operations.push(`${method} ${path}`);
  }
  const expected = Object.values(openapi.paths).flatMap((path) =>
    Object.keys(path).filter((method) =>
      ["get", "post", "put", "patch"].includes(method),
    ),
  ).length;
  assert.equal(operations.length, expected);
  assert.equal(expected, 27);
});
