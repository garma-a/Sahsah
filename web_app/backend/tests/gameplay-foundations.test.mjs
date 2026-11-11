import assert from "node:assert/strict";
import { test } from "node:test";
import { Writable } from "node:stream";
import { pino } from "pino";
import { context, errorStack, logLevel, loggerOptions, requestId, withContext, enrichContext } from "../dist/gameplay/logging.js";

test("request IDs accept bounded tokens and replace unsafe values", () => {
  assert.equal(requestId("request-42.a_b"), "request-42.a_b");
  for (const value of [undefined, ["one", "two"], "", "x".repeat(65), "a\nb", "a/b"]) {
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
});


test("invariants assert impossible states and exact single-row results", async () => {
  const { invariant, single } = await import("../dist/gameplay/invariant.js");
  invariant(true, "VALID_STATE");
  assert.equal(single([42], "ONE_ROW"), 42);
  for (const check of [() => invariant(false, "IMPOSSIBLE"), () => single([], "MISSING"), () => single([1, 2], "EXTRA")]) {
    assert.throws(check, (error) => error.status === 500 && error.code === "INTERNAL_INVARIANT");
  }
});


test("state helpers reject impossible scores, positions and version transitions", async () => {
  const { stateInvariants, versionIncrement, written, writtenAtMost } = await import("../dist/gameplay/invariant.js");
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
