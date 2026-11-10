import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { WebSocket } from "ws";
import { cluster } from "./database/cluster.mjs";
import { createApplication } from "../dist/application.js";

const exec = promisify(execFile);
const secret = () => randomBytes(32).toString("base64url");
const freePort = () =>
  new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

test(
  "preview hosts play seeded placeholder content from local storage",
  { timeout: 240000 },
  async (t) => {
    const cleanup = [];
    const pg = await cluster({ after: (fn) => cleanup.push(fn) });
    const owner = await pg.database("sahsah_preview");
    const media = await mkdtemp(path.join(tmpdir(), "sahsah-media-"));
    let app;
    t.after(async () => {
      await app?.close();
      await owner.end();
      for (const fn of cleanup) await fn();
      await rm(media, { recursive: true, force: true });
    });

    // The seed is the same command a developer runs; a rerun changes nothing.
    const seed = () =>
      exec(process.execPath, ["scripts/content/seed-placeholders.mjs"], {
        env: {
          PATH: process.env.PATH,
          MIGRATION_DATABASE_URL: pg.url("sahsah_owner", "sahsah_preview"),
          GAMEPLAY_LOCAL_MEDIA_DIR: media,
        },
      });
    assert.match((await seed()).stdout, /12 categories, 24 packs/);
    const count = async () =>
      (
        await owner.query(
          "SELECT (SELECT count(*)::int FROM questions) AS questions,(SELECT count(*)::int FROM media_assets) AS assets,(SELECT count(*)::int FROM question_media) AS pins",
        )
      ).rows[0];
    const seeded = await count();
    assert.equal(seeded.questions, 144);
    await seed();
    assert.deepEqual(await count(), seeded);

    // Everything below is configured through the environment, as on Railway.
    const port = await freePort();
    Object.assign(process.env, {
      NODE_ENV: "test",
      ADMIN_ENABLED: "false",
      PORT: String(port),
      DATABASE_URL: pg.url("sahsah_app", "sahsah_preview"),
      GAMEPLAY_ENABLED: "true",
      GAMEPLAY_PREVIEW_PASSCODE: "open-sesame",
      GAMEPLAY_PREVIEW_SECRET: secret(),
      GAMEPLAY_LOCAL_MEDIA_DIR: media,
      TRUSTED_PROXY_HOPS: "1",
    });
    app = await createApplication();
    await app.listen(port, "127.0.0.1");
    const base = `http://127.0.0.1:${port}/api/v1`;
    const session = (body, address = "203.0.113.1") =>
      fetch(`${base}/preview/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": address,
        },
        body: JSON.stringify(body),
      }).then(async (r) => ({ status: r.status, body: await r.json() }));

    // Passcode gate: each browser gets its own host; a held credential renews it.
    assert.equal(
      (await session({ passcode: "wrong", displayName: "X" })).status,
      401,
    );
    const first = await session({
      passcode: "open-sesame",
      displayName: "سارة",
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const second = await session({
      passcode: "open-sesame",
      displayName: "عمر",
    });
    assert.notEqual(second.body.accountId, first.body.accountId);
    const renewed = await session({
      credential: first.body.credential,
      displayName: "سارة م",
    });
    assert.equal(renewed.body.accountId, first.body.accountId);
    assert.equal(
      (await session({ credential: "forged", displayName: "X" })).status,
      401,
    );
    const balance = async () =>
      (
        await owner.query("SELECT token_balance FROM accounts WHERE id=$1", [
          first.body.accountId,
        ])
      ).rows[0].token_balance;
    assert.equal(await balance(), 10000);
    // Guessing is throttled per forwarded client address, not per proxy.
    const guesses = [];
    for (let i = 0; i < 7; i++)
      guesses.push(
        (await session({ passcode: "guess", displayName: "X" }, "203.0.113.9"))
          .status,
      );
    assert.deepEqual(guesses, [401, 401, 401, 401, 401, 429, 429]);
    assert.equal(
      (await session({ passcode: "open-sesame", displayName: "ليلى" })).status,
      200,
    );

    // Catalog: sections, descriptions, public covers and playable pack counts.
    const listed = await fetch(`${base}/categories?limit=50`);
    assert.equal(listed.headers.get("cache-control"), "public, max-age=60");
    const categories = (await listed.json()).items;
    assert.equal(categories.length, 12);
    assert.equal(new Set(categories.map((c) => c.section.id)).size, 3);
    for (const category of categories) {
      assert.ok(category.description);
      assert.equal(category.publishedPackCount, 2);
    }
    const coverImage = await fetch(categories[0].coverUrl);
    assert.equal(coverImage.status, 200);
    assert.equal(coverImage.headers.get("content-type"), "image/svg+xml");
    assert.equal(
      (await (await fetch(`${base}/categories`)).json()).items.length,
      12,
    );

    let control = secret();
    const call = async (method, route, body, authorization) => {
      const response = await fetch(base + route, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization ?? `Bearer ${first.body.credential}`,
          "Idempotency-Key": randomUUID(),
          "X-Control-Secret": control,
          "X-Controller-Generation": "1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const selections = [];
    for (const [i, category] of categories.slice(0, 6).entries()) {
      const packs = await call("GET", `/categories/${category.id}/packs`);
      assert.equal(packs.body.items.length, 2, JSON.stringify(packs.body));
      const pack = packs.body.items[i % 2];
      selections.push({
        boardPosition: i + 1,
        categoryId: category.id,
        packId: pack.id,
        observedRevision: pack.contentRevision,
      });
    }
    assert.equal(
      (await (await fetch(`${base}/gameplay/availability`)).json()).admission,
      "open",
    );
    const created = await call("POST", "/rooms", {
      teamOneName: "الصقور",
      teamTwoName: "النمور",
      hostTeamNumber: null,
      selections,
      proposedControlSecret: control,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const roomId = created.body.roomId;
    const invitation = await call("GET", `/rooms/${roomId}/invitation`);
    const guestSecret = secret();
    const joined = await call(
      "POST",
      `/room-invitations/${invitation.body.code}/memberships`,
      {
        identity: "anonymous",
        displayName: "ضيف",
        teamNumber: 1,
        reconnectSecret: guestSecret,
      },
      "",
    );
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    const guest = `Bearer g.${joined.body.membershipId}.${guestSecret}`;
    const connect = async (authorization, controllerSecret) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/realtime`, {
        origin: "http://localhost:3000",
      });
      t.after(() => ws.terminate());
      const messages = [];
      ws.on("message", (raw) =>
        messages.push({ ...JSON.parse(raw.toString()), at: performance.now() }),
      );
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
          assert.ok(Date.now() < deadline, "timed out waiting for a frame");
          await new Promise((r) => setTimeout(r, 2));
        }
        return messages.find(predicate);
      };
      return { ws, messages, until };
    };
    const viewer = await connect(guest);
    await viewer.until((m) => m.event === "state");
    const lobby = await call("GET", `/rooms/${roomId}`, undefined, guest);
    const ready = await call(
      "PUT",
      `/rooms/${roomId}/memberships/me/readiness`,
      {
        expectedMembershipVersion: joined.body.membershipVersion,
        expectedReadyGeneration: lobby.body.view.readyGeneration,
        ready: true,
      },
      guest,
    );
    assert.equal(ready.status, 200, JSON.stringify(ready.body));
    const started = await call("POST", `/rooms/${roomId}/games`, {
      expectedRoomVersion: ready.body.roomVersion,
      expectedReadyGeneration: ready.body.readyGeneration,
    });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    assert.equal(await balance(), 9999);
    const gameId = started.body.gameId;
    let version = started.body.gameVersion;
    await new Promise((r) => setTimeout(r, 700));
    const baseline = viewer.messages.filter((m) => m.event === "state").length;
    const delays = [];
    const command = async (name, fields = {}) => {
      const before = viewer.messages.filter((m) => m.event === "state").length;
      const sent = performance.now();
      const r = await call("POST", `/games/${gameId}/commands`, {
        name,
        expectedGameVersion: version,
        ...fields,
      });
      assert.equal(r.status, 200, `${name}: ${JSON.stringify(r.body)}`);
      version = r.body.gameVersion;
      const frame = await viewer.until(
        (m) =>
          m.event === "state" &&
          viewer.messages.filter((x) => x.event === "state").indexOf(m) >=
            before,
      );
      delays.push(frame.at - sent);
      return r;
    };
    // Every reference a view exposes must resolve to a real stored file.
    const fetched = new Set();
    const load = async (refs, authorization) => {
      const access = await call(
        "POST",
        `/games/${gameId}/media-access`,
        { refs },
        authorization,
      );
      assert.equal(access.status, 200, JSON.stringify(access.body));
      for (const link of access.body.links) {
        const file = await fetch(link.url, {
          headers: link.contentType.startsWith("audio/")
            ? { Range: "bytes=0-99" }
            : {},
        });
        assert.equal(
          file.status,
          link.contentType.startsWith("audio/") ? 206 : 200,
        );
        assert.equal(file.headers.get("content-type"), link.contentType);
        await file.arrayBuffer();
        fetched.add(link.ref.role);
      }
      return access.body.links;
    };
    const view = async (authorization) =>
      (await call("GET", `/games/${gameId}`, undefined, authorization)).body
        .view;
    const formats = new Set();
    for (let boardPosition = 1; boardPosition <= 6; boardPosition++)
      for (
        let questionPosition = 1;
        questionPosition <= 6;
        questionPosition++
      ) {
        const slot = { boardPosition, questionPosition };
        await command("open_question", slot);
        let host = await view();
        const format = host.question.format;
        formats.add(format);
        if (format === "IMAGE_MEMORY") {
          await command("show_memory", slot);
          await load([(await view(guest)).question.image], guest);
          await command("hide_memory", slot);
        } else if (host.question.image) {
          const [link] = await load([host.question.image], guest);
          if (boardPosition === 1 && questionPosition === 2) {
            // A signed link cannot be altered or reused for another file.
            const forged = new URL(link.url);
            forged.searchParams.set("signature", "0".repeat(64));
            assert.equal((await fetch(forged)).status, 404);
            assert.equal((await fetch(link.url.split("?")[0])).status, 404);
          }
        }
        if (["IMAGE_BLUR", "IMAGE_ZOOM"].includes(format)) {
          await command("advance_hint", slot);
          await load([(await view(guest)).question.image], guest);
        }
        if (format.startsWith("AUDIO_")) {
          assert.equal((await view(guest)).question.audio, undefined);
          await load([host.question.audio]);
        }
        await command("reveal_answer", slot);
        host = await view();
        if (host.answer.image) await load([host.answer.image], guest);
        if (host.answer.forwardAudio) await load([host.answer.forwardAudio]);
        await command("resolve_question", {
          ...slot,
          winningTeamNumber: questionPosition % 2 ? 1 : 2,
        });
      }
    assert.equal(formats.size, 10);
    assert.deepEqual([...fetched].sort(), [
      "answer_audio",
      "answer_image",
      "hint_image",
      "prompt_image",
      "question_audio",
    ]);
    const result = await call("GET", `/games/${gameId}/result`);
    assert.equal(result.body.endReason, "completed");

    // Views are pushed after commit rather than on the outbox poll, exactly once.
    delays.sort((a, b) => a - b);
    const median = delays[Math.floor(delays.length / 2)];
    assert.ok(median < 250, `median push delay ${median.toFixed(1)} ms`);
    const settled = viewer.messages.filter((m) => m.event === "state").length;
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(
      viewer.messages.filter((m) => m.event === "state").length,
      settled,
    );
    assert.equal(settled - baseline, delays.length);
    t.diagnostic(
      `push delay ms: median ${median.toFixed(1)}, max ${delays.at(-1).toFixed(1)}, n=${delays.length}`,
    );
  },
);
