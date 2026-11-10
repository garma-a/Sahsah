import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { gameplayFixture, secret } from "./gameplay/fixture.mjs";
import { proof } from "../dist/gameplay/proof.js";

test(
  "binding preserves anonymous history; unopened replay restores its debit; overdue cleanup preserves effective time",
  { timeout: 180000 },
  async (t) => {
    const f = await gameplayFixture(t),
      { call, owner } = f,
      room = await f.create();
    const headers = { control: room.control };
    const invitation = await call(
        "GET",
        `/rooms/${room.roomId}/invitation`,
        undefined,
        headers,
      ),
      credential = secret();
    const joined = await call(
      "POST",
      `/room-invitations/${invitation.body.code}/memberships`,
      {
        identity: "anonymous",
        displayName: "Guest",
        teamNumber: 1,
        reconnectSecret: credential,
      },
      { authorization: "" },
    );
    assert.equal(joined.status, 201);
    const guestProof = `Bearer g.${joined.body.membershipId}.${credential}`;
    const ready = await call(
      "PUT",
      `/rooms/${room.roomId}/memberships/me/readiness`,
      {
        expectedMembershipVersion: "0",
        expectedReadyGeneration: joined.body.readyGeneration,
        ready: true,
      },
      { authorization: guestProof },
    );
    assert.equal(ready.status, 200);
    const game = await call(
      "POST",
      `/rooms/${room.roomId}/games`,
      {
        expectedRoomVersion: ready.body.roomVersion,
        expectedReadyGeneration: ready.body.readyGeneration,
      },
      headers,
    );
    assert.equal(game.status, 201, JSON.stringify(game.body));
    const opened = await call(
      "POST",
      `/games/${game.body.gameId}/commands`,
      {
        name: "open_question",
        expectedGameVersion: "0",
        boardPosition: 1,
        questionPosition: 1,
      },
      headers,
    );
    assert.equal(opened.status, 200);
    const ended = await call(
      "POST",
      `/games/${game.body.gameId}/commands`,
      { name: "end_game", expectedGameVersion: opened.body.gameVersion },
      headers,
    );
    assert.equal(ended.status, 200);
    const state = await call(
      "GET",
      `/rooms/${room.roomId}`,
      undefined,
      headers,
    );
    const replay = await call(
      "POST",
      `/rooms/${room.roomId}/lobby`,
      { expectedRoomVersion: state.body.source.roomVersion },
      headers,
    );
    assert.equal(replay.status, 200);
    const before = await call("GET", `/rooms/${room.roomId}`, undefined, {
      authorization: guestProof,
    });
    const member = before.body.view.members.find(
      (m) => m.id === joined.body.membershipId,
    );
    const bindingId = randomUUID(),
      body = {
        expectedMembershipVersion: member.memberVersion,
        expectedReadyGeneration: before.body.view.readyGeneration,
      };
    const binding = await call(
      "POST",
      `/rooms/${room.roomId}/memberships/me/account-binding`,
      body,
      { account: 1, guestProof, operationId: bindingId },
    );
    assert.equal(binding.status, 200, JSON.stringify(binding.body));
    assert.equal(
      (
        await call(
          "POST",
          `/rooms/${room.roomId}/memberships/me/account-binding`,
          body,
          { account: 1, guestProof, operationId: bindingId },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call("GET", `/rooms/${room.roomId}`, undefined, {
          authorization: guestProof,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("GET", `/games/${game.body.gameId}/result`, undefined, {
          authorization: guestProof,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("GET", `/games/${game.body.gameId}/result`, undefined, {
          account: 1,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM account_question_exposures WHERE account_id=$1",
          [f.accounts[1]],
        )
      ).rows[0].n,
      0,
    );
    const selections = [];
    for (const selection of f.selections) {
      const page = await call(
        "GET",
        `/categories/${selection.categoryId}/packs?roomId=${room.roomId}&freshOnly=false`,
        undefined,
        headers,
      );
      assert.equal(page.status, 200, JSON.stringify(page.body));
      const p = page.body.items[0];
      selections.push({
        ...selection,
        ...(p.repeatRequired ? { repeatConsentBasis: p.eligibilityBasis } : {}),
      });
    }
    const setup = await call(
      "PUT",
      `/rooms/${room.roomId}/setup`,
      {
        expectedRoomVersion: binding.body.roomVersion,
        teamOneName: "A",
        teamTwoName: "B",
        hostTeamNumber: null,
        selections,
      },
      headers,
    );
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    const signed = await call("GET", `/rooms/${room.roomId}`, undefined, {
      account: 1,
    });
    const signedMember = signed.body.view.members.find(
      (m) => m.id === joined.body.membershipId,
    );
    const signedReady = await call(
      "PUT",
      `/rooms/${room.roomId}/memberships/me/readiness`,
      {
        expectedMembershipVersion: signedMember.memberVersion,
        expectedReadyGeneration: signed.body.view.readyGeneration,
        ready: true,
      },
      { account: 1 },
    );
    assert.equal(signedReady.status, 200);
    const second = await call(
      "POST",
      `/rooms/${room.roomId}/games`,
      {
        expectedRoomVersion: signedReady.body.roomVersion,
        expectedReadyGeneration: signedReady.body.readyGeneration,
      },
      headers,
    );
    assert.equal(second.status, 201, JSON.stringify(second.body));
    const endId = randomUUID(),
      endBody = { name: "end_game", expectedGameVersion: "0" };
    const unopened = await call(
      "POST",
      `/games/${second.body.gameId}/commands`,
      endBody,
      { ...headers, operationId: endId },
    );
    assert.equal(unopened.status, 200);
    assert.equal(
      (
        await call("POST", `/games/${second.body.gameId}/commands`, endBody, {
          ...headers,
          operationId: endId,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM token_ledger_entries WHERE game_id=$1 AND entry_kind='game_restoration'",
          [second.body.gameId],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await call("GET", `/games/${second.body.gameId}/result`, undefined, {
          authorization: guestProof,
        })
      ).status,
      403,
    );

    // Historical fixture is inserted at its original time, with every normal DB
    // guard enabled. No clock stubs or disabled triggers are used.
    const oldRoom = randomUUID(),
      oldMember = randomUUID(),
      oldGame = randomUUID(),
      oldControl = secret(),
      oldStart = randomUUID();
    await owner.query("BEGIN");
    try {
      await owner.query(
        "INSERT INTO rooms(id,owner_account_id,team_one_name,team_two_name,created_at,last_lobby_activity_at,lobby_idle_expires_at,controller_credential_hash,controller_acquired_at) VALUES($1,$2,'A','B',now()-interval '400 days',now()-interval '400 days',now()-interval '399 days',$3,now()-interval '400 days')",
        [oldRoom, f.accounts[2], proof("room-control", oldRoom, oldControl)],
      );
      await owner.query(
        "INSERT INTO room_memberships(id,room_id,account_id,display_name,joined_at) VALUES($1,$2,$3,'Historical host',now()-interval '400 days')",
        [oldMember, oldRoom, f.accounts[2]],
      );
      await owner.query(
        "INSERT INTO games(id,room_id,sequence_number,start_request_id,start_request_digest,started_at,last_gameplay_at,idle_expires_at,host_account_id,team_one_name,team_two_name,controller_credential_hash,controller_acquired_at) VALUES($1,$2,1,$3,sha256($3::uuid::text::bytea),now()-interval '400 days',now()-interval '400 days',now()-interval '399 days',$4,'A','B',$5,now()-interval '400 days')",
        [
          oldGame,
          oldRoom,
          oldStart,
          f.accounts[2],
          proof("game-control", oldGame, oldControl),
        ],
      );
      await owner.query(
        "INSERT INTO game_players(game_id,room_id,room_member_id,seat_number,account_id,display_name,joined_at) VALUES($1,$2,$3,1,$4,'Historical host',now()-interval '400 days')",
        [oldGame, oldRoom, oldMember, f.accounts[2]],
      );
      await owner.query(
        "INSERT INTO game_packs(game_id,category_id,pack_id,board_position,pack_number,source_content_revision,category_name_ar) SELECT $1,category_id,pack_id,board_position,pack_number,source_content_revision,category_name_ar FROM game_packs WHERE game_id=$2",
        [oldGame, game.body.gameId],
      );
      await owner.query(
        "INSERT INTO game_questions(game_id,board_position,question_position,source_question_id,base_points,format,content_snapshot) SELECT $1,board_position,question_position,source_question_id,base_points,format,content_snapshot FROM game_questions WHERE game_id=$2",
        [oldGame, game.body.gameId],
      );
      await owner.query(
        "UPDATE accounts SET active_game_id=$1,active_game_claimed_at=now()-interval '400 days' WHERE id=$2",
        [oldGame, f.accounts[2]],
      );
      await owner.query(
        "INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,game_id,created_at) VALUES($1,$2,'game_debit',-1,$3,$4,now()-interval '400 days')",
        [randomUUID(), f.accounts[2], randomUUID(), oldGame],
      );
      await owner.query(
        "UPDATE rooms SET current_game_id=$1,presentation_mode='game' WHERE id=$2",
        [oldGame, oldRoom],
      );
      await owner.query("COMMIT");
    } catch (e) {
      await owner.query("ROLLBACK");
      throw e;
    }
    const historical = await call(
      "GET",
      `/games/${oldGame}/result`,
      undefined,
      { account: 2, control: oldControl },
    );
    assert.equal(historical.status, 200, JSON.stringify(historical.body));
    assert.equal(historical.body.endReason, "idle_timeout");
    const times = (
      await owner.query(
        "SELECT ended_at=idle_expires_at AS exact,content_purge_after<now() AS due FROM games WHERE id=$1",
        [oldGame],
      )
    ).rows[0];
    assert.equal(times.exact, true);
    assert.equal(times.due, true);
    const deadline = Date.now() + 5000;
    while (
      !(
        await owner.query(
          "SELECT content_purged_at IS NOT NULL AS purged FROM games WHERE id=$1",
          [oldGame],
        )
      ).rows[0].purged
    ) {
      assert.ok(Date.now() < deadline, "Due purge did not complete");
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(
      (await call("GET", `/games/${oldGame}/result`, undefined, { account: 2 }))
        .status,
      200,
    );
    assert.equal(
      (
        await call(
          "PUT",
          `/games/${oldGame}/questions/1/1/feedback`,
          { expectedFeedbackVersion: "0", vote: "like" },
          { account: 2 },
        )
      ).status,
      410,
    );
    assert.equal(
      (
        await owner.query("SELECT token_balance FROM accounts WHERE id=$1", [
          f.accounts[2],
        ])
      ).rows[0].token_balance,
      3,
    );
  },
);
