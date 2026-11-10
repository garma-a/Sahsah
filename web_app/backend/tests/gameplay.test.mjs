import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { createApplication } from "../dist/application.js";
import { cluster } from "./database/cluster.mjs";
import { WebSocket } from "ws";

process.env.NODE_ENV = "test";
process.env.ADMIN_ENABLED = "false";
const secret = () => randomBytes(32).toString("base64url");

test(
  "gameplay HTTP transactions and participant recovery",
  { timeout: 180000 },
  async (t) => {
    const cleanup = [];
    let app;
    const pg = await cluster({ after: (fn) => cleanup.push(fn) });
    const owner = await pg.database("sahsah_gameplay");
    t.after(async () => {
      await app?.close();
      await owner.end();
      for (const fn of cleanup) await fn();
    });
    const host = randomUUID();
    const staff = randomUUID();
    const audit = randomUUID();
    await owner.query(
      "INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES($1,'Host','+201222330001',now())",
      [host],
    );
    await owner.query(
      "INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin','gameplay@example.invalid','fixture')",
      [staff],
    );
    await owner.query(
      "INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'token_grant','account',$3,$4,'HTTP fixture')",
      [audit, staff, host, randomUUID()],
    );
    await owner.query(
      "INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text) VALUES($1,$2,'credit',3,$3,$4,'HTTP fixture')",
      [randomUUID(), host, randomUUID(), audit],
    );
    const selections = [];
    const formats = [
      "STANDARD",
      "IMAGE_BLUR",
      "IMAGE_ZOOM",
      "IMAGE_MEMORY",
      "AUDIO_REVERSE",
      "AUDIO_GUESS",
      "IMAGE_PERSON",
      "IMAGE_COLOR",
      "IMAGE_RIDDLE",
      "AUDIO_VOICE",
    ];
    const addAsset = async (kind, source = null, transform = {}) => {
      const asset = randomUUID();
      await owner.query(
        "INSERT INTO media_assets(id,media_kind,state,storage_provider,storage_namespace,storage_key,content_type,byte_size,width_px,height_px,duration_ms,uploaded_by_staff_id,ready_at,source_asset_id,transform_spec) VALUES($1,$2,'ready','r2','gameplay',$1::uuid::text,$3,1024,$4,$4,$5,$6,now(),$7,$8)",
        [
          asset,
          kind,
          kind === "image" ? "image/webp" : "audio/mpeg",
          kind === "image" ? 640 : null,
          kind === "audio" ? 12000 : null,
          staff,
          source,
          transform,
        ],
      );
      return asset;
    };
    for (let i = 1; i <= 6; i++) {
      const category = randomUUID(),
        pack = randomUUID();
      await owner.query(
        "INSERT INTO categories(id,name_ar,display_order) VALUES($1,$2,$3)",
        [category, `Category ${i}`, i],
      );
      await owner.query(
        "INSERT INTO question_packs(id,category_id,pack_number,publication_state) VALUES($1,$2,1,'published')",
        [pack, category],
      );
      for (let slot = 1; slot <= 6; slot++) {
        const qid = randomUUID(),
          format = formats[(i - 1) * 6 + slot - 1] ?? "STANDARD";
        await owner.query(
          "INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar,format_config) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            qid,
            pack,
            slot,
            format,
            `Question ${i}/${slot}`,
            `Answer ${i}/${slot}`,
            format === "AUDIO_REVERSE"
              ? { allowForward: true }
              : format === "IMAGE_COLOR"
                ? { colorHex: "#123456" }
                : {},
          ],
        );
        const pin = (role, asset, variant = 0, suggested = null) =>
          owner.query(
            "INSERT INTO question_media(question_id,media_role,media_asset_id,variant_number,suggested_points) VALUES($1,$2,$3,$4,$5)",
            [qid, role, asset, variant, suggested],
          );
        if (format.startsWith("IMAGE_")) {
          const original = await addAsset("image");
          await pin("source_image", original);
          await pin("answer_image", original);
          if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(format)) {
            const cap = slot <= 2 ? 200 : slot <= 4 ? 400 : 600;
            const suggestions = {
              200: [200, 150, 50],
              400: [400, 250, 150],
              600: [600, 400, 200],
            }[cap];
            for (let stage = 0; stage < 3; stage++)
              await pin(
                "hint_image",
                await addAsset("image", original, {
                  operation: format === "IMAGE_BLUR" ? "blur" : "crop",
                  stageIndex: stage,
                }),
                stage,
                suggestions[stage],
              );
          } else
            await pin(
              "prompt_image",
              ["IMAGE_PERSON", "IMAGE_COLOR"].includes(format)
                ? await addAsset("image", original, {
                    operation: format === "IMAGE_COLOR" ? "grayscale" : "crop",
                  })
                : original,
            );
        }
        if (format.startsWith("AUDIO_")) {
          const original = await addAsset("audio");
          await pin("source_audio", original);
          await pin(
            "question_audio",
            format === "AUDIO_REVERSE"
              ? await addAsset("audio", original, { operation: "reverse" })
              : original,
          );
          if (format === "AUDIO_REVERSE") await pin("answer_audio", original);
        }
      }
      selections.push({
        boardPosition: i,
        categoryId: category,
        packId: pack,
        observedRevision: "1",
      });
    }
    process.env.DATABASE_URL = pg.url("sahsah_app", "sahsah_gameplay");
    app = await createApplication({
      gameplay: {
        enabled: true,
        verifyAccount: async (token) =>
          token === "host"
            ? { accountId: host, expiresAt: Date.now() + 3600000 }
            : undefined,
        pressure: async () => ({
          api: 0.1,
          database: 0.1,
          sampledAt: Date.now(),
        }),
        signMedia: async () => ({
          url: "https://media.example.invalid/object",
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        }),
      },
    });
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/api/v1`;
    let control = secret();
    let generation = "1";
    const call = async (method, path, body, options = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: options.authorization ?? "Bearer host",
          "Idempotency-Key": options.operationId ?? randomUUID(),
          "X-Control-Secret": options.controlSecret ?? control,
          "X-Controller-Generation": options.generation ?? generation,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const createId = randomUUID();
    const createBody = {
      teamOneName: "One",
      teamTwoName: "Two",
      hostTeamNumber: null,
      selections,
      proposedControlSecret: control,
    };
    const created = await call("POST", "/rooms", createBody, {
      operationId: createId,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(typeof created.body.roomId, "string");
    const repeated = await call("POST", "/rooms", createBody, {
      operationId: createId,
    });
    assert.equal(repeated.body.roomId, created.body.roomId);
    assert.equal(JSON.stringify(repeated.body).includes(control), false);
    const roomId = created.body.roomId;
    const connect = async (authorization, controllerSecret = control) => {
      const ws = new WebSocket(base.replace("http", "ws") + "/realtime", {
        origin: "http://localhost:3000",
      });
      const messages = [];
      ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
      await new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
      });
      ws.send(
        JSON.stringify({
          event: "authenticate",
          data: {
            protocolVersion: 1,
            roomId,
            language: "ar",
            authorization,
            ...(controllerSecret ? { controllerSecret } : {}),
          },
        }),
      );
      const until = async (predicate) => {
        const deadline = Date.now() + 5000;
        while (!messages.some(predicate)) {
          assert.ok(Date.now() < deadline, JSON.stringify(messages));
          await new Promise((r) => setTimeout(r, 10));
        }
        return messages.find(predicate);
      };
      return { ws, messages, until };
    };
    const hostStream = await connect("Bearer host");
    t.after(() => hostStream.ws.terminate());
    await hostStream.until((m) => m.event === "state");
    const invitation = await call("GET", `/rooms/${roomId}/invitation`);
    assert.equal(invitation.status, 200, JSON.stringify(invitation.body));
    assert.match(invitation.body.code, /^\d{6}$/);
    const guestSecret = secret(),
      joinId = randomUUID();
    const joinBody = {
      identity: "anonymous",
      displayName: "Guest",
      teamNumber: 1,
      reconnectSecret: guestSecret,
    };
    const joined = await call(
      "POST",
      `/room-invitations/${invitation.body.code}/memberships`,
      joinBody,
      { operationId: joinId, authorization: "" },
    );
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    const guestAuthorization = `Bearer g.${joined.body.membershipId}.${guestSecret}`;
    const guestStream = await connect(guestAuthorization, undefined);
    t.after(() => guestStream.ws.terminate());
    await guestStream.until((m) => m.event === "state");
    const replacement = await connect(guestAuthorization, undefined);
    t.after(() => replacement.ws.terminate());
    const replacementState = await replacement.until(
      (m) => m.event === "state",
    );
    assert.equal(replacementState.data.view.members.length, 2);
    await guestStream.until((m) => m.event === "membership_revoked");
    assert.equal(replacement.ws.readyState, WebSocket.OPEN);
    const rotated = await call(
      "POST",
      `/rooms/${roomId}/invitation/rotations`,
      { expectedRoomVersion: joined.body.roomVersion },
    );
    assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
    const joinRecovered = await call(
      "POST",
      `/room-invitations/${invitation.body.code}/memberships`,
      joinBody,
      { operationId: joinId, authorization: "" },
    );
    assert.equal(joinRecovered.body.membershipId, joined.body.membershipId);
    const room = await call("GET", `/rooms/${roomId}`, undefined, {
      authorization: guestAuthorization,
    });
    assert.equal(room.status, 200, JSON.stringify(room.body));
    assert.equal(room.body.view.members.length, 2);
    assert.equal(JSON.stringify(room.body).includes("Answer 1/1"), false);
    const readyId = randomUUID();
    const readyBody = {
      expectedMembershipVersion: "0",
      expectedReadyGeneration: room.body.view.readyGeneration,
      ready: true,
    };
    const ready = await call(
      "PUT",
      `/rooms/${roomId}/memberships/me/readiness`,
      readyBody,
      { operationId: readyId, authorization: guestAuthorization },
    );
    assert.equal(ready.status, 200, JSON.stringify(ready.body));
    const changedTeam = await call(
      "PATCH",
      `/rooms/${roomId}/memberships/me`,
      {
        expectedMembershipVersion: ready.body.membershipVersion,
        expectedReadyGeneration: ready.body.readyGeneration,
        teamNumber: 2,
      },
      { authorization: guestAuthorization },
    );
    assert.equal(changedTeam.status, 200, JSON.stringify(changedTeam.body));
    const recoveredReady = await call(
      "PUT",
      `/rooms/${roomId}/memberships/me/readiness`,
      readyBody,
      { operationId: readyId, authorization: guestAuthorization },
    );
    assert.equal(recoveredReady.status, 200);
    const after = await call("GET", `/rooms/${roomId}`, undefined, {
      authorization: guestAuthorization,
    });
    assert.equal(
      after.body.view.members.find(
        (item) => item.id === joined.body.membershipId,
      ).ready,
      false,
    );
    const readyAgain = await call(
      "PUT",
      `/rooms/${roomId}/memberships/me/readiness`,
      {
        expectedMembershipVersion: changedTeam.body.membershipVersion,
        expectedReadyGeneration: changedTeam.body.readyGeneration,
        ready: true,
      },
      { authorization: guestAuthorization },
    );
    assert.equal(readyAgain.status, 200, JSON.stringify(readyAgain.body));
    const startId = randomUUID();
    const startBody = {
      expectedRoomVersion: readyAgain.body.roomVersion,
      expectedReadyGeneration: readyAgain.body.readyGeneration,
    };
    const started = await call("POST", `/rooms/${roomId}/games`, startBody, {
      operationId: startId,
    });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const gameId = started.body.gameId;
    const startRetry = await call("POST", `/rooms/${roomId}/games`, startBody, {
      operationId: startId,
    });
    assert.equal(startRetry.body.gameId, gameId);
    assert.equal(
      (
        await owner.query("SELECT token_balance FROM accounts WHERE id=$1", [
          host,
        ])
      ).rows[0].token_balance,
      2,
    );
    let gameVersion = started.body.gameVersion;
    const command = async (name, fields = {}, options = {}) => {
      const result = await call(
        "POST",
        `/games/${gameId}/commands`,
        { name, expectedGameVersion: gameVersion, ...fields },
        options,
      );
      if (result.status === 200) gameVersion = result.body.gameVersion;
      return result;
    };
    const tile = { boardPosition: 1, questionPosition: 1 };
    const forbidden = await command("open_question", tile, {
      authorization: guestAuthorization,
    });
    assert.equal(forbidden.status, 403);
    const open = await command("open_question", tile);
    assert.equal(open.status, 200, JSON.stringify(open.body));
    const question = await call("GET", `/games/${gameId}`, undefined, {
      authorization: guestAuthorization,
    });
    assert.equal(question.status, 200, JSON.stringify(question.body));
    assert.equal(question.body.view.phase, "question");
    assert.equal(question.body.view.question.prompt, "Question 1/1");
    assert.equal(JSON.stringify(question.body).includes("Answer 1/1"), false);
    const revealed = await command("reveal_answer", tile);
    assert.equal(revealed.status, 200, JSON.stringify(revealed.body));
    const answer = await call("GET", `/games/${gameId}`, undefined, {
      authorization: guestAuthorization,
    });
    assert.equal(answer.body.view.answer.text, "Answer 1/1");
    assert.equal((await command("reset_timer", tile)).status, 409);
    const resolutionId = randomUUID(),
      resolveBody = {
        name: "resolve_question",
        expectedGameVersion: gameVersion,
        ...tile,
        winningTeamNumber: 1,
        awardedPoints: 0,
      };
    const resolved = await call(
      "POST",
      `/games/${gameId}/commands`,
      resolveBody,
      { operationId: resolutionId },
    );
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    gameVersion = resolved.body.gameVersion;
    const resolvedRetry = await call(
      "POST",
      `/games/${gameId}/commands`,
      resolveBody,
      { operationId: resolutionId },
    );
    assert.deepEqual(resolvedRetry.body, resolved.body);
    assert.equal(
      (await command("adjust_score", { teamNumber: 2, targetTotal: "500" }))
        .status,
      200,
    );
    assert.equal((await command("end_game")).status, 200);
    const result = await call("GET", `/games/${gameId}/result`, undefined, {
      authorization: guestAuthorization,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.winningTeamNumber, 2);
    assert.equal(result.body.teams[1].manualAdjustmentTotal, "500");
    assert.equal(result.body.categories[0].winningTeamNumber, null);
    assert.equal(
      (await command("adjust_score", { teamNumber: 1, targetTotal: "999" }))
        .status,
      409,
    );
    assert.equal(
      (
        await owner.query("SELECT active_game_id FROM accounts WHERE id=$1", [
          host,
        ])
      ).rows[0].active_game_id,
      null,
    );
    const pushed = await replacement.until(
      (m) => m.event === "state" && m.data.view.phase === "result",
    );
    assert.equal(pushed.data.view.result.winningTeamNumber, 2);
    const terminalVersion = gameVersion;
    const feedback = await call(
      "PUT",
      `/games/${gameId}/questions/1/1/feedback`,
      { expectedFeedbackVersion: "0", vote: "like" },
    );
    assert.equal(feedback.status, 200, JSON.stringify(feedback.body));
    assert.equal(feedback.body.gameVersion, terminalVersion);
    const lobbyState = await call("GET", `/rooms/${roomId}`);
    const replay = await call("POST", `/rooms/${roomId}/lobby`, {
      expectedRoomVersion: lobbyState.body.source.roomVersion,
    });
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    const consent = [];
    for (const selection of selections) {
      const page = await call(
        "GET",
        `/categories/${selection.categoryId}/packs?roomId=${roomId}&freshOnly=false&limit=50`,
      );
      assert.equal(page.status, 200, JSON.stringify(page.body));
      const pack = page.body.items[0];
      consent.push({
        ...selection,
        ...(pack.repeatRequired
          ? { repeatConsentBasis: pack.eligibilityBasis }
          : {}),
      });
    }
    const setup = await call("PUT", `/rooms/${roomId}/setup`, {
      expectedRoomVersion: replay.body.roomVersion,
      teamOneName: "One",
      teamTwoName: "Two",
      hostTeamNumber: null,
      selections: consent,
    });
    assert.equal(setup.status, 200, JSON.stringify(setup.body));
    const draft = await call("GET", `/rooms/${roomId}`, undefined, {
      authorization: guestAuthorization,
    });
    const guest = draft.body.view.members.find(
      (m) => m.id === joined.body.membershipId,
    );
    const readyReplay = await call(
      "PUT",
      `/rooms/${roomId}/memberships/me/readiness`,
      {
        expectedMembershipVersion: guest.memberVersion,
        expectedReadyGeneration: draft.body.view.readyGeneration,
        ready: true,
      },
      { authorization: guestAuthorization },
    );
    assert.equal(readyReplay.status, 200, JSON.stringify(readyReplay.body));
    const full = await call("POST", `/rooms/${roomId}/games`, {
      expectedRoomVersion: readyReplay.body.roomVersion,
      expectedReadyGeneration: readyReplay.body.readyGeneration,
    });
    assert.equal(full.status, 201, JSON.stringify(full.body));
    let fullVersion = full.body.gameVersion;
    const fullCommand = async (name, fields = {}) => {
      const r = await call("POST", `/games/${full.body.gameId}/commands`, {
        name,
        expectedGameVersion: fullVersion,
        ...fields,
      });
      assert.equal(r.status, 200, `${name}: ${JSON.stringify(r.body)}`);
      fullVersion = r.body.gameVersion;
      return r;
    };
    for (let boardPosition = 1; boardPosition <= 6; boardPosition++)
      for (
        let questionPosition = 1;
        questionPosition <= 6;
        questionPosition++
      ) {
        const slot = { boardPosition, questionPosition };
        await fullCommand("open_question", slot);
        let hv = await call("GET", `/games/${full.body.gameId}`);
        let vv = await call("GET", `/games/${full.body.gameId}`, undefined, {
          authorization: guestAuthorization,
        });
        assert.equal(hv.status, 200, JSON.stringify(hv.body));
        assert.equal(vv.status, 200, JSON.stringify(vv.body));
        const format = hv.body.view.question.format;
        assert.equal(
          JSON.stringify(vv.body).includes(
            `Answer ${boardPosition}/${questionPosition}`,
          ),
          false,
        );
        if (format === "IMAGE_MEMORY") {
          assert.equal(hv.body.view.question.prompt, undefined);
          assert.equal(hv.body.view.timer.state, "ready");
          await fullCommand("show_memory", slot);
          hv = await call("GET", `/games/${full.body.gameId}`);
          assert.equal(hv.body.view.question.prompt, undefined);
          assert.ok(hv.body.view.question.image);
          await fullCommand("hide_memory", slot);
          await fullCommand("pause_timer", slot);
          await fullCommand("return_to_board", slot);
          await fullCommand("open_question", slot);
          hv = await call("GET", `/games/${full.body.gameId}`);
          assert.equal(hv.body.view.timer.state, "paused");
          assert.ok(hv.body.view.question.prompt);
          assert.equal(hv.body.view.question.image, undefined);
          await fullCommand("show_memory", slot);
          await fullCommand("hide_memory", slot);
          await fullCommand("reset_timer", slot);
        }
        if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(format)) {
          const future = {
            kind: "image",
            ...slot,
            role: "hint_image",
            variantNumber: 1,
          };
          assert.equal(
            (
              await call(
                "POST",
                `/games/${full.body.gameId}/media-access`,
                { refs: [future] },
                { authorization: guestAuthorization },
              )
            ).status,
            403,
          );
          await fullCommand("advance_hint", slot);
          await fullCommand("advance_hint", slot);
          await fullCommand("return_to_board", slot);
          await fullCommand("open_question", slot);
          hv = await call("GET", `/games/${full.body.gameId}`);
          assert.equal(hv.body.view.question.stageIndex, 2);
        }
        if (format.startsWith("AUDIO_")) {
          assert.ok(hv.body.view.question.audio);
          assert.equal(vv.body.view.question.audio, undefined);
          const media = { refs: [hv.body.view.question.audio] };
          assert.equal(
            (
              await call(
                "POST",
                `/games/${full.body.gameId}/media-access`,
                media,
                { authorization: guestAuthorization },
              )
            ).status,
            403,
          );
          const mediaResult = await call(
            "POST",
            `/games/${full.body.gameId}/media-access`,
            media,
          );
          assert.equal(
            mediaResult.status,
            200,
            JSON.stringify(mediaResult.body),
          );
          assert.ok(mediaResult.body.links[0].expiresAt);
        }
        await fullCommand("reveal_answer", slot);
        const answer = await call("GET", `/games/${full.body.gameId}`);
        assert.equal(answer.status, 200, JSON.stringify(answer.body));
        assert.equal(
          answer.body.view.answer.text,
          `Answer ${boardPosition}/${questionPosition}`,
        );
        if (format === "IMAGE_COLOR")
          assert.equal(answer.body.view.answer.colorHex, "#123456");
        if (format === "AUDIO_REVERSE") {
          assert.ok(answer.body.view.answer.forwardAudio);
          assert.equal(
            (
              await call("POST", `/games/${full.body.gameId}/media-access`, {
                refs: [answer.body.view.answer.forwardAudio],
              })
            ).status,
            200,
          );
        }
        await fullCommand("resolve_question", {
          ...slot,
          winningTeamNumber: questionPosition % 2 ? 1 : 2,
        });
      }
    const fullResult = await call("GET", `/games/${full.body.gameId}/result`);
    assert.equal(fullResult.status, 200, JSON.stringify(fullResult.body));
    assert.equal(fullResult.body.resolvedQuestionCount, 36);
    assert.equal(fullResult.body.endReason, "completed");
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM account_pack_completions WHERE game_id=$1",
          [full.body.gameId],
        )
      ).rows[0].n,
      6,
    );
    assert.equal(
      (
        await owner.query(
          "SELECT count(*)::int AS n FROM account_question_exposures WHERE account_id=$1",
          [host],
        )
      ).rows[0].n,
      36,
    );
    const takeoverId = randomUUID(),
      proposed = secret();
    const takeoverBody = {
      expectedControllerGeneration: generation,
      proposedControlSecret: proposed,
    };
    const takeover = await call(
      "POST",
      `/rooms/${roomId}/control`,
      takeoverBody,
      { operationId: takeoverId },
    );
    assert.equal(takeover.status, 200, JSON.stringify(takeover.body));
    assert.equal((await call("GET", `/rooms/${roomId}`)).status, 403);
    control = proposed;
    generation = takeover.body.controllerGeneration;
    assert.equal(
      (
        await call("POST", `/rooms/${roomId}/control`, takeoverBody, {
          operationId: takeoverId,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("POST", `/rooms/${roomId}/control`, {
          expectedControllerGeneration: generation,
          proposedControlSecret: control,
        })
      ).status,
      409,
    );
    await hostStream.until((m) => m.event === "control_revoked");
    await replacement.until(
      (m) =>
        m.event === "state" &&
        m.data.source.roomVersion === takeover.body.roomVersion,
    );
    assert.equal(replacement.ws.readyState, WebSocket.OPEN);
    const locator = await call("GET", "/rooms/current");
    assert.equal(locator.body.room.roomId, roomId);
    const closed = await call("POST", `/rooms/${roomId}/closure`, {
      expectedRoomVersion: takeover.body.roomVersion,
    });
    assert.equal(closed.status, 200, JSON.stringify(closed.body));
    assert.equal(
      (
        await call("GET", `/games/${gameId}/result`, undefined, {
          authorization: guestAuthorization,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("GET", `/rooms/${roomId}`, undefined, {
          authorization: guestAuthorization,
        })
      ).status,
      403,
    );
  },
);
