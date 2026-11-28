import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { cluster } from "./database/cluster.mjs";
import { gameplayFixture } from "./gameplay/fixture.mjs";
import { mp3, png } from "./fixtures/media-files.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const EMAIL = "editor@example.test", PASSWORD = "editor-password-123";

async function startAdmin(t, databaseUrl, media) {
  const admin = await createAdminApplication({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    ADMIN_SESSION_SECRET: SECRET,
    ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000",
    ADMIN_BOOTSTRAP_EMAIL: EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
    ...(media ? { GAMEPLAY_LOCAL_MEDIA_DIR: media } : {}),
  });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const login = async (base) => {
  const response = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email: EMAIL, password: PASSWORD }), redirect: "manual" });
  return response.headers.get("set-cookie").split(";")[0];
};

function client(base, cookie) {
  const page = (query = "") => fetch(`${base}/admin/api/pages/content${query}`, { headers: { Cookie: cookie } });
  const read = async (query) => (await page(query)).json();
  const post = async (body, requestKey = randomUUID()) => {
    const response = await fetch(`${base}/admin/api/pages/content`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestKey, ...body }),
    });
    return { status: response.status, body: await response.json() };
  };
  const upload = async (fields, file, name = "file.bin", requestKey = randomUUID()) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ requestKey, ...fields })) form.append(key, value);
    form.append("file", new Blob([file]), name);
    const response = await fetch(`${base}/admin/api/pages/content`, { method: "POST", headers: { Cookie: cookie }, body: form });
    return { status: response.status, body: await response.json() };
  };
  return { read, post, upload };
}

const standard = (n) => ({ format: "STANDARD", promptAr: `سؤال ${n}`, answerAr: `جواب ${n}` });

test("category detail can page past 100 packs in pack number order", { timeout: 120000 }, async (t) => {
  const pg = await cluster(t);
  const owner = await pg.database("sahsah_admin_pack_pages");
  const base = await startAdmin(t, pg.url("sahsah_app", "sahsah_admin_pack_pages"));
  const c = client(base, await login(base));
  const { body: section } = await c.post({ op: "section.create", nameAr: "قسم" });
  const { body: category } = await c.post({ op: "category.create", sectionId: section.id, nameAr: "فئة" });
  await owner.query(
    "INSERT INTO question_packs(id, category_id, pack_number) SELECT gen_random_uuid(), $1, number FROM generate_series(103, 1, -1) AS number",
    [category.id],
  );
  const url = `?view=category&id=${category.id}`;
  const numbers = [];
  let page = await c.read(url);
  assert.ok(page.nextCursor, "the first page has a continuation");
  while (true) {
    numbers.push(...page.packs.map((pack) => pack.packNumber));
    if (!page.nextCursor) break;
    assert.ok(numbers.length < 103, "a continuation must advance");
    page = await c.read(`${url}&cursor=${encodeURIComponent(page.nextCursor)}`);
  }
  assert.deepEqual(numbers, Array.from({ length: 103 }, (_, index) => index + 1));
  assert.deepEqual(await c.read(`${url}&cursor=garbage`), { error: "invalid_cursor" });
  for (const cursor of [[1, "-".repeat(36)], [2_147_483_648, randomUUID()]]) {
    assert.deepEqual(await c.read(`${url}&cursor=${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`), { error: "invalid_cursor" });
  }
});

test("staff build a pack of mixed formats; publish validates; edit and replace differ; every change is audited", { timeout: 240000 }, async (t) => {
  const cleanup = [], dir = await mkdtemp(path.join(tmpdir(), "sahsah-admin-media-"));
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database("sahsah_admin_content");
  t.after(async () => {
    await owner.end();
    await rm(dir, { recursive: true, force: true });
    for (const fn of cleanup) await fn();
  });
  const base = await startAdmin(t, pg.url("sahsah_app", "sahsah_admin_content"), dir);
  const c = client(base, await login(base));
  assert.equal((await fetch(`${base}/admin/api/pages/content`, { redirect: "manual" })).status === 200, false, "anonymous visitors are turned away");

  // Sections: create, rename, reorder; a repeated request key is applied once.
  const key = randomUUID();
  const first = await c.post({ op: "section.create", nameAr: "جديد", nameFranco: "Gedid" }, key);
  assert.equal(first.status, 200);
  assert.deepEqual((await c.post({ op: "section.create", nameAr: "جديد" }, key)).body, { replayed: true });
  const second = await c.post({ op: "section.create", nameAr: "مشاهير" });
  assert.equal((await c.post({ op: "section.create", nameAr: "  " })).body.error, "name_required");
  assert.equal((await c.post({ op: "section.rename", id: second.body.id, nameAr: "المشاهير" })).status, 200);
  assert.equal((await c.post({ op: "section.move", id: second.body.id, direction: "up" })).status, 200);
  assert.equal((await c.post({ op: "section.move", id: second.body.id, direction: "up" })).status, 409);
  let home = await c.read("?view=home");
  assert.deepEqual(home.sections.map((s) => s.nameAr), ["المشاهير", "جديد"]);
  assert.equal(home.mediaEnabled, true);

  // Categories: validation, ordering within a section, archive filter.
  assert.equal((await c.post({ op: "category.create", nameAr: "كورة" })).body.error, "section_required");
  const football = (await c.post({ op: "category.create", nameAr: "كورة", nameFranco: "Kora", descriptionAr: "وصف", sectionId: first.body.id })).body.id;
  const movies = (await c.post({ op: "category.create", nameAr: "أفلام", sectionId: first.body.id })).body.id;
  await c.post({ op: "category.create", nameAr: "مطربين", sectionId: second.body.id });
  assert.equal((await c.post({ op: "category.move", id: movies, direction: "up" })).status, 200);
  home = await c.read(`?view=home&section=${first.body.id}`);
  assert.deepEqual(home.categories.map((x) => x.nameAr), ["أفلام", "كورة"]);
  assert.equal((await c.post({ op: "category.update", id: football, nameAr: "كرة القدم", sectionId: first.body.id })).status, 200);
  assert.equal((await c.read("?view=home&status=bogus")).error, "invalid_filter");

  // Cover: validated, stored as a public file, referenced by id only.
  assert.equal((await c.upload({ op: "category.cover", id: football }, png(500, 500), "cover.png")).body.error, "cover_dimensions");
  assert.equal((await c.upload({ op: "category.cover", id: football }, Buffer.from("not an image"), "cover.png")).body.error, "unsupported_image");
  assert.equal((await c.upload({ op: "category.cover", id: football }, mp3(), "cover.mp3")).body.error, "unsupported_image");
  assert.equal((await c.upload({ op: "category.cover", id: football }, Buffer.concat([png(400, 500), Buffer.alloc(6 * 1024 * 1024)]), "huge.png")).status, 413);
  const coverKey = randomUUID();
  assert.equal((await c.upload({ op: "category.cover", id: football }, png(400, 500), "cover.png", coverKey)).status, 200);
  assert.deepEqual((await c.upload({ op: "category.cover", id: football }, png(400, 500), "cover.png", coverKey)).body, { replayed: true });
  const cover = (await owner.query("SELECT a.access_scope, a.storage_key, a.state FROM categories c JOIN media_assets a ON a.id=c.cover_media_asset_id WHERE c.id=$1", [football])).rows[0];
  assert.equal(cover.access_scope, "public");
  assert.match(cover.storage_key, /^covers\/.+\.png$/);
  assert.equal(cover.state, "ready");
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM media_assets")).rows[0].n, 1, "the replayed upload created nothing");
  assert.ok((await readdir(path.join(dir, "public", "covers"))).length === 1);
  const withCover = (await c.read(`?view=category&id=${football}`)).category;
  assert.ok(withCover.coverUrl?.includes(cover.storage_key));

  // Packs: a draft may be incomplete; publishing refuses with the reasons.
  const pack = (await c.post({ op: "pack.create", categoryId: football })).body;
  assert.equal(pack.packNumber, 1);
  const empty = await c.post({ op: "pack.publish", id: pack.id });
  assert.equal(empty.status, 409);
  assert.equal(empty.body.error, "pack_incomplete");
  assert.equal(empty.body.issues.filter((i) => i.code === "missing_question").length, 6);

  const save = (slot, extra, mode = "create", questionId) => c.post({ op: "question.save", packId: pack.id, slot, mode, questionId, ...extra });
  const image = async (name = "x.png", w = 300, h = 200) => (await c.upload({ op: "media.upload", purpose: "image" }, png(w, h), name)).body.asset;
  const audio = async () => (await c.upload({ op: "media.upload", purpose: "audio" }, mp3(), "x.mp3")).body.asset;

  // Upload validation: wrong type for the purpose, and nothing is stored for a refusal.
  assert.equal((await c.upload({ op: "media.upload", purpose: "audio" }, png(100, 100), "x.mp3")).body.error, "unsupported_audio");
  assert.equal((await c.upload({ op: "media.upload", purpose: "image" }, mp3(), "x.png")).body.error, "unsupported_image");
  assert.equal((await c.upload({ op: "media.upload", purpose: "video" }, png(100, 100))).body.error, "invalid_purpose");
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM media_assets WHERE access_scope='private'")).rows[0].n, 0);

  // Slot 1: standard. Slot 2: blur, missing a stage. Slot 3: audio. Slot 4: clue image. Slot 5: memory. Slot 6: charades.
  assert.equal((await save(1, standard(1))).status, 200);
  const original = await image("original.png", 400, 300);
  const stage0 = await image("s0.png"), stage1 = await image("s1.png"), stage2 = await image("s2.png");
  assert.equal(original.url.includes("signature="), true, "previews use short-lived signed links");
  const blur = (points) => ({
    format: "IMAGE_BLUR", promptAr: "مين؟", answerAr: "فلان",
    media: [
      { key: "answer", assetId: original.id },
      { key: "hint0", assetId: stage0.id, points: points[0] },
      { key: "hint1", assetId: stage1.id, points: points[1] },
      { key: "hint2", assetId: stage2.id, points: points[2] },
    ],
  });
  // Points must fall from the tile value (slot 2 is a 200-point tile); a draft saves anyway but cannot publish.
  assert.equal((await save(2, blur([200, 150, 150]))).status, 200);
  const clip = await audio();
  assert.equal((await save(3, { format: "AUDIO_GUESS", promptAr: "اسمع", answerAr: "اغنية", media: [{ key: "audio", assetId: clip.id }] })).status, 200);
  const clueMain = await image("main.png"), clue0 = await image("c0.png"), clue1 = await image("c1.png");
  assert.equal((await save(4, { format: "IMAGE_CLUES", promptAr: "تلميحات", answerAr: "x", media: [
    { key: "prompt", assetId: clueMain.id }, { key: "hint0", assetId: clue0.id, points: 300 }, { key: "hint1", assetId: clue1.id, points: 200 },
  ] })).status, 200);
  const scene = await image("scene.png"), memAnswer = await image("a.png");
  assert.equal((await save(5, { format: "IMAGE_MEMORY", promptAr: "افتكر", answerAr: "x", config: { instructionAr: "احفظ", bogus: "dropped" }, media: [{ key: "prompt", assetId: scene.id }, { key: "answer", assetId: memAnswer.id }] })).status, 200);
  const card = await image("card.png"), charadesAnswer = await image("ca.png");
  // Slot 6 is left without its answer picture first.
  assert.equal((await save(6, { format: "CHARADES", promptAr: "مثل", answerAr: "x", media: [{ key: "prompt", assetId: card.id }] })).status, 200);

  let view = await c.read(`?view=pack&id=${pack.id}`);
  const codes = view.issues.map((i) => `${i.slot}:${i.code}`);
  assert.deepEqual(codes.sort(), ["2:config_invalid", "6:missing_answer"].sort());
  assert.deepEqual(view.slots[4].question.config, { instructionAr: "احفظ" }, "unknown settings are dropped");
  assert.equal(view.slots[2].question.media[0].asset.durationMs > 2000, true);
  let refused = await c.post({ op: "pack.publish", id: pack.id });
  assert.equal(refused.status, 409);
  assert.deepEqual(refused.body.issues.map((i) => i.slot).sort(), [2, 6]);
  // Hint lineage is recorded when the files are attached.
  const lineage = (await owner.query("SELECT a.source_asset_id, a.transform_spec, a.state FROM media_assets a WHERE a.id=$1", [stage1.id])).rows[0];
  assert.equal(lineage.source_asset_id, original.id);
  assert.deepEqual(lineage.transform_spec, { operation: "blur", stageIndex: 1 });
  assert.equal(lineage.state, "ready");

  // Fix both and publish.
  assert.equal((await save(2, blur([200, 150, 50]), "edit", view.slots[1].question.id)).status, 200);
  const answerPicture = await image("ca2.png");
  assert.equal((await save(6, { format: "CHARADES", promptAr: "مثل", answerAr: "x", media: [{ key: "prompt", assetId: card.id }, { key: "answer", assetId: answerPicture.id }] }, "edit", view.slots[5].question.id)).status, 200);
  const publishKey = randomUUID();
  assert.equal((await c.post({ op: "pack.publish", id: pack.id }, publishKey)).status, 200);
  assert.deepEqual((await c.post({ op: "pack.publish", id: pack.id }, publishKey)).body, { replayed: true });
  assert.equal((await c.post({ op: "pack.publish", id: pack.id })).body.error, "no_change");
  const published = (await owner.query("SELECT publication_state, content_revision FROM question_packs WHERE id=$1", [pack.id])).rows[0];
  assert.equal(published.publication_state, "published");

  // Edit keeps the logical question; replace retires it and starts a new one in the slot.
  view = await c.read(`?view=pack&id=${pack.id}`);
  const slot1 = view.slots[0].question;
  assert.equal((await save(1, { ...standard(1), promptAr: "تصحيح" }, "edit", slot1.id)).body.error, "public_edit_confirmation_required");
  assert.equal((await save(1, { ...standard(1), promptAr: "تصحيح", confirmPublicEdit: true }, "edit", slot1.id)).status, 200);
  assert.equal((await save(1, { format: "AUDIO_GUESS", promptAr: "x", answerAr: "y", confirmPublicEdit: true }, "edit", slot1.id)).body.error, "format_change_needs_replacement");
  let rows = (await owner.query("SELECT id, prompt_ar, retired_at FROM questions WHERE pack_id=$1 AND slot_number=1", [pack.id])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, slot1.id);
  assert.equal(rows[0].prompt_ar, "تصحيح");

  // A public replacement is one atomic change: without its files it is refused and the old question stays.
  const refusedReplace = await save(2, { format: "IMAGE_ZOOM", promptAr: "جديد", answerAr: "y", confirmPublicEdit: true }, "replace", view.slots[1].question.id);
  assert.equal(refusedReplace.body.error, "pack_incomplete");
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM questions WHERE pack_id=$1 AND slot_number=2", [pack.id])).rows[0].n, 1);
  const revisionBefore = (await owner.query("SELECT content_revision FROM question_packs WHERE id=$1", [pack.id])).rows[0].content_revision;
  const replaced = await save(1, { ...standard(9), confirmPublicEdit: true }, "replace", slot1.id);
  assert.equal(replaced.status, 200);
  assert.notEqual(replaced.body.id, slot1.id);
  rows = (await owner.query("SELECT id, retired_at FROM questions WHERE pack_id=$1 AND slot_number=1 ORDER BY retired_at NULLS LAST", [pack.id])).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, slot1.id);
  assert.ok(rows[0].retired_at);
  assert.equal(rows[1].id, replaced.body.id);
  assert.ok((await owner.query("SELECT content_revision FROM question_packs WHERE id=$1", [pack.id])).rows[0].content_revision > revisionBefore, "lobbies that picked the pack must re-confirm");
  // A stale editor cannot overwrite the replacement.
  assert.equal((await save(1, { ...standard(1), confirmPublicEdit: true }, "edit", slot1.id)).body.error, "question_changed");
  // A public pack cannot be left with an empty slot.
  assert.equal((await c.post({ op: "question.retire", packId: pack.id, slot: 1, questionId: replaced.body.id })).body.error, "pack_public");

  // Archiving hides content; restoring re-checks it.
  assert.equal((await c.post({ op: "pack.archive", id: pack.id })).status, 200);
  assert.equal((await c.post({ op: "pack.archive", id: pack.id })).body.error, "no_change");
  assert.equal((await c.post({ op: "pack.unarchive", id: pack.id })).status, 200);
  assert.equal((await c.post({ op: "category.archive", id: football })).status, 200);
  assert.equal((await c.read("?view=home")).categories.some((x) => x.id === football), false);
  assert.equal((await c.read("?view=home&status=archived")).categories.some((x) => x.id === football), true);
  assert.equal((await c.post({ op: "category.unarchive", id: football })).status, 200);

  // A draft's question can be retired.
  const draft = (await c.post({ op: "pack.create", categoryId: football })).body;
  const q = (await c.post({ op: "question.save", packId: draft.id, slot: 1, mode: "create", ...standard(1) })).body.id;
  assert.equal((await c.post({ op: "question.retire", packId: draft.id, slot: 1, questionId: q })).status, 200);
  assert.equal((await c.read(`?view=pack&id=${draft.id}`)).retired.length, 1);

  // Every change left an audit row naming the action.
  const actions = (await owner.query("SELECT DISTINCT action_code FROM staff_audit_events WHERE action_code LIKE 'content.%' ORDER BY 1")).rows.map((r) => r.action_code);
  for (const expected of ["content.section.create", "content.section.rename", "content.section.reorder", "content.category.create", "content.category.update", "content.category.reorder", "content.category.cover", "content.category.archive", "content.category.unarchive", "content.pack.create", "content.pack.publish", "content.pack.archive", "content.pack.unarchive", "content.question.create", "content.question.edit", "content.question.replace", "content.question.retire", "content.media.upload"])
    assert.ok(actions.includes(expected), `${expected} is audited`);
  // Refused attempts are rolled back with their audit row, and replays wrote nothing twice.
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM staff_audit_events WHERE action_code='content.pack.publish'")).rows[0].n, 1);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM staff_audit_events WHERE action_code='content.section.create'")).rows[0].n, 2);
});

test("a content change never touches games already running; archiving hides content from the public catalog; vote counts show", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1 });
  const staffId = randomUUID();
  await f.owner.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [staffId, EMAIL, await hashPassword(PASSWORD)]);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const c = client(base, await login(base));

  const room = await f.create();
  const started = await f.call("POST", `/rooms/${room.roomId}/games`, { expectedRoomVersion: room.roomVersion, expectedReadyGeneration: room.readyGeneration }, { control: room.control });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const gameId = started.body.gameId;
  let version = started.body.gameVersion;
  for (const name of ["open_question", "reveal_answer"]) {
    const r = await f.call("POST", `/games/${gameId}/commands`, { name, expectedGameVersion: version, boardPosition: 1, questionPosition: 1 }, { control: room.control });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    version = r.body.gameVersion;
  }
  const vote = await f.call("PUT", `/games/${gameId}/questions/1/1/feedback`, { expectedFeedbackVersion: "0", vote: "dislike" });
  assert.equal(vote.status, 200, JSON.stringify(vote.body));

  const { packId, categoryId } = f.selections[0];
  const view = await c.read(`?view=pack&id=${packId}`);
  assert.deepEqual(view.slots[0].question.stats, { played: 1, likes: 0, dislikes: 1 });
  assert.deepEqual(view.slots[1].question.stats, { played: 0, likes: 0, dislikes: 0 });

  const snapshots = async () => (await f.owner.query("SELECT question_position, content_snapshot FROM game_questions WHERE game_id=$1 AND board_position=1 ORDER BY 1", [gameId])).rows;
  const before = await snapshots();
  const edit = await c.post({ op: "question.save", packId, slot: 1, mode: "edit", questionId: view.slots[0].question.id, format: "STANDARD", promptAr: "نص معدل", answerAr: "جواب معدل", confirmPublicEdit: true });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  const replace = await c.post({ op: "question.save", packId, slot: 2, mode: "replace", questionId: view.slots[1].question.id, format: "STANDARD", promptAr: "جديد", answerAr: "جديد", confirmPublicEdit: true });
  assert.equal(replace.status, 200, JSON.stringify(replace.body));
  assert.deepEqual(await snapshots(), before, "the running game keeps the copy it started with (ADR 0002)");
  assert.equal((await f.call("GET", `/games/${gameId}`, undefined, { control: room.control })).status, 200);
  // Seen history follows the logical question: the edit keeps it, the replacement starts clean.
  const after = await c.read(`?view=pack&id=${packId}`);
  assert.equal(after.slots[0].question.stats.played, 1);
  assert.equal(after.slots[1].question.stats.played, 0);

  // Archived content leaves the public catalog; restoring brings it back.
  const publicCategories = async () => (await (await fetch(`${f.base}/categories?limit=50`)).json()).items;
  const publicPacks = async () => {
    const response = await fetch(`${f.base}/categories/${categoryId}/packs`);
    assert.equal(response.status, 200);
    return (await response.json()).items.map((pack) => pack.id);
  };
  assert.ok((await publicCategories()).some((x) => x.id === categoryId));
  assert.deepEqual(await publicPacks(), [packId]);
  assert.equal((await c.post({ op: "pack.archive", id: packId })).status, 200);
  assert.equal((await publicCategories()).find((x) => x.id === categoryId).publishedPackCount, 0);
  assert.equal((await c.post({ op: "pack.unarchive", id: packId })).status, 200);
  assert.equal((await publicCategories()).find((x) => x.id === categoryId).publishedPackCount, 1);
  assert.equal((await c.post({ op: "category.archive", id: categoryId })).status, 200);
  assert.equal((await publicCategories()).some((x) => x.id === categoryId), false);
  assert.deepEqual(await publicPacks(), []);
  assert.equal((await c.post({ op: "category.unarchive", id: categoryId })).status, 200);
  assert.deepEqual(await publicPacks(), [packId]);
});
