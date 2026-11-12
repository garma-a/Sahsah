import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../dist/database/schema/index.js";
import * as queries from "../dist/gameplay/maintenance/queries.js";
import { completionHistory } from "../dist/gameplay/catalog/history.js";
import { DatabaseService } from "../dist/database/database.module.js";
import { cluster } from "./database/cluster.mjs";
import { gameplayFixture } from "./gameplay/fixture.mjs";

process.env.NODE_ENV = "test";

test("typed maintenance helpers retain skip-locked batches, leases and bounded cleanup", { timeout: 180000 }, async (t) => {
  const pg = await cluster(t);
  const owner = await pg.database("sahsah_query_helpers");
  const first = await pg.connect("sahsah_app", "sahsah_query_helpers");
  const second = await pg.connect("sahsah_app", "sahsah_query_helpers");
  const db = drizzle(first, { schema });
  const other = drizzle(second, { schema });
  await owner.query(`INSERT INTO outbox_events(id,deduplication_key,topic,resource_kind,resource_id,payload,available_at,created_at)
    SELECT gen_random_uuid(),'pending-'||n,'room.changed','room',gen_random_uuid(),jsonb_build_object('roomId',gen_random_uuid()),clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 day'
    FROM generate_series(1,120) n`);
  await first.query("BEGIN");
  await second.query("BEGIN");
  try {
    const lease = randomUUID();
    const a = await queries.claimEvents(db, lease);
    const b = await queries.claimEvents(other, randomUUID());
    assert.equal(a.length, 50);
    assert.equal(b.length, 50);
    assert.equal(new Set([...a, ...b].map((e) => e.id)).size, 100);
    await queries.succeedEvents(db, lease);
    assert.equal((await first.query("SELECT count(*)::int AS n FROM outbox_events WHERE state='succeeded' AND attempt_count=1 AND lease_token IS NULL AND lease_until IS NULL")).rows[0].n, 50);
  } finally {
    await second.query("ROLLBACK");
    await first.query("ROLLBACK");
  }
  await owner.query(`INSERT INTO outbox_events(id,deduplication_key,topic,resource_kind,resource_id,payload,available_at,created_at,state,finished_at)
    SELECT gen_random_uuid(),'old-'||n,'room.changed','room',gen_random_uuid(),'{}',clock_timestamp()-interval '10 days',clock_timestamp()-interval '10 days','succeeded',clock_timestamp()-interval '8 days'
    FROM generate_series(1,105) n`);
  await owner.query(`INSERT INTO outbox_events(id,deduplication_key,topic,resource_kind,resource_id,payload,available_at,created_at,attempt_count,max_attempts)
    VALUES(gen_random_uuid(),'exhausted','room.changed','room',gen_random_uuid(),'{}',clock_timestamp(),clock_timestamp(),3,3)`);
  await queries.exhaustEvents(db);
  assert.equal((await first.query("SELECT state,last_error_code FROM outbox_events WHERE deduplication_key='exhausted'")).rows[0].state, "dead");
  await queries.deleteOldReceipts(db);
  assert.equal((await first.query("SELECT count(*)::int AS n FROM outbox_events WHERE deduplication_key LIKE 'old-%'")).rows[0].n, 5);
  assert.deepEqual(await queries.dueGames(db), []);
  assert.deepEqual(await queries.dueRooms(db), []);
  assert.deepEqual(await queries.expiredInvitations(db), []);
  assert.deepEqual(await queries.purgeCandidates(db), []);
});

test("typed completion history recognises a completed pack and replacement questions", { timeout: 180000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1 });
  const room = await f.create();
  const headers = { control: room.control };
  const started = await f.call("POST", `/rooms/${room.roomId}/games`, {
    expectedRoomVersion: room.roomVersion,
    expectedReadyGeneration: room.readyGeneration,
  }, headers);
  assert.equal(started.status, 201, JSON.stringify(started.body));
  let version = started.body.gameVersion;
  for (let boardPosition = 1; boardPosition <= 6; boardPosition++) {
    for (let questionPosition = 1; questionPosition <= 6; questionPosition++) {
      for (const name of ["open_question", "reveal_answer", "resolve_question"]) {
        const response = await f.call("POST", `/games/${started.body.gameId}/commands`, {
          name, expectedGameVersion: version, boardPosition, questionPosition,
          ...(name === "resolve_question" ? { winningTeamNumber: null } : {}),
        }, headers);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        version = response.body.gameVersion;
      }
    }
  }
  const db = f.app.get(DatabaseService).db;
  const packId = f.selections[0].packId;
  assert.deepEqual(await completionHistory(db, f.accounts[0], [packId]), [{ packId, current: true }]);
  await f.owner.query("BEGIN");
  try {
    await f.owner.query("UPDATE questions SET retired_at=clock_timestamp() WHERE pack_id=$1 AND slot_number=1 AND retired_at IS NULL", [packId]);
    await f.owner.query("INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar) VALUES($1,$2,1,'STANDARD','Replacement','Replacement')", [randomUUID(), packId]);
    await f.owner.query("COMMIT");
  } catch (error) { await f.owner.query("ROLLBACK"); throw error; }
  assert.deepEqual(await completionHistory(db, f.accounts[0], [packId]), [{ packId, current: false }]);
});
