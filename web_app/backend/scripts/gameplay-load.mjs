import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { WebSocket } from "ws";
import { gameplayFixture, secret } from "../tests/gameplay/fixture.mjs";
import { GameplayService } from "../dist/gameplay/service.js";

// Disposable local smoke measurement. It never contacts production or certifies
// a Railway quota. Staging acceptance uses the separate declared profile/runbook.
const rooms = Number(process.env.LOAD_ROOMS ?? 10),
  cycles = Number(process.env.LOAD_CYCLES ?? 2);
assert.ok(Number.isInteger(rooms) && rooms >= 1 && rooms <= 100);
assert.ok(Number.isInteger(cycles) && cycles >= 1 && cycles <= 6);
const cleanup = [];
const sockets = [];
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.ceil((values.length * p) / 100) - 1)
  ] ?? 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const f = await gameplayFixture(
    { after: (fn) => cleanup.push(fn) },
    { hosts: rooms },
  );
  const games = [];
  const connect = async (room, authorization, controllerSecret) => {
    const ws = new WebSocket(f.base.replace("http", "ws") + "/realtime", {
      origin: "http://localhost:3000",
    });
    sockets.push(ws);
    const state = { ws, value: undefined, at: 0, error: undefined };
    ws.on("error", (e) => {
      state.error = e;
    });
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.event === "state") {
        state.value = m.data;
        state.at = performance.now();
      }
      if (
        ["protocol_error", "membership_revoked", "control_revoked"].includes(
          m.event,
        )
      )
        state.error = Error(m.data.code);
    });
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    ws.send(
      JSON.stringify({
        event: "authenticate",
        data: {
          protocolVersion: 1,
          roomId: room.roomId,
          language: "ar",
          authorization,
          ...(controllerSecret ? { controllerSecret } : {}),
        },
      }),
    );
    const deadline = Date.now() + 10000;
    while (!state.value) {
      if (state.error) throw state.error;
      assert.ok(Date.now() < deadline, "Initial state timed out");
      await sleep(5);
    }
    return state;
  };
  for (let account = 0; account < rooms; account++) {
    const room = await f.create(account),
      headers = { account, control: room.control };
    const invitation = await f.call(
        "GET",
        `/rooms/${room.roomId}/invitation`,
        undefined,
        headers,
      ),
      guests = [];
    let roomVersion = room.roomVersion,
      readyGeneration = room.readyGeneration;
    for (let n = 0; n < 5; n++) {
      const credential = secret(),
        joined = await f.call(
          "POST",
          `/room-invitations/${invitation.body.code}/memberships`,
          {
            identity: "anonymous",
            displayName: `Player ${n}`,
            teamNumber: (n % 2) + 1,
            reconnectSecret: credential,
          },
          { authorization: "" },
        );
      assert.equal(joined.status, 201, JSON.stringify(joined.body));
      roomVersion = joined.body.roomVersion;
      readyGeneration = joined.body.readyGeneration;
      guests.push({
        authorization: `Bearer g.${joined.body.membershipId}.${credential}`,
        membershipId: joined.body.membershipId,
      });
    }
    for (const guest of guests) {
      const r = await f.call(
        "PUT",
        `/rooms/${room.roomId}/memberships/me/readiness`,
        {
          expectedMembershipVersion: "0",
          expectedReadyGeneration: readyGeneration,
          ready: true,
        },
        { authorization: guest.authorization },
      );
      assert.equal(r.status, 200);
      roomVersion = r.body.roomVersion;
    }
    const started = await f.call(
      "POST",
      `/rooms/${room.roomId}/games`,
      {
        expectedRoomVersion: roomVersion,
        expectedReadyGeneration: readyGeneration,
      },
      headers,
    );
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const streams = [await connect(room, `Bearer a${account}`, room.control)];
    for (const guest of guests)
      streams.push(await connect(room, guest.authorization));
    games.push({
      room,
      headers,
      id: started.body.gameId,
      version: started.body.gameVersion,
      streams,
    });
  }
  const latency = [],
    visible = [];
  const measurementStart = performance.now();
  let accepted = 0;
  const execute = async (game, name, fields = {}) => {
    const sent = performance.now(),
      r = await f.call(
        "POST",
        `/games/${game.id}/commands`,
        { name, expectedGameVersion: game.version, ...fields },
        game.headers,
      );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    game.version = r.body.gameVersion;
    latency.push(r.elapsedMs);
    accepted++;
    const deadline = Date.now() + 10000;
    while (
      game.streams.some(
        (c) =>
          !c.value?.source?.gameVersion ||
          BigInt(c.value.source.gameVersion) < BigInt(game.version),
      )
    ) {
      for (const c of game.streams) if (c.error) throw c.error;
      assert.ok(Date.now() < deadline, "Visible state timed out");
      await sleep(5);
    }
    visible.push(Math.max(...game.streams.map((c) => c.at)) - sent);
  };
  for (let cycle = 1; cycle <= cycles; cycle++) {
    // A declared simultaneous-room burst, in addition to sequential setup.
    for (const name of ["open_question", "reveal_answer", "resolve_question"]) {
      await Promise.all(
        games.map((game) =>
          execute(game, name, {
            boardPosition: 1,
            questionPosition: cycle,
            ...(name === "resolve_question"
              ? { winningTeamNumber: (cycle % 2) + 1 }
              : {}),
          }),
        ),
      );
    }
  }
  await Promise.all(games.map((game) => execute(game, "end_game")));
  const report = {
    kind: "local-smoke-not-railway-certification",
    timestamp: new Date().toISOString(),
    runtime: process.version,
    postgres: "18 disposable",
    profile: {
      rooms,
      players: rooms * 6,
      cycles,
      content: "STANDARD text only; no media transfer",
      network: "localhost",
      pressure: "injected healthy fixture; not container quota telemetry",
      warmupSeconds: 0,
      steadyState:
        "bounded command bursts, not the required 15-minute acceptance run",
    },
    acceptedCommands: accepted,
    durationSeconds: (performance.now() - measurementStart) / 1000,
    p95HttpMs: percentile(latency, 95),
    p99HttpMs: percentile(latency, 99),
    p95VisibleMs: percentile(visible, 95),
    p99VisibleMs: percentile(visible, 99),
    measurements: f.app.get(GameplayService).metrics.snapshot(),
    railwayAcceptance: "not run",
  };
  await writeFile(
    process.env.LOAD_REPORT ?? "/tmp/sahsah-gameplay-load.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  for (const ws of sockets) ws.terminate();
  for (const fn of cleanup) await fn();
}
