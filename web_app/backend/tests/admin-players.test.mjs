import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { gameplayFixture } from "./gameplay/fixture.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const ADMIN = { email: "admin@example.test", password: "admin-password-123" };
const SUPER = { email: "super@example.test", password: "super-password-123" };

async function startAdmin(t, databaseUrl) {
  const admin = await createAdminApplication({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    ADMIN_SESSION_SECRET: SECRET,
    ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000",
    ADMIN_BOOTSTRAP_EMAIL: SUPER.email,
    ADMIN_BOOTSTRAP_PASSWORD: SUPER.password,
    // Small chunks make a bulk grant span several transactions.
    ADMIN_BULK_GRANT_CHUNK_SIZE: "3",
  });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function signIn(base, { email, password }) {
  const response = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email, password }), redirect: "manual" });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const read = async (query = "") => {
    const r = await fetch(`${base}/admin/api/pages/players${query}`, { headers: { Cookie: cookie } });
    return { status: r.status, ...(await r.json()) };
  };
  const post = async (body, requestKey = randomUUID()) => {
    const r = await fetch(`${base}/admin/api/pages/players`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
    return { status: r.status, body: await r.json() };
  };
  return { read, post };
}

const phone = (n) => `+2011100${String(n).padStart(5, "0")}`;

test("players: search, ledger history, credit, flags, bulk grant and deletion requests", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 3, tokens: 3 });
  const o = f.owner;
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), ADMIN.email, await hashPassword(ADMIN.password)]);
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'super_admin',$2,$3)", [randomUUID(), SUPER.email, await hashPassword(SUPER.password)]);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const admin = await signIn(base, ADMIN);
  const superAdmin = await signIn(base, SUPER);
  assert.equal((await fetch(`${base}/admin/api/pages/players`, { redirect: "manual" })).status === 200, false, "anonymous visitors are turned away");

  // Extra accounts: 28 plain ones for paging, a deleted-looking pending one, a banned later.
  for (let n = 0; n < 28; n++) await o.query("INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES($1,'Extra',$2,now())", [randomUUID(), phone(n)]);
  const [a0, a1, a2] = f.accounts;

  // ---- list, search, paging -----------------------------------------------------------------
  const first = await admin.read("");
  assert.equal(first.rows.length, 25);
  assert.ok(first.nextCursor);
  const second = await admin.read(`?cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.equal(second.rows.length, 6);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 31, "no account repeats or is skipped across pages");
  assert.equal((await admin.read("?cursor=nonsense")).error, "invalid_cursor");
  assert.equal((await admin.read("?q=01230000001")).rows[0].id, a1, "a local spelling finds the account");
  assert.equal((await admin.read("?q=%2B20%201230000002")).rows[0].id, a2);
  assert.equal((await admin.read("?q=0001")).rows.map((r) => r.id).includes(a1), true, "last digits search");
  assert.equal((await admin.read("?q=12")).error, "invalid_search");
  assert.equal((await admin.read("?state=bogus")).error, "invalid_filter");

  // ---- detail and ledger history ------------------------------------------------------------
  let detail = await admin.read(`?view=account&id=${a0}`);
  assert.equal(detail.account.tokenBalance, 3);
  assert.equal(detail.account.gamesHosted, 0);
  assert.match(detail.ledger[0].label, /^Complimentary credit by race@example.invalid: Disposable fixture$/);
  assert.equal((await admin.read(`?view=account&id=${randomUUID()}`)).error, "not_found");

  // ---- complimentary credit -----------------------------------------------------------------
  const key = randomUUID();
  const credited = await admin.post({ op: "credit", id: a0, quantity: 5, reason: "Apology for the outage" }, key);
  assert.equal(credited.status, 200, JSON.stringify(credited.body));
  assert.equal(credited.body.tokenBalance, 8);
  assert.deepEqual((await admin.post({ op: "credit", id: a0, quantity: 5, reason: "Apology for the outage" }, key)).body, { replayed: true });
  assert.equal((await o.query("SELECT token_balance FROM accounts WHERE id=$1", [a0])).rows[0].token_balance, 8, "a replay credits nothing more");
  const ledger = (await o.query("SELECT l.amount, l.reason_text, e.action_code, e.reason, e.target_key FROM token_ledger_entries l JOIN staff_audit_events e ON e.id=l.staff_audit_event_id WHERE e.request_key=$1", [key])).rows;
  assert.deepEqual(ledger, [{ amount: 5, reason_text: "Apology for the outage", action_code: "token_grant", reason: "Apology for the outage", target_key: a0 }]);
  assert.equal((await admin.post({ op: "credit", id: a0, quantity: 5, reason: "  " })).body.error, "reason_required");
  for (const quantity of [0, -3, 1001, 1.5, "abc", undefined]) assert.equal((await admin.post({ op: "credit", id: a0, quantity, reason: "x" })).body.error, "invalid_quantity", String(quantity));
  assert.equal((await admin.post({ op: "credit", id: randomUUID(), quantity: 1, reason: "x" })).status, 404);
  assert.equal((await o.query("SELECT token_balance FROM accounts WHERE id=$1", [a0])).rows[0].token_balance, 8, "refused credits changed nothing");
  detail = await admin.read(`?view=account&id=${a0}`);
  assert.equal(detail.ledger[0].label, "Complimentary credit by admin@example.test: Apology for the outage");
  // The bank cannot be edited around the ledger (ADR 0010).
  await assert.rejects(o.query("UPDATE accounts SET token_balance = 99 WHERE id=$1", [a0]));
  // Both roles are allowed (ADR 0008).
  assert.equal((await superAdmin.post({ op: "credit", id: a1, quantity: 1, reason: "Super credit" })).status, 200);

  // Ledger history: game debits, restorations, gifts and purchases read in plain words, and it pages.
  await o.query("INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES($1,'Pager',$2,now())", [randomUUID(), phone(900)]);
  const pager = (await o.query("SELECT id FROM accounts WHERE phone_e164=$1", [phone(900)])).rows[0].id;
  const staff = (await o.query("SELECT id FROM staff_accounts WHERE normalized_email=$1", [ADMIN.email])).rows[0].id;
  for (let n = 0; n < 27; n++) {
    const audit = randomUUID();
    await o.query("INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'token_grant','account',$3,$4,'Paging fixture')", [audit, staff, pager, randomUUID()]);
    await o.query("INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text) VALUES($1,$2,'credit',1,$3,$4,'Paging fixture')", [randomUUID(), pager, randomUUID(), audit]);
  }
  const page1 = await admin.read(`?view=account&id=${pager}`);
  assert.equal(page1.ledger.length, 25);
  const page2 = await admin.read(`?view=account&id=${pager}&cursor=${encodeURIComponent(page1.nextCursor)}`);
  assert.equal(page2.ledger.length, 2);
  assert.equal(page2.nextCursor, null);

  // ---- flags: notes that restrict nothing ---------------------------------------------------
  assert.equal((await admin.post({ op: "flag.add", id: a2, note: " " })).body.error, "note_required");
  const flagKey = randomUUID();
  const flag = await admin.post({ op: "flag.add", id: a2, note: "Suspected payment abuse" }, flagKey);
  assert.equal(flag.status, 200);
  assert.deepEqual((await admin.post({ op: "flag.add", id: a2, note: "Suspected payment abuse" }, flagKey)).body, { replayed: true });
  assert.equal((await o.query("SELECT count(*)::int AS n FROM account_flags WHERE account_id=$1", [a2])).rows[0].n, 1);
  assert.equal((await admin.read("?flagged=yes")).rows.map((r) => r.id).join(), a2);
  assert.equal((await admin.read(`?view=account&id=${a2}`)).account.openFlags, 1);
  const flagged = await f.create(2);
  assert.ok(flagged.roomId, "a flagged account still hosts");
  assert.equal((await admin.post({ op: "flag.resolve", id: flag.body.id })).status, 200);
  assert.equal((await admin.post({ op: "flag.resolve", id: flag.body.id })).body.error, "already_resolved");
  assert.equal((await admin.read("?flagged=yes")).rows.length, 0);

  // ---- bulk grant ---------------------------------------------------------------------------
  const before = (await o.query("SELECT sum(token_balance)::int AS n FROM accounts")).rows[0].n;
  const list = `${phone(1)}\n0${phone(2).slice(3)}, ${phone(3)}\n+201999999999\nnot-a-number\n${phone(1)}`;
  const preview = await admin.post({ op: "bulk.preview", target: "phone_list", phones: list });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.accounts, 3);
  assert.equal(preview.body.numbers, 4, "duplicates and spellings collapse to one number each");
  assert.deepEqual(preview.body.notFound, ["+201999999999"]);
  assert.deepEqual(preview.body.invalid, ["not-a-number"]);
  assert.equal((await o.query("SELECT sum(token_balance)::int AS n FROM accounts")).rows[0].n, before, "a preview changes nothing");
  assert.equal((await admin.post({ op: "bulk.grant", target: "phone_list", phones: list, quantity: 2, reason: " " })).body.error, "reason_required");
  assert.equal((await admin.post({ op: "bulk.grant", target: "phone_list", phones: "", quantity: 2, reason: "x" })).body.error, "no_numbers");
  const listKey = randomUUID();
  const listGrant = await admin.post({ op: "bulk.grant", target: "phone_list", phones: list, quantity: 2, reason: "Launch gift" }, listKey);
  assert.equal(listGrant.status, 200, JSON.stringify(listGrant.body));
  assert.deepEqual({ targetCount: listGrant.body.targetCount, grantedCount: listGrant.body.grantedCount, completed: listGrant.body.completed }, { targetCount: 3, grantedCount: 3, completed: true });
  assert.equal((await admin.post({ op: "bulk.grant", target: "phone_list", phones: list, quantity: 2, reason: "Launch gift" }, listKey)).body.grantedCount, 3, "a retry reports the same result");
  assert.equal((await o.query("SELECT sum(token_balance)::int AS n FROM accounts")).rows[0].n, before + 6, "a retry credits nothing twice");
  assert.equal((await o.query("SELECT count(*)::int AS n FROM staff_audit_events WHERE action_code='token_bulk_grant'")).rows[0].n, 1, "one audit event");

  // Every active, unbanned account; chunks of 3 make this many transactions. The banned one is skipped.
  const [banned] = (await o.query("SELECT id FROM accounts WHERE phone_e164=$1", [phone(10)])).rows;
  assert.equal((await admin.post({ op: "ban", id: banned.id, reason: "Abuse" })).status, 200);
  await o.query("UPDATE accounts SET state='deletion_pending' WHERE phone_e164=$1", [phone(11)]);
  const eligible = (await o.query("SELECT count(*)::int AS n FROM accounts WHERE state='active' AND id<>$1", [banned.id])).rows[0].n;
  assert.equal((await admin.post({ op: "bulk.preview", target: "all_active" })).body.accounts, eligible);
  const allKey = randomUUID();
  const all = await admin.post({ op: "bulk.grant", target: "all_active", quantity: 1, reason: "Anniversary" }, allKey);
  assert.equal(all.body.grantedCount, eligible);
  assert.equal(all.body.completed, true);
  assert.deepEqual((await admin.post({ op: "bulk.resume", id: all.body.id })).body, { id: all.body.id, targetCount: eligible, grantedCount: eligible, completed: true });
  await admin.post({ op: "bulk.grant", target: "all_active", quantity: 1, reason: "Anniversary" }, allKey);
  const rows = (await o.query("SELECT count(*)::int AS n, count(DISTINCT account_id)::int AS accounts, count(DISTINCT staff_audit_event_id)::int AS events FROM token_ledger_entries WHERE idempotency_key LIKE 'bulk:' || $1 || ':%'", [all.body.id])).rows[0];
  assert.deepEqual(rows, { n: eligible, accounts: eligible, events: 1 }, "one credit per account, all under one audit event");
  assert.equal((await o.query("SELECT token_balance FROM accounts WHERE id=$1", [banned.id])).rows[0].token_balance, 0, "a banned account is skipped");
  const audit = (await o.query("SELECT details, reason FROM staff_audit_events WHERE target_key=$1", [all.body.id])).rows[0];
  assert.equal(audit.details.accounts, eligible);
  assert.equal(audit.reason, "Anniversary");
  // An interrupted run carries on from its durable cursor and credits nobody twice.
  const partial = randomUUID();
  const resumeKey = randomUUID();
  const resumeAudit = randomUUID();
  await o.query("INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'token_bulk_grant','bulk_grant',$3,$4,'Interrupted')", [resumeAudit, staff, partial, resumeKey]);
  const ordered = (await o.query("SELECT id FROM accounts WHERE state='active' AND id<>$1 ORDER BY id", [banned.id])).rows.map((r) => r.id);
  await o.query("INSERT INTO bulk_grants(id,request_key,audit_event_id,target_kind,quantity,reason,target_count,granted_count,last_account_id,created_by) VALUES($1,$2,$3,'all_active',1,'Interrupted',$4,3,$5,$6)", [partial, resumeKey, resumeAudit, eligible, ordered[2], staff]);
  for (const id of ordered.slice(0, 3)) await o.query("INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text) VALUES($1,$2,'credit',1,$3,$4,'Interrupted')", [randomUUID(), id, `bulk:${partial}:${id}`, resumeAudit]);
  const resumed = await admin.post({ op: "bulk.resume", id: partial });
  assert.equal(resumed.body.completed, true);
  assert.equal(resumed.body.grantedCount, eligible);
  assert.equal((await o.query("SELECT count(*)::int AS n FROM token_ledger_entries WHERE staff_audit_event_id=$1", [resumeAudit])).rows[0].n, eligible);
  assert.equal((await admin.read("?view=bulk")).grants.length, 3);
  assert.match((await admin.read(`?view=account&id=${a1}`)).ledger.map((e) => e.label).join("\n"), /Complimentary credit \(bulk grant\) by admin@example.test: Anniversary/);

  // ---- deletion requests are listed, read-only ----------------------------------------------
  assert.deepEqual((await admin.read("?view=deletions")).rows, []);
  const pending = (await o.query("SELECT id FROM accounts WHERE phone_e164=$1", [phone(11)])).rows[0].id;
  await o.query("INSERT INTO account_deletion_requests(id,account_id,request_key,requested_at) VALUES($1,$2,$3,now())", [randomUUID(), pending, randomUUID()]);
  const deletions = await admin.read("?view=deletions");
  assert.equal(deletions.rows.length, 1);
  assert.equal(deletions.rows[0].phone, phone(11));
  assert.equal((await admin.post({ op: "deletion.complete", id: pending })).body.error, "unknown_operation");

  // ---- every mutation was audited -----------------------------------------------------------
  const actions = (await o.query("SELECT DISTINCT action_code FROM staff_audit_events WHERE action_code IN ('token_grant','token_bulk_grant','account.ban','account.flag','account.flag.resolve') ORDER BY 1")).rows.map((r) => r.action_code);
  assert.deepEqual(actions, ["account.ban", "account.flag", "account.flag.resolve", "token_bulk_grant", "token_grant"]);
});

test("ban: blocks signing in, hosting, joining and starting; a running game continues; unban restores", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 6, tokens: 3 });
  const o = f.owner;
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), ADMIN.email, await hashPassword(ADMIN.password)]);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const admin = await signIn(base, ADMIN);
  const [, , , h3, h4, h5] = f.accounts;
  const ban = (id) => admin.post({ op: "ban", id, reason: "Terms violation" });
  const unban = (id) => admin.post({ op: "unban", id, reason: "Appeal accepted" });
  const refused = (r) => {
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.code, "ACCOUNT_BANNED");
  };

  assert.equal((await admin.post({ op: "ban", id: h5, reason: "" })).body.error, "reason_required");
  assert.equal((await admin.post({ op: "unban", id: h5, reason: "x" })).body.error, "not_banned");
  const key = randomUUID();
  assert.equal((await admin.post({ op: "ban", id: h5, reason: "Terms violation" }, key)).status, 200);
  assert.deepEqual((await admin.post({ op: "ban", id: h5, reason: "Terms violation" }, key)).body, { replayed: true });
  assert.equal((await ban(h5)).body.error, "already_banned");
  assert.equal((await admin.read("?banned=yes")).rows.map((r) => r.id).join(), h5);
  const view = await admin.read(`?view=account&id=${h5}`);
  assert.equal(view.account.banned, true);
  assert.equal(view.bans[0].reason, "Terms violation");

  // Signing in and hosting are refused for a banned account outside a running game.
  refused(await f.call("GET", "/rooms/current", undefined, { account: 5 }));
  refused(await f.call("POST", "/rooms", { teamOneName: "A", teamTwoName: "B", hostTeamNumber: null, selections: f.selections, proposedControlSecret: "x".repeat(43) }, { account: 5 }));
  // Guests are unaffected, and so is everybody else.
  assert.equal((await f.call("GET", "/rooms/current", undefined, { account: 4 })).status, 200);

  // Unban restores the account, and the history keeps both events.
  assert.equal((await unban(h5)).status, 200);
  assert.equal((await f.call("GET", "/rooms/current", undefined, { account: 5 })).status, 200);
  assert.ok((await f.create(5)).roomId);
  const history = (await admin.read(`?view=account&id=${h5}`)).bans;
  assert.equal(history.length, 1);
  assert.equal(history[0].liftReason, "Appeal accepted");
  assert.equal((await admin.read("?banned=yes")).rows.length, 0);
  assert.equal((await ban(h5)).status, 200, "an account can be banned again after a lift");
  assert.equal((await unban(h5)).status, 200);

  // Joining: an account banned before joining is refused; a guest joins freely.
  const hostRoom = await f.create(3);
  const invitation = await f.call("GET", `/rooms/${hostRoom.roomId}/invitation`, undefined, { account: 3, control: hostRoom.control });
  const joinAs = (account) => f.call("POST", `/room-invitations/${invitation.body.code}/memberships`, { identity: "account", displayName: "Member", teamNumber: 1 }, { account });
  assert.equal((await ban(h4)).status, 200);
  refused(await joinAs(4));
  const guest = await f.call("POST", `/room-invitations/${invitation.body.code}/memberships`, { identity: "anonymous", displayName: "Guest", teamNumber: 2, reconnectSecret: "g".repeat(43) }, { authorization: "" });
  assert.equal(guest.status, 201, "guests are unaffected");
  assert.equal((await unban(h4)).status, 200);
  const joined = await joinAs(4);
  assert.equal(joined.status, 201, JSON.stringify(joined.body));

  // Starting: a member banned after joining blocks the new game; unban lets it start.
  const snapshot = await f.call("GET", `/rooms/${hostRoom.roomId}`, undefined, { account: 3, control: hostRoom.control });
  const memberReady = await f.call("PUT", `/rooms/${hostRoom.roomId}/memberships/me/readiness`, { expectedMembershipVersion: "0", expectedReadyGeneration: snapshot.body.view.readyGeneration, ready: true }, { account: 4 });
  assert.equal(memberReady.status, 200, JSON.stringify(memberReady.body));
  const guestAuthorization = `Bearer g.${guest.body.membershipId}.${"g".repeat(43)}`;
  const guestReady = await f.call("PUT", `/rooms/${hostRoom.roomId}/memberships/me/readiness`, { expectedMembershipVersion: "0", expectedReadyGeneration: memberReady.body.readyGeneration, ready: true }, { authorization: guestAuthorization });
  assert.equal(guestReady.status, 200, JSON.stringify(guestReady.body));
  const room = await f.call("GET", `/rooms/${hostRoom.roomId}`, undefined, { account: 3, control: hostRoom.control });
  const start = () => f.call("POST", `/rooms/${hostRoom.roomId}/games`, { expectedRoomVersion: room.body.source.roomVersion, expectedReadyGeneration: room.body.view.readyGeneration }, { account: 3, control: hostRoom.control });
  assert.equal((await ban(h4)).status, 200);
  refused(await start());
  assert.equal((await o.query("SELECT count(*)::int AS n FROM games WHERE host_account_id=$1", [h3])).rows[0].n, 0, "no game started");
  assert.equal((await unban(h4)).status, 200);
  const started = await start();
  assert.equal(started.status, 201, JSON.stringify(started.body));

  // A game the account is already in may finish: a ban changes nothing for it.
  assert.equal((await ban(h3)).status, 200);
  const gameId = started.body.gameId;
  let version = started.body.gameVersion;
  const opened = await f.call("POST", `/games/${gameId}/commands`, { name: "open_question", expectedGameVersion: version, boardPosition: 1, questionPosition: 1 }, { account: 3, control: hostRoom.control });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  version = opened.body.gameVersion;
  assert.equal((await f.call("GET", `/games/${gameId}`, undefined, { account: 3, control: hostRoom.control })).status, 200);
  assert.equal((await f.call("POST", `/games/${gameId}/commands`, { name: "end_game", expectedGameVersion: version }, { account: 3, control: hostRoom.control })).status, 200);
  // Once it is over the ban applies again, and the bank was kept.
  refused(await f.call("GET", "/rooms/current", undefined, { account: 3 }));
  assert.equal((await o.query("SELECT token_balance FROM accounts WHERE id=$1", [h3])).rows[0].token_balance, 2);
  assert.equal((await unban(h3)).status, 200);
  assert.equal((await f.call("GET", "/rooms/current", undefined, { account: 3 })).status, 200);

  const actions = (await o.query("SELECT action_code, count(*)::int AS n FROM staff_audit_events WHERE action_code IN ('account.ban','account.unban') GROUP BY 1 ORDER BY 1")).rows;
  assert.deepEqual(actions.map((r) => r.action_code), ["account.ban", "account.unban"]);
});
