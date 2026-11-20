import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplication } from "../dist/application.js";
import { sourceKey } from "../dist/gameplay/platform/rates.js";

process.env.DATABASE_URL = "";
process.env.GAMEPLAY_ENABLED = "false";
process.env.NODE_ENV = "test";

test("one client is one IPv4 address or one IPv6 /64", () => {
  assert.equal(sourceKey("203.0.113.7"), "203.0.113.7");
  assert.equal(sourceKey("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(sourceKey("2001:db8:aa:1:1111:2222:3333:4444"), "2001:db8:aa:1::/64");
  assert.equal(sourceKey("2001:0db8:00aa:0001::9"), "2001:db8:aa:1::/64");
  assert.equal(sourceKey("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(sourceKey("::1"), "0:0:0:0::/64");
  assert.equal(sourceKey("unknown"), "unknown");
});

test("every route shares one per-address budget, refused as a problem before any handler", async (t) => {
  process.env.GAMEPLAY_HTTP_IP_RATE = "1";
  process.env.GAMEPLAY_HTTP_IP_BURST = "3";
  t.after(() => {
    delete process.env.GAMEPLAY_HTTP_IP_RATE;
    delete process.env.GAMEPLAY_HTTP_IP_BURST;
  });
  const app = await createApplication();
  t.after(() => app.close());
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();

  const first = await fetch(`${base}/api/health`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  assert.equal(first.headers.get("x-frame-options"), "DENY");
  assert.equal(first.headers.get("referrer-policy"), "no-referrer");
  // Unknown paths spend the same budget: probing for routes is not free.
  assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 404);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);

  const refused = await fetch(`${base}/api/health`);
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get("retry-after"), "1");
  assert.match(refused.headers.get("content-type") ?? "", /application\/problem\+json/);
  const body = await refused.json();
  assert.equal(body.code, "RATE_LIMITED");
  assert.equal(body.requestId, refused.headers.get("x-request-id"));
});

test("an invalid rate setting fails startup instead of running unlimited", async () => {
  process.env.GAMEPLAY_HTTP_IP_RATE = "fast";
  try {
    await assert.rejects(createApplication(), /INVALID_HTTP_RATE_CONFIGURATION/);
  } finally {
    delete process.env.GAMEPLAY_HTTP_IP_RATE;
  }
});
