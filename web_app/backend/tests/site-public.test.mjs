import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { gameplayFixture } from "./gameplay/fixture.mjs";

const MINUTE = 60000;
const plain = (base) => async (method, path, body, headers = {}) => {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, body: await response.json() };
};
const staffId = async (o) => (await o.query("SELECT id FROM staff_accounts LIMIT 1")).rows[0].id;

test("public site: live announcements, published pages, site settings", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  const o = f.owner, call = plain(f.base), staff = await staffId(o);
  const announce = (over, startMinutes, endMinutes = null) =>
    o.query(
      "INSERT INTO announcements(id,title_ar,title_franco,body_ar,body_franco,link_label,link_url,starts_at,ends_at,is_active,created_by_staff_id,updated_by_staff_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)",
      [randomUUID(), over.title, over.franco ?? null, "body", over.bodyFranco ?? null, over.link ? "Open" : null, over.link ?? null, new Date(Date.now() + startMinutes * MINUTE), endMinutes === null ? null : new Date(Date.now() + endMinutes * MINUTE), over.active ?? true, staff],
    );
  await announce({ title: "live older" }, -120);
  await announce({ title: "live newest", franco: "Live franco", link: "/faq" }, -10, 60);
  await announce({ title: "scheduled" }, 30);
  await announce({ title: "ended" }, -120, -60);
  await announce({ title: "inactive", active: false }, -30);
  // The database refuses addresses that are neither https nor a same-site path.
  for (const bad of ["http://example.test", "//example.test", "javascript:alert(1)", "/\\example.test", "https://a b"])
    await assert.rejects(announce({ title: "bad", link: bad }, -1), /announcements_link_shape/, bad);

  const list = await call("GET", "/announcements");
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.items.map((i) => i.title), ["live newest", "live older"], "only live, newest start first");
  assert.equal(list.body.items[0].linkUrl, "/faq");
  assert.equal(list.body.items[0].linkLabel, "Open");
  assert.equal(list.body.items[1].linkUrl, undefined);
  assert.match(list.headers.get("cache-control"), /public, max-age=30/);
  assert.equal((await call("GET", "/announcements?language=franco")).body.items[0].title, "Live franco");
  assert.equal((await call("GET", "/announcements?language=de")).body.code, "INVALID_LANGUAGE");
  // Kept briefly in process: a change shows up after the cache lifetime, not on the very next read.
  await announce({ title: "brand new" }, -1);
  assert.equal((await call("GET", "/announcements")).body.items.length, 2);

  // pages: nothing exists until staff publish it
  assert.equal((await call("GET", "/pages/about")).status, 404);
  const page = (slug, content, published) => o.query("INSERT INTO public_pages(id,slug,content,is_published,updated_by_staff_id,updated_at) VALUES($1,$2,$3,$4,$5,now())", [randomUUID(), slug, content, published, staff]);
  await page("about", { titleAr: "عن صحصح", titleFranco: "An Sahsah", bodyAr: "فقرة", bodyFranco: "Fakra" }, false);
  const hidden = await call("GET", "/pages/about");
  assert.equal(hidden.status, 404);
  assert.equal(hidden.body.code, "NOT_FOUND");
  await o.query("UPDATE public_pages SET is_published=true WHERE slug='about'");
  const about = await call("GET", "/pages/about");
  assert.equal(about.status, 200);
  assert.deepEqual([about.body.slug, about.body.title, about.body.body], ["about", "عن صحصح", "فقرة"]);
  assert.equal((await call("GET", "/pages/about?language=franco")).body.body, "Fakra");
  await page("faq", { titleAr: "أسئلة", items: [{ questionAr: "س؟", answerAr: "ج", answerFranco: "G" }, { questionAr: "", answerAr: "dropped" }] }, true);
  const faq = await call("GET", "/pages/faq?language=franco");
  assert.deepEqual(faq.body.items, [{ question: "س؟", answer: "G" }], "Arabic fallback, malformed items dropped");
  assert.equal(faq.body.body, undefined);
  await page("terms", { titleAr: "شروط" }, true);
  assert.equal((await call("GET", "/pages/terms")).status, 404, "a published page without text does not render");
  assert.equal((await call("GET", "/pages/unknown")).status, 404);
  assert.equal((await call("GET", "/pages/about?x=1&language=zz")).status, 400);

  // settings
  await o.query("INSERT INTO site_settings(id,branding,updated_by_staff_id,updated_at) VALUES(1,$1,$2,now())", [{ supportPhone: "+20 100 000 0000", supportEmail: "help@example.test", facebookUrl: "https://facebook.com/sahsah", whatsapp: " " }, staff]);
  const settings = await call("GET", "/site");
  assert.match(settings.headers.get("cache-control"), /max-age=30/);
  assert.equal(settings.status, 200);
  assert.deepEqual(Object.keys(settings.body).sort(), ["facebookUrl", "supportEmail", "supportPhone"]);
});

const SUPPORT = { kind: "support", reason: "technical", email: "player@example.test", message: "The game froze on question two." };

test("contact form: three shapes, linked account, idempotent, honeypot, unknown fields refused", { timeout: 240000 }, async (t) => {
  process.env.GAMEPLAY_CONTACT_PER_HOUR = "100";
  t.after(() => delete process.env.GAMEPLAY_CONTACT_PER_HOUR);
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  const o = f.owner, call = plain(f.base);
  const send = (body, key = randomUUID(), headers = {}) => call("POST", "/contact", body, { "Idempotency-Key": key, ...headers });
  const rows = async () => (await o.query("SELECT * FROM contact_submissions ORDER BY created_at")).rows;

  const first = await send({ ...SUPPORT, name: "  Sara  " });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.match(first.body.receivedAt, /^\d{4}-\d\d-\d\dT/);
  let [row] = await rows();
  assert.deepEqual([row.id, row.kind, row.support_reason, row.business_kind, row.email, row.name, row.rating, row.account_id, row.state], [first.body.id, "support", "technical", null, "player@example.test", "Sara", null, null, "open"]);

  const business = await send({ kind: "business", businessKind: "influencer", email: "b@example.test", handle: "@creator", message: "Let us work together." });
  assert.equal(business.status, 201);
  const rated = await send({ kind: "experience", rating: 5 });
  assert.equal(rated.status, 201);
  const wrote = await send({ kind: "experience", message: "Loved it" });
  assert.equal(wrote.status, 201);
  const all = await rows();
  assert.deepEqual(all.slice(1).map((r) => [r.kind, r.business_kind, r.support_reason, r.handle, r.rating, r.message]), [
    ["business", "influencer", null, "@creator", null, "Let us work together."],
    ["experience", null, null, null, 5, null],
    ["experience", null, null, null, null, "Loved it"],
  ]);

  // Refused shapes: nothing is stored.
  const before = (await rows()).length;
  for (const [name, body] of Object.entries({
    "support without reason": { kind: "support", email: "a@example.test", message: "long enough" },
    "support bad reason": { ...SUPPORT, reason: "other" },
    "support bad email": { ...SUPPORT, email: "not-an-email" },
    "support short message": { ...SUPPORT, message: "hey" },
    "support blank message": { ...SUPPORT, message: "        " },
    "business without kind": { kind: "business", email: "a@example.test", message: "long enough" },
    "experience empty": { kind: "experience" },
    "experience blank": { kind: "experience", message: "   " },
    "rating out of range": { kind: "experience", rating: 6 },
    "unknown field": { ...SUPPORT, accountId: randomUUID() },
    "unknown kind": { kind: "other", message: "long enough" },
    "mixed shape": { ...SUPPORT, rating: 3 },
    "message too long": { ...SUPPORT, message: "x".repeat(1001) },
  })) {
    const r = await send(body);
    assert.equal(r.status, 400, name);
    assert.equal(r.body.code, "INVALID_INPUT", name);
  }
  assert.equal((await call("POST", "/contact", SUPPORT)).status, 400, "an Idempotency-Key is required");
  assert.equal((await rows()).length, before);

  // Idempotent: the same key and body replays the stored receipt; a different body conflicts.
  const key = randomUUID();
  const one = await send(SUPPORT, key), two = await send(SUPPORT, key);
  assert.equal(one.status, 201);
  assert.equal(two.status, 201);
  assert.equal(two.body.id, one.body.id);
  assert.equal(two.body.receivedAt, one.body.receivedAt);
  assert.equal(two.headers.get("idempotency-replayed"), "true");
  assert.equal((await rows()).length, before + 1);
  const conflict = await send({ ...SUPPORT, message: "A different message entirely." }, key);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, "OPERATION_CONFLICT");

  // The honeypot looks like success and stores nothing.
  const bot = await send({ ...SUPPORT, website: "http://spam.example" });
  assert.equal(bot.status, 201);
  assert.equal((await rows()).length, before + 1);

  // A signed-in sender is linked to the account; a rejected credential still lets the message through, unlinked.
  const signed = await send(SUPPORT, randomUUID(), { Authorization: "Bearer a0" });
  assert.equal(signed.status, 201);
  assert.equal((await o.query("SELECT account_id FROM contact_submissions WHERE id=$1", [signed.body.id])).rows[0].account_id, f.accounts[0]);
  const stale = await send(SUPPORT, randomUUID(), { Authorization: "Bearer unknown-credential" });
  assert.equal(stale.status, 201);
  assert.equal((await o.query("SELECT account_id FROM contact_submissions WHERE id=$1", [stale.body.id])).rows[0].account_id, null);
  // Another account cannot take over the same key.
  assert.equal((await send(SUPPORT, signed.body.id === key ? randomUUID() : key, { Authorization: "Bearer a0" })).status, 409);
});

test("contact form: each client has a tight budget", { timeout: 240000 }, async (t) => {
  process.env.GAMEPLAY_CONTACT_PER_HOUR = "3";
  t.after(() => delete process.env.GAMEPLAY_CONTACT_PER_HOUR);
  const f = await gameplayFixture(t, { hosts: 1, tokens: 1 });
  const call = plain(f.base);
  const send = () => call("POST", "/contact", SUPPORT, { "Idempotency-Key": randomUUID() });
  for (let i = 0; i < 3; i++) assert.equal((await send()).status, 201);
  const refused = await send();
  assert.equal(refused.status, 429);
  assert.equal(refused.body.code, "RATE_LIMITED");
  assert.ok(Number(refused.headers.get("retry-after")) > 0);
  assert.equal((await f.owner.query("SELECT count(*)::int AS n FROM contact_submissions")).rows[0].n, 3);
});

test("an invalid contact rate setting fails startup", async () => {
  const { httpRatePolicy } = await import("../dist/gameplay/platform/http.js");
  assert.equal(httpRatePolicy({}).contactPerHour, 5);
  assert.throws(() => httpRatePolicy({ GAMEPLAY_CONTACT_PER_HOUR: "0" }), /INVALID_HTTP_RATE_CONFIGURATION|invalid/i);
});
