import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { cluster } from "./database/cluster.mjs";
import { png } from "./fixtures/media-files.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const EMAIL = "editor@example.test", PASSWORD = "editor-password-123";
const ANALYTICS = "https://dash.cloudflare.com/analytics/example";

async function startAdmin(t, databaseUrl, media, extra = {}) {
  const admin = await createAdminApplication({ NODE_ENV: "test", DATABASE_URL: databaseUrl, ADMIN_SESSION_SECRET: SECRET, ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000", ADMIN_BOOTSTRAP_EMAIL: EMAIL, ADMIN_BOOTSTRAP_PASSWORD: PASSWORD, GAMEPLAY_LOCAL_MEDIA_DIR: media, ...extra });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const MINUTE = 60000;
const iso = (minutes) => new Date(Date.now() + minutes * MINUTE).toISOString();
const announcement = (over = {}) => ({ titleAr: "عرض جديد", bodyAr: "خصم على كل الباقات", startsAt: iso(-5), ...over });

test("public site: announcement lifecycle and delete rule, pages, settings and logo, all audited", { timeout: 240000 }, async (t) => {
  const cleanup = [], dir = await mkdtemp(path.join(tmpdir(), "sahsah-admin-media-"));
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database("sahsah_admin_public");
  t.after(async () => {
    await owner.end();
    await rm(dir, { recursive: true, force: true });
    for (const fn of cleanup) await fn();
  });
  const base = await startAdmin(t, pg.url("sahsah_app", "sahsah_admin_public"), dir, { CLOUDFLARE_ANALYTICS_URL: ANALYTICS });
  const login = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email: EMAIL, password: PASSWORD }), redirect: "manual" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const url = `${base}/admin/api/pages/public-site`;
  assert.equal((await fetch(url, { redirect: "manual" })).status === 200, false, "anonymous visitors are turned away");
  const read = async (query = "") => (await fetch(`${url}${query}`, { headers: { Cookie: cookie } })).json();
  const post = async (body, requestKey = randomUUID()) => {
    const r = await fetch(url, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
    return { status: r.status, body: await r.json() };
  };
  const upload = async (fields, file, requestKey = randomUUID()) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ requestKey, ...fields })) form.append(key, value);
    form.append("file", new Blob([file]), "logo.png");
    const r = await fetch(url, { method: "POST", headers: { Cookie: cookie }, body: form });
    return { status: r.status, body: await r.json() };
  };
  const audit = async (action) => (await owner.query("SELECT * FROM staff_audit_events WHERE action_code=$1 ORDER BY created_at", [action])).rows;
  const statusOf = async (id) => (await read("?status=")).rows.find((r) => r.id === id)?.status;

  // ---- announcements ------------------------------------------------------------------------
  const empty = await read();
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.analyticsUrl, ANALYTICS);
  const created = await post({ op: "announcement.create", ...announcement({ linkLabel: "التفاصيل", linkUrl: "/faq" }) }, "11111111-1111-4111-8111-111111111111");
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const live = created.body.id;
  // A retry of the same request key creates nothing more.
  assert.deepEqual((await post({ op: "announcement.create", ...announcement() }, "11111111-1111-4111-8111-111111111111")).body, { replayed: true });
  const scheduled = (await post({ op: "announcement.create", ...announcement({ titleAr: "قريبا", startsAt: iso(60), endsAt: iso(120) }) })).body.id;
  const ended = (await post({ op: "announcement.create", ...announcement({ titleAr: "انتهى", startsAt: iso(-120), endsAt: iso(-60) }) })).body.id;
  // ends_at must be in the future of starts_at; an ended one is made by moving its window with the database clock.
  const inactive = (await post({ op: "announcement.create", ...announcement({ titleAr: "متوقف", startsAt: iso(60) }) })).body.id;
  assert.equal((await post({ op: "announcement.deactivate", id: inactive })).status, 200);
  assert.equal(await statusOf(live), "live");
  assert.equal(await statusOf(scheduled), "scheduled");
  assert.equal(await statusOf(ended), "ended");
  assert.equal(await statusOf(inactive), "inactive");
  for (const status of ["live", "scheduled", "ended", "inactive"]) {
    const rows = (await read(`?status=${status}`)).rows;
    assert.equal(rows.length, 1, status);
    assert.equal(rows[0].status, status);
  }
  assert.equal((await read("?status=bogus")).error, "invalid_filter");
  assert.equal((await read("?cursor=garbage")).error, "invalid_cursor");

  // validation
  const bad = async (over, code) => assert.equal((await post({ op: "announcement.create", ...announcement(over) })).body.error, code, JSON.stringify(over));
  await bad({ titleAr: " " }, "title_required");
  await bad({ bodyAr: "" }, "announcement_body_required");
  await bad({ titleAr: "x".repeat(121) }, "title_too_long");
  await bad({ bodyAr: "x".repeat(501) }, "announcement_body_too_long");
  await bad({ linkLabel: "Open" }, "link_incomplete");
  await bad({ linkUrl: "/faq" }, "link_incomplete");
  for (const link of ["http://example.test", "//example.test", "javascript:alert(1)", "/\\example.test", "https://", "ftp://example.test", "faq"]) await bad({ linkLabel: "Open", linkUrl: link }, "invalid_link");
  await bad({ startsAt: "soon" }, "invalid_starts_at");
  await bad({ startsAt: "" }, "starts_at_required");
  await bad({ startsAt: iso(10), endsAt: iso(5) }, "window_invalid");
  for (const link of ["https://example.test/path?x=1", "/", "/about"]) assert.equal((await post({ op: "announcement.create", ...announcement({ linkLabel: "Open", linkUrl: link }) })).status, 200, link);

  // edit, activate and deactivate
  assert.equal((await post({ op: "announcement.update", id: scheduled, ...announcement({ titleAr: "قريبا جدا", startsAt: iso(30) }) })).status, 200);
  assert.equal((await read("?status=scheduled")).rows.find((r) => r.id === scheduled).titleAr, "قريبا جدا");
  assert.equal((await post({ op: "announcement.update", id: randomUUID(), ...announcement() })).status, 404);
  assert.equal((await post({ op: "announcement.activate", id: live })).body.error, "no_change");
  assert.equal((await post({ op: "announcement.activate", id: inactive })).status, 200);
  assert.equal(await statusOf(inactive), "scheduled");

  // delete only if never live
  assert.equal((await post({ op: "announcement.delete", id: live })).body.error, "announcement_was_live", "live: refused");
  assert.equal((await post({ op: "announcement.delete", id: ended })).body.error, "announcement_was_live", "ended: it was shown");
  assert.equal((await post({ op: "announcement.deactivate", id: live })).status, 200);
  assert.equal((await post({ op: "announcement.delete", id: live })).body.error, "announcement_was_live", "deactivated after being shown: still kept");
  assert.equal((await owner.query("SELECT ever_live FROM announcements WHERE id=$1", [live])).rows[0].ever_live, true);
  assert.equal((await read("?status=inactive")).rows.find((r) => r.id === live).deletable, false);
  // A scheduled one was never shown, so it can go; deactivating it first changes nothing about that.
  assert.equal((await read("?status=scheduled")).rows.find((r) => r.id === scheduled).deletable, true);
  assert.equal((await post({ op: "announcement.delete", id: scheduled })).status, 200);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM announcements WHERE id=$1", [scheduled])).rows[0].n, 0);
  assert.equal((await post({ op: "announcement.delete", id: scheduled })).status, 404);
  // Moving a shown announcement's start into the future does not make it deletable.
  const shown = (await post({ op: "announcement.create", ...announcement() })).body.id;
  assert.equal((await post({ op: "announcement.update", id: shown, ...announcement({ startsAt: iso(500) }) })).status, 200);
  assert.equal((await post({ op: "announcement.delete", id: shown })).body.error, "announcement_was_live");

  for (const action of ["announcement.create", "announcement.update", "announcement.activate", "announcement.deactivate", "announcement.delete"]) assert.ok((await audit(action)).length > 0, action);
  assert.equal((await audit("announcement.create")).filter((e) => e.request_key === "11111111-1111-4111-8111-111111111111").length, 1);
  // A refused delete leaves its audit row out: the whole transaction rolled back.
  assert.equal((await audit("announcement.delete")).length, 1);

  // ---- pages --------------------------------------------------------------------------------
  const pages = await read("?view=pages");
  assert.deepEqual(pages.pages.map((p) => [p.slug, p.exists, p.isPublished]), [["about", false, false], ["privacy", false, false], ["terms", false, false], ["faq", false, false]]);
  assert.equal((await post({ op: "page.save", slug: "blog", content: { titleAr: "x", bodyAr: "y" } })).status, 404);
  assert.equal((await post({ op: "page.save", slug: "about", content: { titleAr: "", bodyAr: "y" } })).body.error, "page_title_required");
  assert.equal((await post({ op: "page.save", slug: "about", content: { titleAr: "عن", bodyAr: "" } })).body.error, "page_body_required");
  assert.equal((await post({ op: "page.publish", slug: "about" })).body.error, "page_not_saved");
  const html = "<script>alert(1)</script>\n\n## عنوان\n- نقطة";
  assert.equal((await post({ op: "page.save", slug: "about", content: { titleAr: "عن صحصح", bodyAr: html, ignored: "dropped" } })).status, 200);
  let about = (await read("?view=pages")).pages.find((p) => p.slug === "about");
  assert.deepEqual([about.exists, about.isPublished, about.content.bodyAr, about.content.ignored], [true, false, html, undefined], "saved hidden; stored as text, unknown keys dropped");
  assert.equal((await post({ op: "page.unpublish", slug: "about" })).body.error, "no_change");
  assert.equal((await post({ op: "page.publish", slug: "about" })).status, 200);
  // Saving again keeps the published state.
  assert.equal((await post({ op: "page.save", slug: "about", content: { titleAr: "عن صحصح", bodyAr: "نص جديد", bodyFranco: "Nas gedid" } })).status, 200);
  about = (await read("?view=pages")).pages.find((p) => p.slug === "about");
  assert.deepEqual([about.isPublished, about.content.bodyAr, about.content.bodyFranco], [true, "نص جديد", "Nas gedid"]);
  assert.equal((await post({ op: "page.unpublish", slug: "about" })).status, 200);
  // FAQ is structured.
  assert.equal((await post({ op: "page.save", slug: "faq", content: { titleAr: "أسئلة", items: [] } })).body.error, "faq_items_required");
  assert.equal((await post({ op: "page.save", slug: "faq", content: { titleAr: "أسئلة", items: [{ questionAr: "س", answerAr: "" }] } })).body.error, "answer_required");
  assert.equal((await post({ op: "page.save", slug: "faq", content: { titleAr: "أسئلة", items: Array.from({ length: 51 }, () => ({ questionAr: "س", answerAr: "ج" })) } })).body.error, "faq_items_too_many");
  assert.equal((await post({ op: "page.save", slug: "faq", content: { titleAr: "أسئلة", items: [{ questionAr: "س", answerAr: "ج", answerFranco: "G" }] } })).status, 200);
  assert.deepEqual((await read("?view=pages")).pages.find((p) => p.slug === "faq").content.items, [{ questionAr: "س", answerAr: "ج", answerFranco: "G" }]);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM public_pages")).rows[0].n, 2);
  for (const action of ["page.save", "page.publish", "page.unpublish"]) assert.ok((await audit(action)).length > 0, action);

  // ---- settings and logo --------------------------------------------------------------------
  const fresh = await read("?view=settings");
  assert.deepEqual([fresh.settings, fresh.logoUrl, fresh.uploadsEnabled], [{}, null, true]);
  const settings = { supportPhone: "+20 100 123 4567", whatsapp: "01001234567", supportEmail: "help@example.test", facebookUrl: "https://facebook.com/sahsah", instagramUrl: "", tiktokUrl: "https://tiktok.com/@sahsah" };
  assert.equal((await post({ op: "settings.save", ...settings })).status, 200);
  const saved = await read("?view=settings");
  assert.deepEqual(saved.settings, { supportPhone: settings.supportPhone, whatsapp: settings.whatsapp, supportEmail: settings.supportEmail, facebookUrl: settings.facebookUrl, tiktokUrl: settings.tiktokUrl }, "empty fields are left out");
  for (const [over, code] of [[{ supportPhone: "call me" }, "invalid_supportPhone"], [{ whatsapp: "abc" }, "invalid_whatsapp"], [{ supportEmail: "nope" }, "invalid_support_email"], [{ facebookUrl: "http://facebook.com/x" }, "invalid_facebookUrl"], [{ instagramUrl: "javascript:alert(1)" }, "invalid_instagramUrl"], [{ tiktokUrl: "https://a b" }, "invalid_link"]])
    assert.equal((await post({ op: "settings.save", ...settings, ...over })).body.error, code, code);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM site_settings")).rows[0].n, 1);

  assert.equal((await upload({ op: "logo.upload" }, Buffer.from("not an image"))).body.error, "unsupported_image");
  assert.equal((await upload({ op: "logo.upload" }, png(10, 10))).body.error, "image_dimensions");
  assert.equal((await upload({ op: "logo.upload" }, Buffer.concat([png(200, 100), Buffer.alloc(3 * 1024 * 1024)]))).status, 413);
  assert.equal((await post({ op: "logo.remove" })).body.error, "no_change");
  const key = randomUUID();
  const first = await upload({ op: "logo.upload" }, png(200, 100), key);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual((await upload({ op: "logo.upload" }, png(200, 100), key)).body, { replayed: true });
  const asset = (await owner.query("SELECT * FROM media_assets")).rows;
  assert.equal(asset.length, 1, "the replayed upload created nothing");
  assert.deepEqual([asset[0].access_scope, asset[0].state, asset[0].width_px, asset[0].height_px, asset[0].content_type], ["public", "ready", 200, 100, "image/png"]);
  assert.match(asset[0].storage_key, /^site\/logo-[0-9a-f-]{36}\.png$/);
  assert.ok((await readdir(path.join(dir, "public", "site"))).length === 1, "stored in the public area");
  const withLogo = await read("?view=settings");
  assert.match(withLogo.logoUrl, /\/site\/logo-.*\.png$/);
  assert.deepEqual([withLogo.logoWidth, withLogo.logoHeight], [200, 100]);
  assert.equal(withLogo.settings.supportEmail, "help@example.test", "uploading a logo keeps the other settings");
  assert.equal((await post({ op: "settings.save", ...settings, supportEmail: "" })).status, 200);
  assert.ok((await read("?view=settings")).logoUrl, "saving settings keeps the logo");
  assert.equal((await post({ op: "logo.remove" })).status, 200);
  assert.equal((await read("?view=settings")).logoUrl, null);
  for (const action of ["site.settings.save", "site.logo.upload", "site.logo.remove"]) assert.ok((await audit(action)).length > 0, action);
  assert.equal((await post({ op: "nonsense" })).body.error, "unknown_operation");
});

test("the analytics link must be an https address", async () => {
  const { readAdminConfig } = await import("../dist/admin/config.js");
  const env = { DATABASE_URL: "postgres://user:pass@localhost:5432/db", ADMIN_SESSION_SECRET: SECRET };
  assert.equal(readAdminConfig({ ...env, CLOUDFLARE_ANALYTICS_URL: ANALYTICS }).cloudflareAnalyticsUrl, ANALYTICS);
  assert.equal(readAdminConfig(env).cloudflareAnalyticsUrl, undefined);
  assert.throws(() => readAdminConfig({ ...env, CLOUDFLARE_ANALYTICS_URL: "http://insecure.example" }), /CLOUDFLARE_ANALYTICS_URL/);
});
