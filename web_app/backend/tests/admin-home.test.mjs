import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { computeHomeSnapshot, HomeStats, STATS_TTL_MS } from "../dist/admin/home/stats.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { gameplayFixture } from "./gameplay/fixture.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const ADMIN = { email: "admin@example.test", password: "admin-password-123" };

async function startAdmin(t, databaseUrl) {
  const admin = await createAdminApplication({ NODE_ENV: "test", DATABASE_URL: databaseUrl, ADMIN_SESSION_SECRET: SECRET, ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000", CLOUDFLARE_ANALYTICS_URL: "https://dash.cloudflare.com/analytics-example" });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return { base: `http://127.0.0.1:${server.address().port}`, admin };
}

async function signIn(base) {
  const response = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams(ADMIN), redirect: "manual" });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const page = (name) => async (query = "") => {
    const r = await fetch(`${base}/admin/api/pages/${name}${query}`, { headers: { Cookie: cookie } });
    return { status: r.status, ...(await r.json()) };
  };
  const post = (name) => async (body) => {
    const r = await fetch(`${base}/admin/api/pages/${name}`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey: randomUUID(), ...body }) });
    return { status: r.status, body: await r.json() };
  };
  const dashboard = async (query = "") => {
    const r = await fetch(`${base}/admin/api/dashboard${query}`, { headers: { Cookie: cookie } });
    return { status: r.status, ...(await r.json()) };
  };
  return { cookie, dashboard, messages: page("messages"), shop: page("shop"), players: page("players"), content: page("content"), postMessages: post("messages"), postShop: post("shop") };
}

const db = (f) => f.owner;

/** Seeds one game (and its room) with explicit times, so a test never depends on the wall clock. */
async function seedGame(o, { host, startedAt, active = false, openRoom = false, categories = [], before }) {
  const room = randomUUID(), game = randomUUID(), start = new Date(startedAt);
  const end = new Date(start.getTime() + 3600000);
  await o.query("INSERT INTO rooms(id,owner_account_id,team_one_name,team_two_name,created_at,last_lobby_activity_at,lobby_idle_expires_at) VALUES($1,$2,'A','B',$3,$3,$3::timestamptz+interval '24 hours')", [room, host, start]);
  if (!openRoom) {
    await o.query(
      `INSERT INTO games(id,room_id,sequence_number,start_request_id,start_request_digest,started_at,last_gameplay_at,idle_expires_at,host_account_id,team_one_name,team_two_name,controller_credential_hash,controller_acquired_at)
       VALUES($1,$2,1,$3::uuid,sha256($3::text::bytea),$4::timestamptz,$4::timestamptz,$4::timestamptz+interval '24 hours',$5,'A','B',$6,$4::timestamptz)`,
      [game, room, randomUUID(), start, host, randomBytes(32)],
    );
    for (const [index, category] of categories.entries())
      await o.query("INSERT INTO game_packs(game_id,category_id,pack_id,board_position,pack_number,source_content_revision,category_name_ar) VALUES($1,$2,$3,$4,1,1,'x')", [game, category.id, category.pack, index + 1]);
    await before?.(game);
    // Games and their rooms end only after the content is attached: the content is frozen then.
    if (!active) {
      await o.query("UPDATE games SET status='finished',ended_at=$2::timestamptz,end_reason='host_ended',content_purge_after=$2::timestamptz+interval '12 months' WHERE id=$1", [game, end]);
      await o.query("UPDATE rooms SET closed_at=$2 WHERE id=$1", [room, end]);
    }
  }
  return { room, game };
}

const NOW = new Date("2026-01-15T10:00:00Z"); // 12:00 in Cairo, UTC+2
const at = (iso) => new Date(iso);

test("home: every figure and queue count, cache invalidation by a real change, counts match the lists", { timeout: 300000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 6, tokens: 2 });
  const o = db(f);
  const staffId = randomUUID();
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [staffId, ADMIN.email, await hashPassword(ADMIN.password)]);
  const [a0, a1, a2, a3, a4, a5] = f.accounts;
  const accountAt = (id, iso) => o.query("UPDATE accounts SET created_at=$2 WHERE id=$1", [id, iso]);
  await accountAt(a0, "2026-01-15T05:00:00Z");
  await accountAt(a1, "2026-01-15T08:00:00Z");
  await accountAt(a2, "2026-01-14T21:59:00Z"); // 23:59 yesterday in Cairo
  await accountAt(a3, "2026-01-12T12:00:00Z");
  await accountAt(a4, "2025-12-01T12:00:00Z");
  await accountAt(a5, "2025-12-01T12:00:00Z");

  // ---- catalog: three categories played, one for draft work, one archived --------------------
  const category = async (name, archived = false) => {
    const id = randomUUID();
    await o.query("INSERT INTO categories(id,name_ar,archived_at) VALUES($1,$2,$3)", [id, name, archived ? new Date() : null]);
    return id;
  };
  const pack = async (categoryId, number, state = "published", { archived = false } = {}) => {
    const id = randomUUID();
    await o.query("INSERT INTO question_packs(id,category_id,pack_number,publication_state,archived_at) VALUES($1,$2,$3,$4,$5)", [id, categoryId, number, state, archived ? new Date() : null]);
    return id;
  };
  const question = async (packId, slot, retired = false) => {
    const id = randomUUID();
    await o.query("INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar,retired_at) VALUES($1,$2,$3,'STANDARD','سؤال','إجابة',$4)", [id, packId, slot, retired ? new Date() : null]);
    return id;
  };
  const played = [];
  for (const name of ["الأولى", "الثانية", "الثالثة"]) {
    const id = await category(name);
    played.push({ id, pack: await pack(id, 1) });
  }
  const [c1, c2, c3] = played;

  // ---- games: today (2), yesterday, two days before, just outside the seven-day window -------
  await seedGame(o, { host: a0, startedAt: at("2026-01-15T07:00:00Z"), categories: [c1, c2] });
  await seedGame(o, { host: a0, startedAt: at("2026-01-15T09:00:00Z"), active: true, categories: [c1, c3] });
  await seedGame(o, { host: a2, startedAt: at("2026-01-14T21:59:59Z"), categories: [c1] });
  await seedGame(o, { host: a2, startedAt: at("2026-01-13T12:00:00Z"), categories: [c2] });
  await seedGame(o, { host: a3, startedAt: at("2026-01-08T12:00:00Z"), categories: [c3] });
  await seedGame(o, { host: a1, startedAt: at("2026-01-15T09:30:00Z"), openRoom: true }); // a lobby: a live room without a game

  // ---- orders: paid today, paid yesterday (Cairo), a pending one -----------------------------
  const order = async (buyer, total, createdAt, paid) => {
    const id = randomUUID(), attempt = randomUUID(), transaction = randomUUID(), event = randomUUID();
    await o.query(
      `INSERT INTO token_orders(id,buyer_account_id,order_kind,beneficiary_account_id,token_quantity,currency,pricing_version,base_unit_price_minor,quantity_discount_bps,list_subtotal_minor,quantity_discount_minor,offer_subtotal_minor,additional_discount_kind,additional_discount_bps,additional_discount_minor,total_minor,idempotency_key,request_digest,created_at)
       VALUES($1,$2,'personal',$2,1,'EGP',1,$3,0,$3,0,$3,'none',0,0,$3,$4,$5,$6)`,
      [id, buyer, total, randomUUID(), randomBytes(32), createdAt],
    );
    if (paid) {
      await o.query("BEGIN"); // the payment evidence is checked at commit
      await o.query("INSERT INTO payment_attempts(id,order_id,environment,provider_namespace,configuration_key,request_key,special_reference,allowed_integration_ids,created_at) VALUES($1,$2,'test','merchant_test','fixture',$3,$4,ARRAY['101'],now())", [attempt, id, randomUUID(), randomUUID()]);
      await o.query("INSERT INTO payment_transactions(id,environment,provider_namespace,provider_transaction_id,attempt_id,order_id,integration_id,amount_minor,currency,outcome,captured_minor,created_at) VALUES($1,'test','merchant_test',$2,$3,$4,'101',$5,'EGP','succeeded',$5,now())", [transaction, randomUUID(), attempt, id, total]);
      await o.query("INSERT INTO payment_events(id,environment,provider_namespace,configuration_key,verification_method,fingerprint,notification_type,attempt_id,transaction_id,facts_hash,verified_facts,observed_payment_outcome,received_at,verified_at,state,processed_at) VALUES($1::uuid,'test','merchant_test','fixture','hmac_callback',sha256($1::uuid::text::bytea),'TRANSACTION',$2,$3,sha256($3::uuid::text::bytea),'{}','succeeded',now(),now(),'processed',now())", [event, attempt, transaction]);
      await o.query("UPDATE payment_transactions SET last_verification_event_id=$2,last_verified_at=now() WHERE id=$1", [transaction, event]);
      await o.query("UPDATE token_orders SET payment_state='paid',settlement_kind='payment',verified_paid_at=now(),settled_at=now(),settlement_payment_transaction_id=$2,settlement_payment_kind='payment',settlement_verification_event_id=$3 WHERE id=$1", [id, transaction, event]);
      await o.query("INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,source_order_id,source_order_settlement_kind) VALUES($1,$2,'credit',1,$3,$4,'payment')", [randomUUID(), buyer, randomUUID(), id]);
      await o.query("COMMIT");
    }
    return id;
  };
  const paidToday = await order(a0, 12000, at("2026-01-15T06:00:00Z"), true);
  await order(a1, 5000, at("2026-01-15T08:30:00Z"), true);
  await order(a2, 7000, at("2026-01-14T21:59:59Z"), true);
  await order(a3, 9900, at("2026-01-15T09:00:00Z"), false);

  // ---- queues ---------------------------------------------------------------------------------
  const message = async (closed = false) => {
    const id = randomUUID();
    await o.query("INSERT INTO contact_submissions(id,request_key,request_digest,kind,support_reason,name,email,message,created_at) VALUES($1,$2,$3,'support','technical','Sender','p@example.test','Help me please',now())", [id, randomUUID(), randomBytes(32)]);
    if (closed) await o.query("UPDATE contact_submissions SET state='closed', closed_at=now(), closed_by_staff_id=$2 WHERE id=$1", [id, staffId]);
    return id;
  };
  const openMessage = await message(); await message(); await message(); await message(true);

  const cases = [];
  for (let i = 0; i < 3; i++) {
    const id = randomUUID();
    cases.push(id);
    await o.query("INSERT INTO payment_reconciliation_cases(id,case_key,case_type,order_id,opened_at) VALUES($1,$2,'late_payment',$3,now())", [id, `case-${id}`, paidToday]);
  }

  await o.query("UPDATE accounts SET state='deletion_pending' WHERE id = ANY($1)", [[a3, a4, a5]]);
  await o.query("INSERT INTO account_deletion_requests(id,account_id,request_key,requested_at) VALUES($1,$2,$3,now())", [randomUUID(), a3, randomUUID()]);
  const [confirmed, cancelled] = [randomUUID(), randomUUID()];
  for (const [id, account] of [[confirmed, a4], [cancelled, a5]]) await o.query("INSERT INTO account_deletion_requests(id,account_id,request_key,requested_at) VALUES($1,$2,$3,now()-interval '1 hour')", [id, account, randomUUID()]);
  await o.query("UPDATE account_deletion_requests SET state='confirmed',funding_cleared_at=now()-interval '30 minutes',confirmed_bank=2,confirmed_at=now()-interval '20 minutes' WHERE id=$1", [confirmed]);
  await o.query("UPDATE account_deletion_requests SET state='cancelled',cancelled_at=now() WHERE id=$1", [cancelled]);

  const draftCategory = await category("مسودات"), archivedCategory = await category("مؤرشفة", true);
  const draftPacks = {
    twoQuestions: await pack(draftCategory, 1, "draft"),
    empty: await pack(draftCategory, 2, "draft"),
    fivePlusRetired: await pack(draftCategory, 3, "draft"),
    sixPlusRetired: await pack(draftCategory, 4, "draft"),
    archivedPack: await pack(draftCategory, 5, "draft", { archived: true }),
    inArchivedCategory: await pack(archivedCategory, 1, "draft"),
  };
  for (const slot of [1, 2]) await question(draftPacks.twoQuestions, slot);
  for (const slot of [1, 2, 3, 4, 5]) await question(draftPacks.fivePlusRetired, slot);
  await question(draftPacks.fivePlusRetired, 6, true);
  for (const slot of [1, 2, 3, 4, 5, 6]) await question(draftPacks.sixPlusRetired, slot);
  await question(draftPacks.sixPlusRetired, 6, true);
  await question(draftPacks.archivedPack, 1);
  await question(draftPacks.inArchivedCategory, 1);

  const flag = async (account, resolved) => {
    const audit = randomUUID();
    await o.query("INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'account.flag','account',$3,$4,'fixture')", [audit, staffId, account, randomUUID()]);
    await o.query("INSERT INTO account_flags(id,account_id,note,created_by,audit_event_id) VALUES($1,$2,'Note',$3,$4)", [randomUUID(), account, staffId, audit]);
    if (resolved) {
      const resolveAudit = randomUUID();
      await o.query("INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'account.flag.resolve','account',$3,$4,'fixture')", [resolveAudit, staffId, account, randomUUID()]);
      await o.query("UPDATE account_flags SET resolved_at=now(),resolved_by=$2,resolve_audit_event_id=$3 WHERE audit_event_id=$1", [audit, staffId, resolveAudit]);
    }
  };
  await flag(a0, false); await flag(a0, false); await flag(a1, false); await flag(a2, true);

  // Votes: 25 finished games long before the window, each carrying one question of five packs.
  // A: 20 votes, 8 down (40%) listed. B: 20 votes, 7 down (35%) not. C: 19 votes, all down, too few.
  // D: retired. E: 25 votes, all down, listed.
  const vote = [];
  for (let n = 0; n < 5; n++) {
    const categoryId = await category(`تصويت ${n}`), packId = await pack(categoryId, 1);
    vote.push({ id: categoryId, pack: packId, question: await question(packId, 1, n === 3) });
  }
  const spec = [[20, 8], [20, 7], [19, 19], [20, 20], [25, 25]];
  for (let g = 0; g < 25; g++) {
    await seedGame(o, {
      host: a4,
      startedAt: new Date(Date.parse("2025-12-20T12:00:00Z") + g * 60000),
      categories: vote,
      before: async (game) => {
        for (const [index, [votes, down]] of spec.entries()) {
          if (g >= votes) continue;
          await o.query(
            `INSERT INTO game_questions(game_id,board_position,question_position,source_question_id,base_points,format,content_snapshot,first_opened_at,revealed_at,feedback_vote,feedback_by_account_id,feedback_created_at,feedback_updated_at)
             VALUES($1,$2,1,$3,200,'STANDARD','{"prompt_ar":"x","answer_ar":"y"}',$4,$4,$5,$6,$4,$4)`,
            [game, index + 1, vote[index].question, new Date(Date.parse("2025-12-20T12:30:00Z") + g * 60000), g < down ? "dislike" : "like", a4],
          );
        }
      },
    });
  }

  const { base, admin } = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const staff = await signIn(base);

  // ---- the snapshot ---------------------------------------------------------------------------
  const snapshot = await computeHomeSnapshot(admin.database.db, NOW);
  assert.equal(snapshot.cairoDate, "2026-01-15");
  assert.deepEqual(snapshot.kpis, {
    gamesToday: 2,
    salesTodayEgp: 170, // 12000 + 5000 minor units; yesterday's and the pending order are left out
    paidOrdersToday: 2,
    anyOrder: true,
    newAccountsToday: 2,
    tokensInBanks: 6 * 2 + 3, // two each, plus one order credit each for three paid orders
    activeGames: 1,
    liveRooms: 2,
  });
  assert.deepEqual(snapshot.trend.map((d) => d.date), ["2026-01-09", "2026-01-10", "2026-01-11", "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15"]);
  assert.deepEqual(snapshot.trend.map((d) => d.games), [0, 0, 0, 0, 1, 1, 2]);
  assert.deepEqual(snapshot.trend.map((d) => d.accounts), [0, 0, 0, 1, 0, 1, 2]);
  assert.deepEqual(snapshot.topCategories.map((c) => [c.nameAr, c.games]), [["الأولى", 3], ["الثانية", 2], ["الثالثة", 1]], "the game before the window is not counted");
  assert.deepEqual(snapshot.queues, { messages: 3, payments: 3, deletions: 2, drafts: 3, flags: 2, disliked: 2 });

  // ---- the page behind the Home route ----------------------------------------------------------
  assert.notEqual((await fetch(`${base}/admin/api/dashboard`, { redirect: "manual" })).status, 200, "anonymous visitors are turned away");
  const home = await staff.dashboard();
  assert.equal(home.status, 200);
  assert.deepEqual(home.queues, snapshot.queues);
  assert.equal(home.analyticsUrl, "https://dash.cloudflare.com/analytics-example");
  assert.ok(home.ageSeconds <= 2 && home.computedAt);
  assert.equal(home.kpis.liveRooms, 2);
  assert.equal(home.kpis.tokensInBanks, 15);

  // ---- each queue count equals the list it links to --------------------------------------------
  const ids = (rows) => rows.map((r) => r.id).sort();
  assert.equal((await staff.messages("?state=open")).rows.length, home.queues.messages);
  assert.equal((await staff.shop("?view=reviews&state=open")).rows.length, home.queues.payments);
  assert.equal((await staff.players("?view=deletions")).rows.length, home.queues.deletions);
  assert.deepEqual(ids((await staff.players("?flagged=yes")).rows), [a0, a1].sort());
  assert.equal((await staff.players("?flagged=yes")).rows.length, home.queues.flags);
  const drafts = await staff.content("?view=drafts");
  assert.deepEqual(ids(drafts.rows), [draftPacks.twoQuestions, draftPacks.empty, draftPacks.fivePlusRetired].sort());
  assert.equal(drafts.rows.length, home.queues.drafts);
  assert.deepEqual(drafts.rows.map((r) => r.filled).sort(), [0, 2, 5]);
  const disliked = await staff.content("?view=disliked");
  assert.deepEqual(ids(disliked.rows), [vote[0].question, vote[4].question].sort(), "40% of 20 and 100% of 25; 35%, 19 votes and a retired question stay out");
  assert.equal(disliked.rows.length, home.queues.disliked);
  assert.equal((await staff.content("?view=drafts&cursor=garbage")).error, "invalid_cursor");
  assert.equal((await staff.content("?view=disliked&cursor=garbage")).error, "invalid_cursor");

  // ---- cache: a hit, "Refresh now", and invalidation by a real admin change --------------------
  const insertMessage = () => o.query("INSERT INTO contact_submissions(id,request_key,request_digest,kind,support_reason,name,email,message,created_at) VALUES($1,$2,$3,'support','technical','Sender','p@example.test','Help me please',now())", [randomUUID(), randomUUID(), randomBytes(32)]);
  await insertMessage(); await insertMessage();
  assert.equal((await staff.dashboard()).queues.messages, 3, "served from the cache: the direct inserts are not seen yet");
  const refreshed = await staff.dashboard("?refresh=1");
  assert.equal(refreshed.queues.messages, 5);
  assert.equal(refreshed.ageSeconds, 0);
  assert.equal((await staff.dashboard()).queues.messages, 5);
  assert.equal((await staff.postMessages({ op: "close", id: openMessage })).status, 200);
  assert.equal((await staff.dashboard()).queues.messages, 4, "a committed admin change drops the cache");
  assert.equal((await staff.messages("?state=open")).rows.length, 4, "and the list agrees");
  const resolved = await staff.postShop({ op: "review.resolve", id: cases[0], note: "Handled in Paymob" });
  assert.equal(resolved.status, 200);
  assert.equal((await staff.dashboard()).queues.payments, 2);
  assert.equal((await staff.shop("?view=reviews&state=open")).rows.length, 2);
});

test("home: Cairo day boundaries, summer and winter time, and an empty shop", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 3, tokens: 1 });
  const o = db(f);
  const [a0, a1, a2] = f.accounts;
  const { admin } = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  await o.query("UPDATE accounts SET created_at=$2 WHERE id=$1", [a0, "2026-01-19T21:59:59.999Z"]);
  await o.query("UPDATE accounts SET created_at=$2 WHERE id=$1", [a1, "2026-01-19T22:00:00Z"]);
  await o.query("UPDATE accounts SET created_at=$2 WHERE id=$1", [a2, "2026-01-20T21:59:59.999Z"]);
  // Winter, Cairo is UTC+2: the day runs from 22:00Z to 22:00Z.
  for (const instant of ["2026-01-19T21:59:59.999Z", "2026-01-19T22:00:00Z", "2026-01-20T21:59:59.999Z", "2026-01-20T22:00:00Z"]) await seedGame(o, { host: a0, startedAt: at(instant) });
  const winter = await computeHomeSnapshot(admin.database.db, at("2026-01-20T10:00:00Z"));
  assert.equal(winter.cairoDate, "2026-01-20");
  assert.equal(winter.kpis.gamesToday, 2);
  assert.equal(winter.kpis.newAccountsToday, 2);
  assert.deepEqual(winter.trend.slice(-3).map((d) => [d.date, d.games, d.accounts]), [["2026-01-18", 0, 0], ["2026-01-19", 1, 1], ["2026-01-20", 2, 2]]);
  assert.equal(winter.kpis.salesTodayEgp, 0);
  assert.equal(winter.kpis.tokensInBanks, 3);
  assert.equal(winter.kpis.activeGames, 0);
  assert.equal(winter.kpis.liveRooms, 0);
  assert.equal(winter.kpis.anyOrder, false, "no order of any kind: checkout is not live");
  assert.deepEqual(winter.queues, { messages: 0, payments: 0, deletions: 0, drafts: 0, flags: 0, disliked: 0 });
  // The same instant is the next day at midnight in Cairo: 22:00:00Z is 00:00 on the 20th.
  const midnight = await computeHomeSnapshot(admin.database.db, at("2026-01-19T22:00:00Z"));
  assert.equal(midnight.cairoDate, "2026-01-20");
  const before = await computeHomeSnapshot(admin.database.db, at("2026-01-19T21:59:59Z"));
  assert.equal(before.cairoDate, "2026-01-19");
  // Summer, Cairo is UTC+3: the day runs from 21:00Z to 21:00Z.
  for (const instant of ["2026-07-19T20:59:59.999Z", "2026-07-19T21:00:00Z", "2026-07-20T20:59:59.999Z", "2026-07-20T21:00:00Z"]) await seedGame(o, { host: a0, startedAt: at(instant) });
  const summer = await computeHomeSnapshot(admin.database.db, at("2026-07-20T10:00:00Z"));
  assert.equal(summer.cairoDate, "2026-07-20");
  assert.equal(summer.kpis.gamesToday, 2);
  assert.deepEqual(summer.trend.slice(-2).map((d) => [d.date, d.games]), [["2026-07-19", 1], ["2026-07-20", 2]]);
});

test("home cache: hit, expiry, refresh, invalidation and the version guard", async () => {
  let now = 1_000_000;
  const calls = [];
  const snapshot = (n) => ({ cairoDate: "2026-01-15", kpis: { gamesToday: n }, trend: [], topCategories: [], queues: {} });
  const stats = new HomeStats(() => ({}), "https://example.test/analytics", () => now, async () => {
    calls.push(now);
    return snapshot(calls.length);
  });
  assert.equal((await stats.get()).kpis.gamesToday, 1);
  now += STATS_TTL_MS - 1;
  const hit = await stats.get();
  assert.equal(hit.kpis.gamesToday, 1, "a hit inside the 120 s window");
  assert.equal(hit.ageSeconds, 119);
  assert.equal(calls.length, 1);
  assert.equal(hit.analyticsUrl, "https://example.test/analytics");
  now += 1;
  assert.equal((await stats.get()).kpis.gamesToday, 2, "expired at 120 s");
  assert.equal((await stats.get({ refresh: true })).kpis.gamesToday, 3, "Refresh now bypasses the cache");
  assert.equal((await stats.get()).kpis.gamesToday, 3, "and refills it");
  stats.invalidate();
  assert.equal((await stats.get()).kpis.gamesToday, 4, "a change drops the cache");

  // Concurrent requests share one computation.
  stats.invalidate();
  const [x, y] = await Promise.all([stats.get(), stats.get()]);
  assert.equal(x.kpis.gamesToday, y.kpis.gamesToday);
  assert.equal(calls.length, 5);

  // Version guard: a computation that began before a change must not fill the cache.
  const gates = [];
  const slow = new HomeStats(() => ({}), undefined, () => now, () => new Promise((resolve) => gates.push((value) => resolve(value))) );
  const first = slow.get();
  await new Promise((r) => setImmediate(r));
  slow.invalidate(); // a change commits while the first computation is still running
  gates[0](snapshot(100)); // the stale result arrives afterwards
  assert.equal((await first).kpis.gamesToday, 100, "its own caller still gets an answer");
  const second = slow.get();
  await new Promise((r) => setImmediate(r));
  assert.equal(gates.length, 2, "the stale result was not cached, so the next request computes again");
  gates[1](snapshot(200));
  assert.equal((await second).kpis.gamesToday, 200);
  assert.equal((await slow.get()).kpis.gamesToday, 200, "a computation that finished in its own version is cached");
  assert.equal(gates.length, 2);
});
