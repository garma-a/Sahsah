import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import { pino } from "pino";
import { context, errorStack, logLevel, loggerOptions, requestId, withContext, enrichContext } from "../dist/gameplay/platform/logging.js";

test("request IDs accept UUIDs and replace every other value", () => {
  const id = "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d20";
  assert.equal(requestId(id.toUpperCase()), id);
  for (const value of [undefined, ["one", "two"], "", "request-42.a_b", "x".repeat(65), "a\nb", "a/b"]) {
    assert.match(requestId(value), /^[a-f0-9-]{36}$/);
  }
  assert.equal(logLevel({ NODE_ENV: "production" }), "info");
  assert.equal(logLevel({}), "debug");
  assert.equal(logLevel({ NODE_ENV: "test", LOG_LEVEL: "debug" }), "silent");
});

test("async contexts isolate concurrent operations and retain known IDs", async () => {
  await Promise.all(["one", "two"].map((requestId) => withContext("games.commands.test", async () => {
    enrichContext({ operationId: requestId });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(context().requestId, requestId);
    assert.equal(context().operationId, requestId);
    assert.equal(context().scope, "games.commands.test");
  }, { requestId })));
  assert.equal(context().operationId, undefined);
});

test("structured log serializers omit private payloads and error messages", () => {
  let captured = "";
  const output = new Writable({ write(chunk, _encoding, done) { captured += chunk; done(); } });
  const logger = pino({ ...loggerOptions(), level: "debug" }, output);
  const secret = "never-record-this-private-value";
  const error = new Error(secret);
  withContext("platform.logging.test", () => logger.error({
    req: { headers: { authorization: secret, "x-guest-proof": secret }, body: { passcode: secret } },
    res: { headers: { location: secret } }, body: { invitationCode: secret },
    authorization: secret, credential: secret, secret, passcode: secret,
    invitationCode: secret, phoneE164: secret, url: secret, err: error,
  }), { requestId: "test-request" });
  assert.equal(captured.includes(secret), false);
  const record = JSON.parse(captured);
  assert.equal(record.requestId, "test-request");
  assert.equal(record.scope, "platform.logging.test");
  assert.match(record.err.stack, /gameplay-foundations.test.mjs/);
  assert.equal(errorStack(error).includes(secret), false);
  const database = Object.assign(new Error(secret), { cause: Object.assign(new Error(secret), { code: "23505", constraint: "rooms_one_open_owner" }) });
  assert.match(errorStack(database), /^Error code=23505 constraint=rooms_one_open_owner\n/);
  assert.equal(errorStack(database).includes(secret), false);
  assert.match(errorStack(new TypeError("x is not a function")), /^TypeError: x is not a function\n/);
});


test("invariants assert impossible states and exact single-row results", async () => {
  const { invariant, single } = await import("../dist/gameplay/platform/invariant.js");
  invariant(true, "VALID_STATE");
  assert.equal(single([42], "ONE_ROW"), 42);
  for (const check of [() => invariant(false, "IMPOSSIBLE"), () => single([], "MISSING"), () => single([1, 2], "EXTRA")]) {
    assert.throws(check, (error) => error.status === 500 && error.code === "INTERNAL_INVARIANT");
  }
});


test("state helpers reject impossible scores, positions and version transitions", async () => {
  const { stateInvariants, versionIncrement, written, writtenAtMost } = await import("../dist/gameplay/platform/invariant.js");
  stateInvariants({ teamOneScore: 0n, teamTwoScore: 10n, boardPosition: 1, questionPosition: 6, stageIndex: 2, remainingMs: 0 });
  versionIncrement(4n, 5n);
  await written(Promise.resolve([{ boardPosition: 3 }]), 1, "EXACT");
  await writtenAtMost(Promise.resolve([]), 1, "DEDUPLICATED");
  for (const row of [{ teamOneScore: -1n }, { boardPosition: 7 }, { stageIndex: 3 }, { remainingMs: 60001 }, { activeBoardPosition: 1, activeQuestionPosition: null }, { timerState: "running", timerDeadlineAt: null }]) {
    assert.throws(() => stateInvariants(row), { code: "INTERNAL_INVARIANT" });
  }
  assert.throws(() => versionIncrement(4n, 6n), { code: "INTERNAL_INVARIANT" });
  await assert.rejects(written(Promise.resolve([]), 1, "EXACT"), { code: "INTERNAL_INVARIANT" });
});


test("problem bodies, headers and logs share one request ID", async () => {
  const { GameplayProblem, GameplayProblemFilter } = await import("../dist/gameplay/platform/problem.js");
  const { output } = await import("../dist/gameplay/contract.js");
  const headers = new Map();
  let body;
  const response = {
    setHeader(name, value) { headers.set(name.toLowerCase(), value); return this; },
    status() { return this; }, type() { return this; }, json(value) { body = value; return this; },
  };
  withContext("platform.problem.test", () => {
    new GameplayProblemFilter().catch(new GameplayProblem(400, "INVALID_INPUT"), {
      switchToHttp: () => ({ getResponse: () => response }),
    });
  }, { requestId: "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d20" });
  assert.equal(headers.get("x-request-id"), "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d20");
  assert.equal(body.requestId, "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d20");
  assert.equal(output("Problem", body), body);
});

test("HTTP logging correlates requests while omitting paths, credentials and bodies", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const env = { ...process.env, NODE_ENV: "development", LOG_LEVEL: "info" };
  delete env.NODE_TEST_CONTEXT;
  const source = `
    import assert from "node:assert/strict";
    import express from "express";
    import { requestLogging, context, enrichContext } from "./dist/gameplay/platform/logging.js";
    const app = express();
    app.use(requestLogging());
    app.use(express.json());
    app.post("/rooms/:code", async (_req, res) => {
      await new Promise((resolve) => setImmediate(resolve));
      enrichContext({ accountId: "00000000-0000-4000-8000-000000000001" });
      res.json({ requestId: context().requestId });
    });
    app.get("/assets/:key", (_req, res) => res.sendStatus(404));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
      const response = await fetch(base + "/rooms/654321?url=private-signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d21", Authorization: "Bearer private-bearer", "X-Guest-Proof": "private-guest", "X-Control-Secret": "private-controller" },
        body: JSON.stringify({ credential: "private-preview", passcode: "private-passcode", phone: "+201234567890", url: "private-signed-url" }),
      });
      assert.equal(response.headers.get("x-request-id"), "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d21");
      assert.equal((await response.json()).requestId, "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d21");
      const rejected = await fetch(base + "/assets/private-key?signature=private-signature", { headers: { "X-Request-Id": "unsafe/token" } });
      assert.match(rejected.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
      await rejected.text();
    } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", source], { env, timeout: 30000 });
  for (const privateValue of ["654321", "private-signed-url", "private-bearer", "private-guest", "private-controller", "private-preview", "private-passcode", "+201234567890", "private-key", "private-signature"]) {
    assert.equal(stdout.includes(privateValue), false, privateValue);
  }
  const records = stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.length, 2);
  assert.equal(records[0].requestId, "0b7d2f8e-6c1a-4f3e-9d2b-5a8c7e6f1d21");
  assert.equal(records[0].route, "/rooms/:code");
  assert.equal(records[0].accountId, "00000000-0000-4000-8000-000000000001");
  assert.equal(records[1].route, "/assets/:key");
  assert.equal(records[1].status, 404);
  assert.ok(records.every((record) => record.scope && typeof record.durationMs === "number"));
});
