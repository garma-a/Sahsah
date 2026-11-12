import assert from "node:assert/strict";
import { test } from "node:test";
import { slotPoints, defaultPointStages, validPointStages } from "../dist/gameplay/games/rules/points.js";
import { scoreChange, questionAward } from "../dist/gameplay/games/rules/scoring.js";
import { orderSeats } from "../dist/gameplay/games/rules/turn-order.js";
import { isPosition, isPointStage } from "../dist/gameplay/games/rules/positions.js";

test("slot points and stage suggestions preserve all six board values", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(slotPoints), [200, 200, 400, 400, 600, 600]);
  for (const cap of [200, 400, 600]) {
    const stages = defaultPointStages(cap);
    assert.equal(stages.length, 3);
    assert.equal(validPointStages(stages, cap), true);
    assert.equal(validPointStages([cap, cap, 50], cap), false);
    assert.equal(validPointStages([cap - 1, 100, 50], cap), false);
  }
});
test("question awards and score deltas retain exact integer arithmetic", () => {
  assert.equal(questionAward(null, undefined, 400), 0);
  assert.equal(questionAward(1, undefined, 150), 150);
  assert.equal(questionAward(2, 0, 400), 0);
  assert.equal(questionAward(1, 600, 200), 600);
  assert.deepEqual(scoreChange(9223372036854775806n, 9223372036854775807n), { before: 9223372036854775806n, after: 9223372036854775807n, delta: 1n });
  assert.equal(scoreChange(100n, 0n).delta, -100n);
});
test("the host leads seat order without mutating the roster", () => {
  const roster = [{ id: "z", accountId: null }, { id: "a", accountId: "viewer" }, { id: "m", accountId: "host" }];
  assert.deepEqual(orderSeats(roster, "host").map((m) => m.id), ["m", "a", "z"]);
  assert.deepEqual(roster.map((m) => m.id), ["z", "a", "m"]);
});
test("positions and point stages enforce their integer ranges", () => {
  for (const value of [1, 2, 3, 4, 5, 6]) assert.equal(isPosition(value), true);
  for (const value of [0, 7, 1.5, NaN]) assert.equal(isPosition(value), false);
  for (const value of [0, 1, 2]) assert.equal(isPointStage(value), true);
  for (const value of [-1, 3, 0.5, NaN]) assert.equal(isPointStage(value), false);
});
