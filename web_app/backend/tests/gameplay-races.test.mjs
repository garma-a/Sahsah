import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { gameplayFixture, secret } from "./gameplay/fixture.mjs";
import { GameplayService } from "../dist/gameplay/service.js";
import { createApplication } from "../dist/application.js";

test(
  "slow unverified new callers do not consume the active game's reserved work",
  { timeout: 180000 },
  async (t) => {
    let release = () => {},
      notify;
    const held = new Promise((r) => {
        release = r;
      }),
      twoStarted = new Promise((r) => {
        notify = r;
      });
    let started = 0;
    const f = await gameplayFixture(t, {
        verifyUnknown: async () => {
          if (++started === 2) notify();
          await held;
        },
      }),
      room = await f.create(),
      headers = { control: room.control };
    const game = await f.call(
      "POST",
      `/rooms/${room.roomId}/games`,
      {
        expectedRoomVersion: room.roomVersion,
        expectedReadyGeneration: room.readyGeneration,
      },
      headers,
    );
    assert.equal(game.status, 201, JSON.stringify(game.body));
    const slow = [];
    try {
      for (let i = 0; i < 2; i++)
        slow.push(
          f.call(
            "POST",
            "/rooms",
            { ...room.body, proposedControlSecret: secret() },
            { authorization: `Bearer unverified-${i}` },
          ),
        );
      await twoStarted;
      for (let i = 2; i < 4; i++)
        slow.push(
          f.call(
            "POST",
            "/rooms",
            { ...room.body, proposedControlSecret: secret() },
            { authorization: `Bearer unverified-${i}` },
          ),
        );
      await new Promise((r) => setTimeout(r, 50));
      const end = await f.call(
        "POST",
        `/games/${game.body.gameId}/commands`,
        { name: "end_game", expectedGameVersion: "0" },
        headers,
      );
      assert.equal(end.status, 200, JSON.stringify(end.body));
      assert.equal(started, 2, "new verification exceeded its ordinary share");
    } finally {
      release();
      await Promise.all(slow);
    }
  },
);

test(
  "gameplay admission, source recovery and row locks serialize competing intents",
  { timeout: 180000 },
  async (t) => {
    const f = await gameplayFixture(t, { tokens: 1 });
    const { call, owner } = f;
    await assert.rejects(
      createApplication({ gameplay: { enabled: true } }),
      /GAMEPLAY_PROCESS_ALREADY_ACTIVE/,
    );
    const bodies = [secret(), secret()].map((proposedControlSecret) => ({
      teamOneName: "A",
      teamTwoName: "B",
      hostTeamNumber: null,
      selections: f.selections,
      proposedControlSecret,
    }));
    const creates = await Promise.all(
      bodies.map((b) => call("POST", "/rooms", b)),
    );
    assert.deepEqual(creates.map((r) => r.status).sort(), [201, 409]);
    const accepted = creates.findIndex((r) => r.status === 201),
      room = creates[accepted].body,
      control = bodies[accepted].proposedControlSecret;
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM rooms WHERE owner_account_id=$1 AND closed_at IS NULL",
          [f.accounts[0]],
        )
      ).rows[0].n,
      1,
    );
    const invitation = await call(
      "GET",
      `/rooms/${room.roomId}/invitation`,
      undefined,
      { control },
    );
    const guests = [];
    const join = async (i) => {
      const reconnectSecret = secret(),
        body = {
          identity: "anonymous",
          displayName: `Guest ${i}`,
          teamNumber: (i % 2) + 1,
          reconnectSecret,
        };
      const r = await call(
        "POST",
        `/room-invitations/${invitation.body.code}/memberships`,
        body,
        { authorization: "" },
      );
      return {
        ...r,
        authorization:
          r.status === 201
            ? `Bearer g.${r.body.membershipId}.${reconnectSecret}`
            : undefined,
      };
    };
    for (let i = 0; i < 4; i++) {
      const r = await join(i);
      assert.equal(r.status, 201, JSON.stringify(r.body));
      guests.push(r);
    }
    const seats = await Promise.all([join(4), join(5)]);
    assert.deepEqual(seats.map((r) => r.status).sort(), [201, 409]);
    guests.push(seats.find((r) => r.status === 201));
    const snapshot = await call("GET", `/rooms/${room.roomId}`, undefined, {
      control,
    });
    const ready = await Promise.all(
      guests.map((g) =>
        call(
          "PUT",
          `/rooms/${room.roomId}/memberships/me/readiness`,
          {
            expectedMembershipVersion: "0",
            expectedReadyGeneration: snapshot.body.view.readyGeneration,
            ready: true,
          },
          { authorization: g.authorization },
        ),
      ),
    );
    assert.ok(
      ready.every((r) => r.status === 200),
      JSON.stringify(ready),
    );
    const confirmed = await call("GET", `/rooms/${room.roomId}`, undefined, {
      control,
    });
    const startBody = {
      expectedRoomVersion: confirmed.body.source.roomVersion,
      expectedReadyGeneration: confirmed.body.view.readyGeneration,
    };
    const starts = await Promise.all([
      call("POST", `/rooms/${room.roomId}/games`, startBody, { control }),
      call("POST", `/rooms/${room.roomId}/games`, startBody, { control }),
    ]);
    assert.equal(
      starts.filter((r) => r.status === 201).length,
      1,
      JSON.stringify(starts),
    );
    const started = starts.find((r) => r.status === 201).body,
      gameId = started.gameId;
    assert.equal(
      (
        await owner.query("SELECT token_balance FROM accounts WHERE id=$1", [
          f.accounts[0],
        ])
      ).rows[0].token_balance,
      0,
    );
    const tile = { boardPosition: 1, questionPosition: 1 };
    let r = await call(
      "POST",
      `/games/${gameId}/commands`,
      { name: "open_question", expectedGameVersion: "0", ...tile },
      { control },
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    r = await call(
      "POST",
      `/games/${gameId}/commands`,
      {
        name: "reveal_answer",
        expectedGameVersion: r.body.gameVersion,
        ...tile,
      },
      { control },
    );
    assert.equal(r.status, 200);
    const resolve = {
      name: "resolve_question",
      expectedGameVersion: r.body.gameVersion,
      ...tile,
      winningTeamNumber: 1,
    };
    const resolutions = await Promise.all([
      call("POST", `/games/${gameId}/commands`, resolve, { control }),
      call("POST", `/games/${gameId}/commands`, resolve, { control }),
    ]);
    assert.deepEqual(resolutions.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await owner.query(
          "SELECT team_one_score::text AS score FROM games WHERE id=$1",
          [gameId],
        )
      ).rows[0].score,
      "200",
    );
    const core = f.app.get(GameplayService);
    f.setPressure(0.9);
    core.admission.update({ api: 0.9, database: 0.1, sampledAt: Date.now() });
    assert.equal(
      (await call("GET", "/gameplay/availability")).body.admission,
      "paused",
    );
    const denied = await call(
      "POST",
      "/rooms",
      {
        teamOneName: "A",
        teamTwoName: "B",
        hostTeamNumber: null,
        selections: f.selections,
        proposedControlSecret: secret(),
      },
      { account: 1 },
    );
    assert.equal(denied.status, 503);
    assert.equal(denied.body.code, "SERVER_AT_CAPACITY");
    const result = await call("GET", `/games/${gameId}`, undefined, {
      control,
    });
    const ended = await call(
      "POST",
      `/games/${gameId}/commands`,
      { name: "end_game", expectedGameVersion: result.body.source.gameVersion },
      { control },
    );
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM token_ledger_entries WHERE game_id=$1 AND entry_kind='game_restoration'",
          [gameId],
        )
      ).rows[0].n,
      0,
    );
    const historical = await call("GET", `/games/${gameId}/result`, undefined, {
      authorization: guests[0].authorization,
    });
    assert.equal(historical.status, 200);
    // The same immutable create source is recoverable at the admission cutoff.
    const source = await owner.query(
      "SELECT create_request_id FROM rooms WHERE id=$1",
      [room.roomId],
    );
    const recovered = await call("POST", "/rooms", bodies[accepted], {
      operationId: source.rows[0].create_request_id,
    });
    assert.equal(recovered.status, 201);
    assert.equal(recovered.body.roomId, room.roomId);
    const runtime = await f.pg.connect("sahsah_app", "sahsah_gameplay_races");
    t.after(() => runtime.end());
    for (const statement of [
      "UPDATE game_actions SET score_delta=999",
      "UPDATE room_actions SET operation_name='changed'",
      "UPDATE game_packs SET pack_number=99",
      "UPDATE game_question_media SET variant_number=2",
    ]) {
      await assert.rejects(runtime.query(statement), (e) => e.code === "42501");
    }
    await assert.rejects(
      runtime.query(
        "UPDATE game_players SET team_number=2 WHERE game_id=$1 AND seat_number=1",
        [gameId],
      ),
      /frozen player identity/,
    );
    await assert.rejects(
      runtime.query(
        "DELETE FROM game_actions WHERE game_id=$1 AND score_entry_kind IS NOT NULL",
        [gameId],
      ),
      /score history is retained/,
    );
  },
);
