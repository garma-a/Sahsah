import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/application.js";

// Starter HTTP tests must never pick up a developer's configured database or gameplay.
process.env.DATABASE_URL = "";
process.env.GAMEPLAY_ENABLED = "false";
process.env.NODE_ENV = "test";

async function start(t) {
  const app = await createApplication();
  t.after(() => app.close());
  await app.listen(0, "127.0.0.1");
  return app.getUrl();
}

test("the API does not serve the admin dashboard", async (t) => {
  const base = await start(t);
  const response = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:3000" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.deepEqual(await response.json(), { status: "ok", service: "sahsah-backend" });
  assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
  assert.equal((await fetch(`${base}/admin`)).status, 404);
});
