import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { gameplayFixture } from "./gameplay/fixture.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const ADMIN = { email: "admin@example.test", password: "admin-password-123" };

/** A local stand-in for Resend that remembers every request and answers a repeated Idempotency-Key with the first result. */
async function resendStub(t) {
  const stub = { calls: [], mode: "ok", delivered: new Map() };
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const body = JSON.parse(raw);
      const key = request.headers["idempotency-key"];
      stub.calls.push({ url: request.url, auth: request.headers.authorization, key, body });
      const reply = (status, payload) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(payload)); };
      if (stub.mode === "denied") return reply(403, { message: "The domain is not verified" });
      if (stub.mode === "rejected") return reply(422, { message: "Invalid `to` field" });
      if (stub.mode === "down") return reply(503, { message: "try later" });
      if (!stub.delivered.has(key)) stub.delivered.set(key, `re_${randomUUID()}`);
      reply(200, { id: stub.delivered.get(key) });
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  stub.url = `http://127.0.0.1:${server.address().port}`;
  return stub;
}

async function startAdmin(t, databaseUrl, extra = {}) {
  const admin = await createAdminApplication({ NODE_ENV: "test", DATABASE_URL: databaseUrl, ADMIN_SESSION_SECRET: SECRET, ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000", ...extra });
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
    const r = await fetch(`${base}/admin/api/pages/messages${query}`, { headers: { Cookie: cookie } });
    return { status: r.status, ...(await r.json()) };
  };
  const post = async (body, requestKey = randomUUID()) => {
    const r = await fetch(`${base}/admin/api/pages/messages`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
    return { status: r.status, body: await r.json() };
  };
  return { read, post };
}

const MINUTE = 60000;

test("messages: inbox, replies by email, mailto fallback, close and reopen", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  const o = f.owner;
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), ADMIN.email, await hashPassword(ADMIN.password)]);
  const seed = async (kind, over = {}, minutesAgo = 0) => {
    const id = randomUUID();
    const row = {
      support: { support_reason: "technical", business_kind: null, email: "player@example.test", message: "The game froze on the second question.", rating: null },
      business: { support_reason: null, business_kind: "business", email: "shop@example.test", message: "We would like to sponsor a pack.", rating: null },
      experience: { support_reason: null, business_kind: null, email: null, message: "Great evening!", rating: 5 },
      ...{}
    }[kind];
    const v = { ...row, name: "Sender", handle: null, account_id: null, ...over };
    await o.query(
      "INSERT INTO contact_submissions(id,request_key,request_digest,account_id,kind,support_reason,business_kind,name,email,handle,message,rating,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [id, randomUUID(), randomBytes(32), v.account_id, kind, v.support_reason, v.business_kind, v.name, v.email, v.handle, v.message, v.rating, new Date(Date.now() - minutesAgo * MINUTE)],
    );
    return id;
  };
  const audit = async (action) => (await o.query("SELECT * FROM staff_audit_events WHERE action_code=$1 ORDER BY created_at", [action])).rows;
  const replies = async (id) => (await o.query("SELECT * FROM contact_replies WHERE contact_id=$1 ORDER BY created_at", [id])).rows;

  const stub = await resendStub(t);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"), { RESEND_API_KEY: "re_test_key", SUPPORT_FROM_EMAIL: "Sahsah Support <support@example.test>", SUPPORT_REPLY_TO: "help@example.test", RESEND_API_URL: stub.url });
  const admin = await signIn(base, ADMIN);
  assert.equal((await fetch(`${base}/admin/api/pages/messages`, { redirect: "manual" })).status === 200, false, "anonymous visitors are turned away");

  // ---- list, filters, paging ----------------------------------------------------------------
  const accountId = f.accounts[0];
  const supportId = await seed("support", { account_id: accountId, message: "Line one\n<b>bold</b> & more" }, 5);
  const businessId = await seed("business", { business_kind: "influencer", handle: "@creator" }, 4);
  const experienceId = await seed("experience", {}, 3);
  const noEmailId = await seed("experience", { message: "Only a rating", rating: 2 }, 2);
  const closedId = await seed("support", { support_reason: "purchase" }, 1);
  await o.query("UPDATE contact_submissions SET state='closed', closed_at=now(), closed_by_staff_id=(SELECT id FROM staff_accounts WHERE normalized_email=$1) WHERE id=$2", [ADMIN.email, closedId]);

  let list = await admin.read("");
  assert.equal(list.rows.length, 5);
  assert.deepEqual(list.rows.map((r) => r.id), [closedId, noEmailId, experienceId, businessId, supportId], "newest first");
  assert.equal(list.rows[0].preview, "The game froze on the second question.");
  assert.equal((await admin.read("?state=open")).rows.length, 4);
  assert.deepEqual((await admin.read("?state=closed")).rows.map((r) => r.id), [closedId]);
  assert.deepEqual((await admin.read("?kind=business")).rows.map((r) => r.id), [businessId]);
  assert.deepEqual((await admin.read("?kind=support&state=open")).rows.map((r) => r.id), [supportId]);
  assert.equal((await admin.read("?kind=nonsense")).error, "invalid_filter");
  assert.equal((await admin.read("?state=nonsense")).error, "invalid_filter");
  assert.equal((await admin.read("?cursor=garbage")).error, "invalid_cursor");
  for (let i = 0; i < 24; i++) await seed("support", {}, 100 + i);
  const page1 = await admin.read("");
  assert.equal(page1.rows.length, 25);
  assert.ok(page1.nextCursor);
  const page2 = await admin.read(`?cursor=${encodeURIComponent(page1.nextCursor)}`);
  assert.equal(page2.rows.length, 4);
  assert.equal(page2.nextCursor, null);
  assert.equal(new Set([...page1.rows, ...page2.rows].map((r) => r.id)).size, 29, "no row repeats across pages");

  // ---- detail -------------------------------------------------------------------------------
  const detail = await admin.read(`?view=message&id=${supportId}`);
  assert.equal(detail.message.email, "player@example.test");
  assert.equal(detail.message.supportReason, "technical");
  assert.equal(detail.subject, "Re: Your Sahsah support request (technical)");
  assert.equal(detail.emailConfigured, true);
  assert.equal(detail.replyBlocked, null);
  assert.equal(detail.message.accountId, accountId);
  assert.match(detail.message.accountPhone, /^\+2012300/);
  assert.deepEqual(detail.replies, []);
  assert.equal((await admin.read(`?view=message&id=${randomUUID()}`)).status, 404);
  assert.equal((await admin.read(`?view=message&id=nope`)).status, 404);
  assert.equal((await admin.read(`?view=message&id=${experienceId}`)).replyBlocked, "experience");
  assert.equal((await admin.read(`?view=message&id=${businessId}`)).message.handle, "@creator");

  // ---- reply by email -----------------------------------------------------------------------
  const key = randomUUID();
  const sent = await admin.post({ op: "reply", id: supportId, body: "Thanks!\nWe fixed it & <deployed> it." }, key);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal(sent.body.status, "sent");
  assert.equal(stub.calls.length, 1);
  const call = stub.calls[0];
  assert.equal(call.url, "/emails");
  assert.equal(call.auth, "Bearer re_test_key");
  assert.ok(call.key.length > 10 && call.key.length <= 256);
  assert.deepEqual(call.body.to, ["player@example.test"]);
  assert.equal(call.body.from, "Sahsah Support <support@example.test>");
  assert.equal(call.body.reply_to, "help@example.test");
  assert.equal(call.body.subject, "Re: Your Sahsah support request (technical)");
  assert.match(call.body.text, /^Thanks!\nWe fixed it & <deployed> it\./);
  assert.match(call.body.text, /> Line one\n> <b>bold<\/b> & more/);
  assert.ok(call.body.html.includes("We fixed it &amp; &lt;deployed&gt; it."), "reply is escaped in the HTML");
  assert.ok(call.body.html.includes("&lt;b&gt;bold&lt;/b&gt;"), "the quoted original is escaped too");
  assert.ok(!/<deployed>|<b>bold/.test(call.body.html));
  let stored = await replies(supportId);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "sent");
  assert.match(stored[0].provider_message_id, /^re_/);
  assert.ok(stored[0].completed_at);
  assert.equal((await audit("message.reply")).length, 1);

  // A replay of the same request returns the stored result and sends nothing.
  const replay = await admin.post({ op: "reply", id: supportId, body: "Thanks!\nWe fixed it & <deployed> it." }, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.status, "sent");
  assert.equal(stub.calls.length, 1, "a replay never sends again");
  assert.equal((await replies(supportId)).length, 1);

  // A request that never finished (the service died after the transaction) is completed on retry with the same Idempotency-Key.
  const unfinished = randomUUID(), unfinishedAudit = randomUUID(), unfinishedReply = randomUUID();
  const staffId = (await o.query("SELECT id FROM staff_accounts WHERE normalized_email=$1", [ADMIN.email])).rows[0].id;
  await o.query("INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key) VALUES($1,$2,'message.reply','contact_message',$3,$4)", [unfinishedAudit, staffId, businessId, unfinished]);
  await o.query("INSERT INTO contact_replies(id,contact_id,staff_id,request_key,audit_event_id,body,status) VALUES($1,$2,$3,$4,$5,'We would love that.','sending')", [unfinishedReply, businessId, staffId, unfinished, unfinishedAudit]);
  const resumed = await admin.post({ op: "reply", id: businessId, body: "We would love that." }, unfinished);
  assert.equal(resumed.body.status, "sent");
  assert.equal(stub.calls.length, 2);
  assert.equal(stub.calls[1].key, `support-reply-${unfinishedReply}`);
  assert.equal(stub.calls[1].body.subject, "Re: Your Sahsah partnership enquiry");
  assert.equal((await admin.post({ op: "reply", id: businessId, body: "We would love that." }, unfinished)).status, 200);
  assert.equal(stub.calls.length, 2);
  // The same key cannot be reused for another message.
  assert.equal((await admin.post({ op: "reply", id: supportId, body: "x" }, unfinished)).body.error, "invalid_request");

  // ---- provider failures are stored truthfully and can be retried ---------------------------
  const failures = [["denied", "provider_denied", 502], ["rejected", "provider_rejected", 502], ["down", "provider_unavailable", 502]];
  for (const [mode, code, status] of failures) {
    stub.mode = mode;
    const attempt = randomUUID();
    const failed = await admin.post({ op: "reply", id: supportId, body: `Try ${mode}` }, attempt);
    assert.equal(failed.status, status);
    assert.equal(failed.body.error, code);
    const row = (await replies(supportId)).find((r) => r.request_key === attempt);
    assert.equal(row.status, "failed");
    assert.equal(row.error_code, code);
    assert.equal(row.provider_message_id, null);
    // Repeating the same request reports the same stored failure and does not call the provider again.
    const calls = stub.calls.length;
    assert.equal((await admin.post({ op: "reply", id: supportId, body: `Try ${mode}` }, attempt)).body.error, code);
    assert.equal(stub.calls.length, calls);
  }
  stub.mode = "ok";
  const retried = await admin.post({ op: "reply", id: supportId, body: "Try again" });
  assert.equal(retried.body.status, "sent", "after a failure staff can send again");
  const thread = (await admin.read(`?view=message&id=${supportId}`)).replies;
  assert.deepEqual(thread.map((r) => r.status), ["sent", "failed", "failed", "failed", "sent"]);
  assert.ok(thread.every((r) => r.staffEmail === ADMIN.email));
  assert.equal(JSON.stringify(await o.query("SELECT details FROM staff_audit_events WHERE action_code='message.reply'").then((r) => r.rows)).includes("player@example.test"), false, "audit details hold no address");

  // ---- refusals -----------------------------------------------------------------------------
  assert.equal((await admin.post({ op: "reply", id: experienceId, body: "Hi" })).body.error, "reply_not_allowed");
  assert.equal((await admin.post({ op: "reply.external", id: experienceId })).body.error, "reply_not_allowed");
  const callsBefore = stub.calls.length;
  assert.equal((await admin.post({ op: "reply", id: supportId, body: "   " })).body.error, "body_required");
  assert.equal((await admin.post({ op: "reply", id: supportId, body: "x".repeat(5001) })).body.error, "body_too_long");
  assert.equal((await admin.post({ op: "reply", id: randomUUID(), body: "Hi" })).status, 404);
  assert.equal(stub.calls.length, callsBefore);

  // ---- close and reopen ---------------------------------------------------------------------
  const closeKey = randomUUID();
  const closed = await admin.post({ op: "close", id: supportId }, closeKey);
  assert.equal(closed.body.state, "closed");
  const row = (await o.query("SELECT state, closed_at, closed_by_staff_id FROM contact_submissions WHERE id=$1", [supportId])).rows[0];
  assert.equal(row.state, "closed");
  assert.equal(row.closed_by_staff_id, staffId);
  assert.equal((await audit("message.close")).length, 1);
  assert.equal((await admin.post({ op: "close", id: supportId }, closeKey)).body.replayed, true);
  assert.equal((await audit("message.close")).length, 1, "a replay adds no second event");
  assert.equal((await admin.post({ op: "close", id: supportId })).body.error, "already_closed");
  assert.equal((await admin.read(`?view=message&id=${supportId}`)).message.closedBy, ADMIN.email);
  const reopened = await admin.post({ op: "reopen", id: supportId });
  assert.equal(reopened.body.state, "open");
  assert.equal((await audit("message.reopen")).length, 1);
  const after = (await o.query("SELECT state, closed_at, closed_by_staff_id FROM contact_submissions WHERE id=$1", [supportId])).rows[0];
  assert.deepEqual([after.state, after.closed_at, after.closed_by_staff_id], ["open", null, null]);
  assert.equal((await admin.post({ op: "reopen", id: supportId })).body.error, "already_open");
  // Experience feedback can be closed even though it cannot be answered.
  assert.equal((await admin.post({ op: "close", id: experienceId })).body.state, "closed");
  assert.equal((await admin.post({ op: "nonsense" })).body.error, "unknown_operation");
});

test("messages: without a Resend key the reply is recorded as answered from an email app", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  const o = f.owner;
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), ADMIN.email, await hashPassword(ADMIN.password)]);
  const id = randomUUID();
  await o.query("INSERT INTO contact_submissions(id,request_key,request_digest,kind,support_reason,email,message,created_at) VALUES($1,$2,$3,'support','account','player@example.test','I cannot sign in.',now())", [id, randomUUID(), randomBytes(32)]);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const admin = await signIn(base, ADMIN);

  const detail = await admin.read(`?view=message&id=${id}`);
  assert.equal(detail.emailConfigured, false, "the page can tell staff plainly that email is not set up");
  assert.equal(detail.replyBlocked, null);
  const refused = await admin.post({ op: "reply", id, body: "Hello" });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error, "email_not_configured");
  assert.equal((await o.query("SELECT count(*)::int AS n FROM contact_replies")).rows[0].n, 0, "nothing is recorded for a reply that was not sent");

  const key = randomUUID();
  const marked = await admin.post({ op: "reply.external", id, note: "Answered by phone call link" }, key);
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  assert.equal(marked.body.status, "external");
  const rows = (await o.query("SELECT status, body, provider_message_id, error_code, completed_at FROM contact_replies WHERE contact_id=$1", [id])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "external");
  assert.equal(rows[0].body, "Answered by phone call link");
  assert.equal(rows[0].provider_message_id, null);
  assert.ok(rows[0].completed_at);
  assert.equal((await admin.post({ op: "reply.external", id, note: "Answered by phone call link" }, key)).body.status, "external");
  assert.equal((await o.query("SELECT count(*)::int AS n FROM contact_replies")).rows[0].n, 1, "a replay records nothing twice");
  assert.equal((await o.query("SELECT count(*)::int AS n FROM staff_audit_events WHERE action_code='message.reply'")).rows[0].n, 1);
  const noNote = await admin.post({ op: "reply.external", id });
  assert.equal(noNote.body.status, "external");
  const thread = (await admin.read(`?view=message&id=${id}`)).replies;
  assert.deepEqual(thread.map((r) => r.status), ["external", "external"]);
  assert.equal((await admin.read("")).rows[0].replied, true);
});

test("messages: a Resend key without a sender address is refused at startup", async (t) => {
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  await assert.rejects(createAdminApplication({ NODE_ENV: "test", DATABASE_URL: f.pg.url("sahsah_app", "sahsah_gameplay_races"), ADMIN_SESSION_SECRET: SECRET, RESEND_API_KEY: "re_x" }), /SUPPORT_FROM_EMAIL/);
});
