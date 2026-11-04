import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/application.js";

// Starter HTTP tests must never pick up a developer's configured database.
process.env.DATABASE_URL = "";
process.env.NODE_ENV = "test";

const credentials = {
  email: "admin@example.test",
  password: "test-only-password-for-admin",
};

async function start(t) {
  const app = await createApplication();
  t.after(() => app.close());
  await app.listen(0, "127.0.0.1");
  return app.getUrl();
}

test("the API works independently with the admin dashboard disabled", async (t) => {
  process.env.ADMIN_ENABLED = "false";
  const base = await start(t);
  const response = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.deepEqual(await response.json(), { status: "ok", service: "sahsah-backend" });
  assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
  assert.equal((await fetch(`${base}/admin`)).status, 404);
});

test("enabling AdminJS without credentials fails closed", async () => {
  process.env.ADMIN_ENABLED = "true";
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_PASSWORD = "";
  process.env.ADMIN_SESSION_SECRET = "";
  await assert.rejects(createApplication(), /AdminJS requires ADMIN_EMAIL/);
});

test("AdminJS shares the backend and requires an authenticated session", async (t) => {
  process.env.ADMIN_ENABLED = "true";
  process.env.ADMIN_EMAIL = credentials.email;
  process.env.ADMIN_PASSWORD = credentials.password;
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
  process.env.NODE_ENV = "test";
  const base = await start(t);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);

  const anonymous = await fetch(`${base}/admin`, { redirect: "manual" });
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get("location"), "/admin/login");
  const loginPage = await fetch(`${base}/admin/login`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Sahsah/);
  const asset = await fetch(`${base}/admin/frontend/assets/app.bundle.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type") ?? "", /javascript/);
  await asset.arrayBuffer();

  const invalid = await fetch(`${base}/admin/login`, {
    method: "POST",
    body: new URLSearchParams({ email: credentials.email, password: "wrong-password" }),
    redirect: "manual",
  });
  assert.notEqual(invalid.status, 302);
  assert.equal(invalid.headers.get("set-cookie"), null);

  const login = await fetch(`${base}/admin/login`, {
    method: "POST",
    body: new URLSearchParams(credentials),
    redirect: "manual",
  });
  assert.equal(login.status, 302);
  const cookie = login.headers.get("set-cookie");
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const dashboard = await fetch(`${base}/admin`, {
    headers: { Cookie: cookie.split(";")[0] },
    redirect: "manual",
  });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Sahsah/);
});
