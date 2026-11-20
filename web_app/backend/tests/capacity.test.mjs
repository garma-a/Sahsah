import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityCeiling, MEMBERS_PER_ROOM } from "../dist/gameplay/platform/capacity.js";
import { Admission } from "../dist/gameplay/platform/admission.js";
import { GameplayScheduler } from "../dist/gameplay/platform/scheduler.js";

const GB = 2 ** 30;
const rooms = (env, cpuCores, memoryGb) =>
  capacityCeiling(env, { cpuCores, memoryBytes: memoryGb * GB }).ceiling.rooms;

test("the ceiling follows the container's resources, so a bigger plan admits more rooms", () => {
  const small = rooms({}, 0.5, 0.5),
    medium = rooms({}, 1, 1),
    large = rooms({}, 2, 4);
  assert.ok(small < medium && medium < large, `${small} < ${medium} < ${large}`);
  const { ceiling, basis } = capacityCeiling({}, { cpuCores: 1, memoryBytes: GB });
  assert.equal(basis, "resources");
  assert.deepEqual(ceiling, { rooms: ceiling.rooms, members: ceiling.rooms * MEMBERS_PER_ROOM, games: ceiling.rooms });
});

test("one Node process stops scaling with CPU past its useful cores; memory still counts", () => {
  assert.equal(rooms({}, 2, 64), rooms({}, 32, 64));
  assert.ok(rooms({}, 2, 0.5) < rooms({}, 2, 1));
});

test("operators tune the per-resource rates from a load test", () => {
  const env = { GAMEPLAY_CAPACITY_ROOMS_PER_CPU: "10", GAMEPLAY_CAPACITY_ROOMS_PER_GB: "1000" };
  assert.equal(rooms(env, 1, 8), 10);
  assert.equal(rooms({ ...env, GAMEPLAY_CAPACITY_ROOMS_PER_GB: "6" }, 1, 1), 6);
});

test("a measured envelope is used exactly, and a partial or invalid one fails startup", () => {
  const measured = { GAMEPLAY_CAPACITY_ROOMS: "120", GAMEPLAY_CAPACITY_MEMBERS: "700", GAMEPLAY_CAPACITY_GAMES: "110" };
  assert.deepEqual(capacityCeiling(measured, { cpuCores: 0.1, memoryBytes: GB / 8 }), {
    ceiling: { rooms: 120, members: 700, games: 110 },
    basis: "measured",
  });
  assert.throws(() => rooms({ GAMEPLAY_CAPACITY_ROOMS: "120" }, 1, 1), /INVALID_CAPACITY_PROFILE/);
  assert.throws(() => rooms({ GAMEPLAY_CAPACITY_ROOMS_PER_CPU: "lots" }, 1, 1), /INVALID_CAPACITY_PROFILE/);
});

test("tiny or huge containers stay within sane bounds", () => {
  assert.equal(rooms({}, 0.01, 0.01), 4);
  assert.equal(rooms({ GAMEPLAY_CAPACITY_ROOMS_PER_CPU: "100000" , GAMEPLAY_CAPACITY_ROOMS_PER_GB: "100000" }, 2, 64), 2000);
});

test("admission takes a new ceiling at runtime and sizes the socket limit from it", () => {
  const admission = new Admission();
  assert.equal(admission.configure({ rooms: 10, members: 60, games: 10 }), true);
  assert.equal(admission.configure({ rooms: 10, members: 60, games: 10 }), false);
  assert.equal(admission.socketLimit(), 120);
  assert.equal(admission.configure({ rooms: 40, members: 240, games: 40 }), true);
  assert.deepEqual(admission.limits(), { rooms: 40, members: 240, games: 40 });
  assert.equal(admission.socketLimit(), 480);
});

test("database-slot saturation reports how long every slot was busy", async () => {
  const scheduler = new GameplayScheduler(3); // two work slots
  scheduler.saturation();
  const hold = () => new Promise((resolve) => setTimeout(resolve, 120));
  await Promise.all([scheduler.run("protected", hold), scheduler.run("protected", hold)]);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const busy = scheduler.saturation();
  assert.ok(busy > 0.3 && busy < 0.7, `about half the interval was saturated, got ${busy}`);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(scheduler.saturation(), 0);
});
