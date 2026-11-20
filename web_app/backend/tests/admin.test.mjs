import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { cluster } from "./database/cluster.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const BOOTSTRAP = { email: "owner@example.test", password: "owner-password-123" };

async function setup(t, name) {
  const cleanup = [];
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database(name);
  const running = [];
  t.after(async () => {
    for (const server of running) await server.close();
    await owner.end();
    for (const fn of cleanup) await fn();
  });
  const start = async (overrides = {}) => {
    const admin = await createAdminApplication({
      NODE_ENV: "test",
      DATABASE_URL: pg.url("sahsah_app", name),
      ADMIN_SESSION_SECRET: SECRET,
      // AdminJS counts attempts per address across this whole test process.
      ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000",
      ADMIN_BOOTSTRAP_EMAIL: BOOTSTRAP.email,
      ADMIN_BOOTSTRAP_PASSWORD: BOOTSTRAP.password,
      ...overrides,
    });
    const server = admin.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const handle = {
      admin,
      base: `http://127.0.0.1:${server.address().port}`,
      close: async () => {
        await new Promise((resolve) => server.close(resolve));
        await admin.close();
      },
    };
    running.push(handle);
    return handle;
  };
  return { owner, start };
}

async function login(base, email, password) {
  const response = await fetch(`${base}/admin/login`, {
    method: "POST",
    body: new URLSearchParams({ email, password }),
    redirect: "manual",
  });
  return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

const call = (base, cookie, page, { method = "GET", body, query = "" } = {}) =>
  fetch(`${base}/admin/api/pages/${page}${query}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify({ requestKey: randomUUID(), ...body }) : undefined,
    redirect: "manual",
  });

test("staff sign in against the database and anonymous visitors are turned away", { timeout: 120000 }, async (t) => {
  const { start } = await setup(t, "sahsah_admin_login");
  const { base } = await start();
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: "ok", service: "sahsah-admin" });
  const anonymous = await fetch(`${base}/admin`, { redirect: "manual" });
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get("location"), "/admin/login");
  assert.match(await (await fetch(`${base}/admin/login`)).text(), /Sahsah Admin/);
  assert.notEqual((await fetch(`${base}/admin/api/pages/audit-log`, { redirect: "manual" })).status, 200);

  const wrong = await login(base, BOOTSTRAP.email, "not-the-password");
  assert.notEqual(wrong.response.status, 302);
  assert.equal(wrong.cookie, undefined);
  const unknown = await login(base, "nobody@example.test", BOOTSTRAP.password);
  assert.equal(unknown.cookie, undefined);

  const ok = await login(base, ` ${BOOTSTRAP.email.toUpperCase()} `, BOOTSTRAP.password);
  assert.equal(ok.response.status, 302);
  const cookie = ok.response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/admin/i);
  assert.equal((await fetch(`${base}/admin`, { headers: { Cookie: ok.cookie }, redirect: "manual" })).status, 200);
});

test("repeated wrong passwords lock the account out for a while", { timeout: 120000 }, async (t) => {
  const { start } = await setup(t, "sahsah_admin_lockout");
  const { base } = await start();
  for (let attempt = 0; attempt < 5; attempt++) await login(base, BOOTSTRAP.email, "wrong-password-123");
  const locked = await login(base, BOOTSTRAP.email, BOOTSTRAP.password);
  assert.equal(locked.cookie, undefined);
  assert.notEqual(locked.response.status, 302);
});

test("the first Super Admin is created from the environment on first boot only", { timeout: 120000 }, async (t) => {
  const { owner, start } = await setup(t, "sahsah_admin_bootstrap");
  await assert.rejects(start({ ADMIN_BOOTSTRAP_EMAIL: "", ADMIN_BOOTSTRAP_PASSWORD: "" }), /ADMIN_BOOTSTRAP_EMAIL/);
  const first = await start();
  await first.close();
  const before = await owner.query("SELECT role, normalized_email, password_hash FROM staff_accounts");
  assert.equal(before.rows.length, 1);
  assert.equal(before.rows[0].role, "super_admin");
  assert.match(before.rows[0].password_hash, /^scrypt\$/);
  assert.ok(!before.rows[0].password_hash.includes(BOOTSTRAP.password));

  const second = await start({ ADMIN_BOOTSTRAP_EMAIL: "other@example.test", ADMIN_BOOTSTRAP_PASSWORD: "other-password-123" });
  assert.equal((await login(second.base, "other@example.test", "other-password-123")).cookie, undefined);
  assert.equal((await owner.query("SELECT 1 FROM staff_accounts")).rowCount, 1);
  assert.equal((await owner.query("SELECT 1 FROM staff_audit_events WHERE action_code='staff.bootstrap'")).rowCount, 1);
});

test("a session survives a new app instance on the same database", { timeout: 120000 }, async (t) => {
  const { owner, start } = await setup(t, "sahsah_admin_sessions");
  const first = await start();
  const { cookie } = await login(first.base, BOOTSTRAP.email, BOOTSTRAP.password);
  const stored = await owner.query("SELECT session_hash FROM staff_sessions");
  assert.equal(stored.rowCount, 1);
  // Only a hash of the cookie's session id is stored.
  assert.ok(!cookie.includes(stored.rows[0].session_hash.toString("hex")));
  await first.close();
  const second = await start();
  assert.equal((await fetch(`${second.base}/admin`, { headers: { Cookie: cookie }, redirect: "manual" })).status, 200);
  assert.equal((await call(second.base, cookie, "audit-log")).status, 200);
  // Signing out removes the stored session.
  await fetch(`${second.base}/admin/logout`, { headers: { Cookie: cookie }, redirect: "manual" });
  assert.equal((await owner.query("SELECT 1 FROM staff_sessions")).rowCount, 0);
});

test("Super Admin manages staff with audit rows; Admin cannot reach staff management", { timeout: 120000 }, async (t) => {
  const { owner, start } = await setup(t, "sahsah_admin_staff");
  const { base } = await start();
  const root = (await login(base, BOOTSTRAP.email, BOOTSTRAP.password)).cookie;

  const key = randomUUID();
  const created = await call(base, root, "staff", { method: "POST", body: { op: "create", email: "Helper@Example.test", role: "admin", requestKey: key } });
  assert.equal(created.status, 200);
  const account = await created.json();
  assert.equal(account.email, "helper@example.test");
  assert.ok(account.temporaryPassword.length >= 16);
  const audit = await owner.query("SELECT actor.normalized_email AS actor, e.details FROM staff_audit_events e JOIN staff_accounts actor ON actor.id=e.staff_account_id WHERE e.action_code='staff.create'");
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].actor, BOOTSTRAP.email);
  assert.ok(!JSON.stringify(audit.rows[0].details).includes(account.temporaryPassword));

  // The same intent sent again is applied once.
  const replay = await call(base, root, "staff", { method: "POST", body: { op: "create", email: "helper@example.test", role: "admin", requestKey: key } });
  assert.deepEqual(await replay.json(), { replayed: true });
  assert.equal((await owner.query("SELECT 1 FROM staff_accounts")).rowCount, 2);
  const duplicate = await call(base, root, "staff", { method: "POST", body: { op: "create", email: "helper@example.test", role: "admin" } });
  assert.equal(duplicate.status, 409);

  const helper = await login(base, "helper@example.test", account.temporaryPassword);
  assert.equal(helper.response.status, 302);
  assert.equal((await call(base, helper.cookie, "staff")).status, 403);
  assert.equal((await call(base, helper.cookie, "staff", { method: "POST", body: { op: "create", email: "x@example.test", role: "super_admin" } })).status, 403);
  assert.equal((await owner.query("SELECT 1 FROM staff_accounts")).rowCount, 2);
  // An Admin still reads the audit log.
  assert.equal((await call(base, helper.cookie, "audit-log")).status, 200);

  // Deactivation ends the open session at once and the account cannot sign in again.
  const rootId = (await owner.query("SELECT id FROM staff_accounts WHERE normalized_email=$1", [BOOTSTRAP.email])).rows[0].id;
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "deactivate", id: account.id } })).status, 200);
  assert.notEqual((await call(base, helper.cookie, "audit-log")).status, 200);
  assert.equal((await fetch(`${base}/admin`, { headers: { Cookie: helper.cookie }, redirect: "manual" })).status, 302);
  assert.equal((await login(base, "helper@example.test", account.temporaryPassword)).cookie, undefined);
  assert.equal((await owner.query("SELECT 1 FROM staff_audit_events WHERE action_code='staff.deactivate' AND target_key=$1", [account.id])).rowCount, 1);

  // Rules that protect the last Super Admin and the acting user.
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "deactivate", id: rootId } })).status, 409);
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "role", id: rootId, role: "admin" } })).status, 409);
  assert.equal((await owner.query("SELECT is_active, role FROM staff_accounts WHERE id=$1", [rootId])).rows[0].role, "super_admin");

  // Reactivate, promote, and the new Super Admin cannot be left as the only remaining one to remove.
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "reactivate", id: account.id } })).status, 200);
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "role", id: account.id, role: "super_admin" } })).status, 200);
  assert.equal((await call(base, root, "staff", { method: "POST", body: { op: "role", id: account.id, role: "admin" } })).status, 200);

  const reset = await (await call(base, root, "staff", { method: "POST", body: { op: "reset-password", id: account.id } })).json();
  assert.notEqual(reset.temporaryPassword, account.temporaryPassword);
  assert.equal((await login(base, "helper@example.test", account.temporaryPassword)).cookie, undefined);
  assert.ok((await login(base, "helper@example.test", reset.temporaryPassword)).cookie);
  const actions = (await owner.query("SELECT DISTINCT action_code FROM staff_audit_events ORDER BY 1")).rows.map((row) => row.action_code);
  assert.deepEqual(actions, ["staff.bootstrap", "staff.change_role", "staff.create", "staff.deactivate", "staff.reactivate", "staff.reset_password"]);
});

test("the audit log is keyset-paginated and filters by staff and action", { timeout: 120000 }, async (t) => {
  const { owner, start } = await setup(t, "sahsah_admin_audit");
  const { base } = await start();
  const root = (await login(base, BOOTSTRAP.email, BOOTSTRAP.password)).cookie;
  const rootId = (await owner.query("SELECT id FROM staff_accounts")).rows[0].id;
  const other = randomUUID();
  await owner.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin','second@example.test','fixture')", [other]);
  // Thirty events share one timestamp, so the id tiebreak of the cursor is exercised.
  for (let index = 0; index < 30; index++) {
    await owner.query(
      "INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,created_at) VALUES($1,$2,$3,'thing',$4,$5,'2030-01-01T00:00:00Z')",
      [randomUUID(), index % 3 === 0 ? other : rootId, index % 2 === 0 ? "test.even" : "test.odd", String(index), randomUUID()],
    );
  }
  const seen = new Set();
  let cursor = "", pages = 0;
  do {
    const page = await (await call(base, root, "audit-log", { query: cursor ? `?cursor=${encodeURIComponent(cursor)}` : "" })).json();
    for (const row of page.rows) {
      assert.ok(!seen.has(row.id), "no row repeats across pages");
      seen.add(row.id);
    }
    pages++;
    cursor = page.nextCursor ?? "";
  } while (cursor);
  assert.equal(seen.size, 31);
  assert.equal(pages, 2);

  const byStaff = await (await call(base, root, "audit-log", { query: `?staff=${other}` })).json();
  assert.equal(byStaff.rows.length, 10);
  assert.ok(byStaff.rows.every((row) => row.staffEmail === "second@example.test"));
  const byAction = await (await call(base, root, "audit-log", { query: "?action=test.odd" })).json();
  assert.equal(byAction.rows.length, 15);
  assert.equal((await call(base, root, "audit-log", { query: "?cursor=garbage" })).status, 400);
});
