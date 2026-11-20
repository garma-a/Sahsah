import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { csvLine, parseCsv } from "../dist/admin/content/csv.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { cluster } from "./database/cluster.mjs";
import { mp3, png } from "./fixtures/media-files.mjs";
import { zip } from "./fixtures/zip.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const EMAIL = "importer@example.test", PASSWORD = "importer-password-123";
const HEADER = ["pack", "slot", "format", "prompt_ar", "answer_ar", "prompt_franco", "answer_franco", "prompt_file", "answer_file", "audio_file", "source_file", "allow_forward", "base_file", "hint0_file", "hint0_points", "hint1_file", "hint1_points", "hint2_file", "hint2_points", "color_hex"];

async function startAdmin(t, databaseUrl, media, extra = {}) {
  const admin = await createAdminApplication({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    ADMIN_SESSION_SECRET: SECRET,
    ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000",
    ADMIN_BOOTSTRAP_EMAIL: EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
    GAMEPLAY_LOCAL_MEDIA_DIR: media,
    ...extra,
  });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

const login = async (base) => (await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email: EMAIL, password: PASSWORD }), redirect: "manual" })).headers.get("set-cookie").split(";")[0];

function client(base, cookie) {
  const url = `${base}/admin/api/pages/content`;
  const read = async (query) => ({ status: 0, ...(await (await fetch(url + query, { headers: { Cookie: cookie } })).json()) });
  const send = async (init) => {
    const response = await fetch(url, { method: "POST", headers: { Cookie: cookie }, ...init });
    return { status: response.status, body: await response.json() };
  };
  const post = (body, requestKey = randomUUID()) => send({ headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
  const check = (file, categoryId) => {
    const form = new FormData();
    form.append("requestKey", randomUUID());
    form.append("op", "import.check");
    form.append("categoryId", categoryId);
    form.append("file", new Blob([file]), "pack.zip");
    return send({ body: form });
  };
  return { read, post, check };
}

const csv = (rows) => Buffer.from(`﻿${csvLine(HEADER)}\r\n${rows.map((r) => csvLine(HEADER.map((h) => String(r[h] ?? "")))).join("\r\n")}\r\n`);
const row = (pack, slot, format, extra = {}) => ({ pack, slot, format, prompt_ar: `سؤال ${pack} ${slot}`, answer_ar: `جواب ${slot}`, ...extra });
const file = (name, data) => ({ name, data, store: true });
const png1 = png(300, 200), png2 = png(320, 240, 90);

/** Two packs: six STANDARD questions, and six mixed (composed, blur, reversed audio, colour). */
function goodImport() {
  const rows = [
    row("Alpha", 1, "STANDARD", { prompt_file: "a1.png" }),
    row("Alpha", 2, "standard", { answer_file: "a2.png" }),
    ...[3, 4, 5, 6].map((n) => row("Alpha", n, "STANDARD")),
    row("Beta", 1, "two_step", { base_file: "b1-base.png", hint0_file: "b1-h0.png", hint0_points: 150 }),
    row("Beta", 2, "IMAGE_BLUR", { answer_file: "b2-orig.png", hint0_file: "b2-h0.png", hint0_points: 200, hint1_file: "b2-h1.png", hint1_points: 150, hint2_file: "b2-h2.png", hint2_points: 50 }),
    row("Beta", 3, "AUDIO_REVERSE", { source_file: "b3-src.mp3", audio_file: "b3-rev.mp3", allow_forward: "yes" }),
    row("Beta", 4, "IMAGE_COLOR", { answer_file: "b4-colour.png", prompt_file: "b4-gray.png", color_hex: "#e7a72b" }),
    row("Beta", 5, "STANDARD"),
    row("Beta", 6, "STANDARD"),
  ];
  const names = ["a1.png", "a2.png", "b1-base.png", "b1-h0.png", "b2-orig.png", "b2-h0.png", "b2-h1.png", "b2-h2.png", "b4-colour.png", "b4-gray.png"];
  const files = [...names.map((n) => file(n, n === "a2.png" ? png2 : png1)), file("b3-src.mp3", mp3(60)), file("b3-rev.mp3", mp3(40))];
  return { rows, files };
}
const archive = (rows, files, name = "pack.csv") => zip([file(name, csv(rows)), ...files]);

test("bulk import: templates, dry run, safe ZIP handling, draft import, replay and cleanup", { timeout: 300000 }, async (t) => {
  const cleanup = [], media = await mkdtemp(path.join(tmpdir(), "sahsah-import-media-")), staging = await mkdtemp(path.join(tmpdir(), "sahsah-import-stage-"));
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database("sahsah_admin_import");
  t.after(async () => {
    await owner.end();
    await rm(media, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
    for (const fn of cleanup) await fn();
  });
  const url = pg.url("sahsah_app", "sahsah_admin_import");
  const base = await startAdmin(t, url, media, { ADMIN_IMPORT_DIR: staging });
  const cookie = await login(base);
  const c = client(base, cookie);
  const staged = async () => (await readdir(path.join(staging, "sahsah-import")).catch(() => [])).length;
  const counts = async () => (await owner.query("SELECT (SELECT count(*)::int FROM question_packs) AS packs, (SELECT count(*)::int FROM questions) AS questions, (SELECT count(*)::int FROM media_assets) AS assets, (SELECT count(*)::int FROM staff_audit_events) AS audit")).rows[0];
  const objects = async () => (await readdir(path.join(media, "private", "content")).catch(() => [])).length;

  const section = (await c.post({ op: "section.create", nameAr: "قسم" })).body.id;
  const category = (await c.post({ op: "category.create", nameAr: "استيراد", sectionId: section })).body.id;
  const format = (await c.post({ op: "format.create", nameEn: "Two step", labelAr: "خطوتين", baseKind: "image", stageKinds: ["image"], answerKind: "none", showPrompt: true })).body;
  assert.equal(format.code, "two_step");
  const retired = (await c.post({ op: "format.create", nameEn: "Old one", labelAr: "قديم", baseKind: "audio", stageKinds: [], answerKind: "image", showPrompt: true })).body;
  assert.equal((await c.post({ op: "format.archive", id: retired.id })).status, 200);

  // ---- templates: the columns come from each format's slot list ----
  const columnsOf = async (code) => parseCsv((await c.read(`?view=import-template&format=${code}`)).csv.replace(/^﻿/, ""));
  const base7 = ["pack", "slot", "format", "prompt_ar", "answer_ar", "prompt_franco", "answer_franco"];
  const expected = {
    STANDARD: ["prompt_file", "answer_file"],
    IMAGE_BLUR: ["answer_file", "hint0_file", "hint0_points", "hint1_file", "hint1_points", "hint2_file", "hint2_points"],
    IMAGE_ZOOM: ["answer_file", "hint0_file", "hint0_points", "hint1_file", "hint1_points", "hint2_file", "hint2_points"],
    AUDIO_GUESS: ["audio_file"],
    // The forward clip is the source itself, so it has no column.
    AUDIO_REVERSE: ["allow_forward", "source_file", "audio_file"],
    IMAGE_PERSON: ["answer_file", "prompt_file"],
    IMAGE_COLOR: ["color_hex", "answer_file", "prompt_file"],
    IMAGE_RIDDLE: ["prompt_file"],
    AUDIO_VOICE: ["hint_ar", "hint_franco", "audio_file"],
    IMAGE_MEMORY: ["instruction_ar", "instruction_franco", "prompt_file", "answer_file"],
    IMAGE_CLUES: ["prompt_file", "hint0_file", "hint0_points", "hint1_file", "hint1_points", "hint2_file", "hint2_points", "hint3_file", "hint3_points"],
    CHARADES: ["prompt_file", "answer_file"],
    two_step: ["base_file", "hint0_file", "hint0_points"],
  };
  for (const [code, extra] of Object.entries(expected)) {
    const [header, example] = await columnsOf(code);
    assert.deepEqual(header, [...base7, ...extra], code);
    assert.equal(example.length, header.length, `${code} has one example row`);
    assert.equal(example[2], code);
  }
  assert.equal((await c.read("?view=import-template&format=old_one")).error, "format_archived");
  assert.equal((await c.read("?view=import-template&format=NOPE")).error, "unknown_format");
  assert.equal((await c.read("?view=import-template&format=COMPOSED")).error, "unknown_format");
  const options = await c.read(`?view=import&id=${category}`);
  assert.equal(options.builtIn.length, 12);
  assert.deepEqual(options.composed.map((f) => f.code), ["two_step"], "archived formats are not offered");
  assert.equal(options.limits.zipMegabytes, 200);

  // ---- csv parser ----
  assert.deepEqual(parseCsv('a,"b,""c""",d\r\n\r\n"x\ny",,z\n'), [["a", 'b,"c"', "d"], ["x\ny", "", "z"]]);
  assert.throws(() => parseCsv('a,"b'), /csv_unterminated_quote/);
  assert.throws(() => parseCsv('a,"b"c'), /csv_stray_quote/);

  // ---- dry run: every error class, nothing written ----
  const before = await counts();
  const tiny = png(10, 10);
  const longText = "ا".repeat(4001);
  const bad = [
    row("P1", 1, "STANDARD", { prompt_file: "nope.png" }),
    row("P1", 1, "STANDARD", { prompt_file: "song.mp3" }),
    row("P1", 2, "STANDARD", { prompt_file: "tiny.png" }),
    row("P1", 3, "WOBBLY"),
    { ...row("P1", 4, "STANDARD"), prompt_ar: longText },
    row("P1", 5, "IMAGE_BLUR", { answer_file: "ok.png", hint0_file: "ok.png", hint0_points: "abc", hint1_file: "ok.png", hint1_points: 150 }),
    row("P1", 6, "old_one"),
    row("P1", 6, "STANDARD", { hint0_file: "ok.png" }),
    row("P2", 1, "STANDARD", { prompt_file: "../x.png" }),
    { ...row("P2", 2, "STANDARD"), prompt_ar: "" },
    row("P2", 9, "STANDARD"),
    row("P2", 3, "AUDIO_GUESS", { audio_file: "ok.png" }),
  ];
  const badFiles = [file("ok.png", png1), file("song.mp3", mp3(50)), file("tiny.png", tiny), file("extra.png", png1), file("__MACOSX/._ok.png", "junk"), file(".DS_Store", "junk")];
  const dry = await c.check(archive(bad, badFiles), category);
  assert.equal(dry.status, 200, JSON.stringify(dry.body));
  const report = dry.body;
  assert.equal(report.canImport, false);
  assert.equal(report.summary.ignored, 2, "operating system junk is ignored");
  const found = (rowNumber, code) => report.packs.flatMap((p) => p.rows).find((r) => r.row === rowNumber)?.errors.find((e) => e.code === code);
  assert.equal(found(2, "missing_file").column, "prompt_file");
  assert.equal(found(2, "missing_file").file, "nope.png");
  assert.equal(found(3, "unsupported_image").column, "prompt_file");
  assert.equal(found(3, "duplicate_slot").column, "slot");
  assert.equal(found(4, "image_dimensions").file, "tiny.png");
  assert.equal(found(5, "unknown_format").column, "format");
  assert.ok(found(6, "text_too_long"));
  assert.equal(found(7, "points_required").column, "hint0_points");
  assert.ok(found(7, "missing_hint0") === undefined, "a stage that failed is not also reported as missing");
  assert.ok(found(7, "missing_hint2"), "a required stage with no file is reported");
  assert.equal(found(8, "format_archived").column, "format");
  assert.equal(found(9, "column_not_used").column, "hint0_file");
  assert.equal(found(10, "bad_file_name").column, "prompt_file");
  assert.ok(found(11, "prompt_missing"));
  assert.equal(found(12, "invalid_slot").column, "slot");
  assert.equal(found(13, "unsupported_audio").file, "ok.png");
  const p1 = report.packs.find((p) => p.label === "P1");
  assert.match(p1.errors[0].message, /has 8 rows/);
  assert.ok(report.errors.some((e) => e.code === "unused_file" && e.file === "extra.png"));
  assert.ok(!report.errors.some((e) => e.file === "ok.png" && e.code === "unused_file"));
  assert.deepEqual(await counts(), before, "a dry run writes no database rows");
  assert.equal(await objects(), 0, "a dry run stores no objects");
  const refused = await c.post({ op: "import.run", id: report.id });
  assert.equal(refused.body.error, "import_has_errors");
  assert.equal(refused.status, 409);
  assert.deepEqual(await counts(), before);
  await rm(path.join(staging, "sahsah-import"), { recursive: true, force: true });

  // ---- file-level problems ----
  const refuse = async (buffer, code) => assert.equal((await c.check(buffer, category)).body.error, code, code);
  const asReport = async (buffer) => (await c.check(buffer, category)).body;
  await refuse(Buffer.from("this is not a zip"), "zip_unreadable");
  await refuse(zip([file("a.png", png1)]), "csv_missing");
  await refuse(zip([file("pack.csv", "x"), file("sub/pack.csv", "x")]), "csv_multiple");
  await refuse(zip([file("pack.csv", csv([])), file("../evil.png", png1)]), "zip_unsafe_path");
  await refuse(zip([file("pack.csv", csv([])), file("/abs.png", png1)]), "zip_unsafe_path");
  await refuse(zip([file("pack.csv", csv([])), file("a\\b.png", png1)]), "zip_unsafe_path");
  await refuse(zip([file("pack.csv", csv([])), { name: "link.png", data: "pack.csv", store: true, mode: 0o120777 }]), "zip_unsafe_path");
  await refuse(zip([file("pack.csv", csv([])), file("a/b/c.png", png1)]), "zip_nested");
  await refuse(zip([file("pack.csv", csv([])), file("a.png", png1), file("a.png", png1)]), "zip_duplicate_name");
  await refuse(zip(Array.from({ length: 2001 }, (_, n) => file(`f${n}.txt`, ""))), "zip_too_many_entries");
  // Zip bomb: a file that inflates past the per-entry cap, a header that lies, and a total over the cap.
  await refuse(zip([file("pack.csv", csv([])), { name: "bomb.png", data: Buffer.alloc(30 * 1024 * 1024) }]), "zip_entry_too_large");
  await refuse(zip([file("pack.csv", csv([])), ...Array.from({ length: 17 }, (_, n) => ({ name: `big${n}.png`, data: "x", declared: 24 * 1024 * 1024 }))]), "zip_too_large");
  const lie = await asReport(archive([row("L", 1, "STANDARD", { prompt_file: "lie.png" })], [{ name: "lie.png", data: Buffer.alloc(8 * 1024 * 1024), declared: 100 }]));
  assert.ok(lie.packs[0].rows[0].errors.some((e) => e.code === "zip_entry_unreadable"), "a lying size header is caught while reading");
  assert.equal((await asReport(zip([file("pack.csv", Buffer.from([0xff, 0xfe, 0x61, 0x00]))]))).errors[0].code, "csv_encoding");
  assert.equal((await asReport(zip([file("pack.csv", "pack;slot;format\n")]))).errors[0].code, "csv_delimiter");
  assert.equal((await asReport(zip([file("pack.csv", "pack,slot,format,prompt_ar,answer_ar,colour\n")]))).errors.some((e) => e.code === "unknown_column" && e.column === "colour"), true);
  assert.equal((await asReport(zip([file("pack.csv", "pack,slot\nA,1\n")]))).errors.filter((e) => e.code === "missing_column").length, 3);
  assert.equal((await asReport(zip([file("pack.csv", `${csvLine(HEADER)}\n`)]))).errors[0].code, "no_rows");
  assert.equal((await asReport(zip([file("pack.csv", `${csvLine(HEADER)}\nA,1\n`)]))).packs[0].rows[0].errors[0].code, "row_shape");
  assert.equal(await staged() <= 1, true, "refused uploads leave nothing behind");
  assert.deepEqual(await counts(), before);

  // A five-row pack and one with a gap are both refused, naming the missing slots.
  const short = await asReport(archive([1, 2, 3, 4, 6].map((n) => row("Short", n, "STANDARD")), []));
  assert.match(short.packs[0].errors[0].message, /5 rows.*no row for slot 5/);

  // ---- a good import: previews, session binding, drafts ----
  const good = goodImport();
  const checked = await c.check(archive(good.rows, good.files), category);
  assert.equal(checked.status, 200, JSON.stringify(checked.body));
  const ok = checked.body;
  assert.equal(ok.canImport, true, JSON.stringify(ok.errors));
  assert.deepEqual([ok.summary.packs, ok.summary.questions, ok.summary.files, ok.summary.errors], [2, 12, 12, 0]);
  const withFile = ok.packs[0].rows[0].files[0];
  assert.match(withFile.detail, /300×200/);
  const preview = await fetch(base + withFile.url);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.equal(preview.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png1);
  const audioFile = ok.packs[1].rows[2].files[0];
  assert.equal((await fetch(base + audioFile.url)).headers.get("content-type"), "audio/mpeg");
  assert.equal((await fetch(base + withFile.url.replace(/sig=[0-9a-f]/, "sig=0"))).status, 404, "a tampered link is refused");
  assert.equal((await fetch(base + withFile.url.replace("a1.png", "a2.png"))).status, 404, "a link works for its own file only");
  assert.equal(await objects(), 0);
  assert.deepEqual(await counts(), before, "the report is still a dry run");
  // Another session of the same staff member cannot use the staged upload.
  const other = client(base, await login(base));
  assert.equal((await other.post({ op: "import.run", id: ok.id })).body.error, "import_expired");
  // A new check replaces the staff member's earlier staged upload.
  assert.equal(await staged(), 1);

  const key = randomUUID();
  const [one, two] = await Promise.all([c.post({ op: "import.run", id: ok.id }, key), c.post({ op: "import.run", id: ok.id }, key)]);
  const results = [one, two].map((r) => r.body);
  assert.equal(results.filter((r) => !r.replayed).length, 1, JSON.stringify(results));
  const done = results.find((r) => !r.replayed);
  assert.equal(done.status ?? 200, 200);
  assert.deepEqual([done.packs.length, done.questions, done.files], [2, 12, 12]);
  const replay = (await c.post({ op: "import.run", id: ok.id }, key)).body;
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.packs, done.packs, "a retry reports the packs of the first attempt");
  const after = await counts();
  assert.deepEqual([after.packs, after.questions, after.assets], [2, 12, 12], "nothing was duplicated");
  assert.equal(await objects(), 12);
  assert.equal(await staged(), 0, "the staged upload is removed after the import");

  // Drafts only, in order, in the chosen category.
  const packs = (await owner.query("SELECT id, pack_number, publication_state, category_id FROM question_packs ORDER BY pack_number")).rows;
  assert.deepEqual(packs.map((p) => [p.pack_number, p.publication_state, p.category_id]), [[1, "draft", category], [2, "draft", category]]);
  assert.deepEqual(done.packs.map((p) => p.label), ["Alpha", "Beta"]);
  const beta = packs[1].id;
  const questions = (await owner.query("SELECT id, slot_number, format, composed_format_id, format_config FROM questions WHERE pack_id=$1 ORDER BY slot_number", [beta])).rows;
  assert.deepEqual(questions.map((q) => q.format), ["COMPOSED", "IMAGE_BLUR", "AUDIO_REVERSE", "IMAGE_COLOR", "STANDARD", "STANDARD"]);
  assert.equal(questions[0].composed_format_id, format.id);
  assert.deepEqual(questions[2].format_config, { allowForward: true });
  assert.deepEqual(questions[3].format_config, { colorHex: "#e7a72b" });
  // Lineage: every derived file points at this question's own original, with its operation.
  const lineage = (await owner.query(
    `SELECT qm.media_role, qm.variant_number, qm.suggested_points, a.state, a.access_scope, a.source_asset_id, a.transform_spec, o.id AS original
       FROM question_media qm JOIN media_assets a ON a.id=qm.media_asset_id
       LEFT JOIN question_media oq ON oq.question_id=qm.question_id AND oq.media_role IN ('answer_image','source_audio')
       LEFT JOIN media_assets o ON o.id=oq.media_asset_id
      WHERE qm.question_id=$1 ORDER BY qm.media_role, qm.variant_number`,
    [questions[1].id],
  )).rows;
  const hints = lineage.filter((r) => r.media_role === "hint_image");
  assert.equal(hints.length, 3);
  for (const [i, h] of hints.entries()) {
    assert.equal(h.state, "ready");
    assert.equal(h.access_scope, "private");
    assert.equal(h.source_asset_id, h.original);
    assert.deepEqual(h.transform_spec, { operation: "blur", stageIndex: i });
  }
  assert.deepEqual(hints.map((h) => h.suggested_points), [200, 150, 50]);
  const reverse = (await owner.query("SELECT qm.media_role, a.source_asset_id, a.transform_spec FROM question_media qm JOIN media_assets a ON a.id=qm.media_asset_id WHERE qm.question_id=$1 ORDER BY qm.media_role", [questions[2].id])).rows;
  assert.deepEqual(reverse.map((r) => r.media_role).sort(), ["answer_audio", "question_audio", "source_audio"], "the forward clip pin is added as the editor does");
  assert.equal(reverse.find((r) => r.media_role === "question_audio").transform_spec.operation, "reverse");
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM media_assets WHERE storage_key !~ '^content/'")).rows[0].n, 0);

  // Audit: one import event with counts, one event per pack.
  const events = (await owner.query("SELECT action_code, target_kind, details FROM staff_audit_events WHERE action_code IN ('content.import','content.pack.create') ORDER BY created_at, id")).rows;
  const importEvent = events.filter((e) => e.action_code === "content.import");
  assert.equal(importEvent.length, 1);
  assert.deepEqual([importEvent[0].details.packCount, importEvent[0].details.questions, importEvent[0].details.files], [2, 12, 12]);
  assert.deepEqual(importEvent[0].details.formats, { STANDARD: 8, two_step: 1, IMAGE_BLUR: 1, AUDIO_REVERSE: 1, IMAGE_COLOR: 1 });
  assert.equal(events.filter((e) => e.action_code === "content.pack.create" && e.details.import === true).length, 2);

  // The editor sees the drafts as complete, and the shared publish rule accepts them.
  const view = await c.read(`?view=pack&id=${beta}`);
  assert.deepEqual(view.issues, []);
  assert.equal(view.pack.publicationState, "draft");
  assert.equal((await c.read(`?view=category&id=${category}`)).packs.length, 2);
  assert.equal((await c.post({ op: "pack.publish", id: beta })).status, 200, "imported drafts satisfy the publish rules");

  // A second import continues the pack numbers; a stale upload id is refused.
  const again = await c.check(zip([file("wrapper/pack.csv", csv(good.rows.slice(0, 6))), file("wrapper/a1.png", png1), file("wrapper/a2.png", png2)]), category);
  const second = await c.post({ op: "import.run", id: again.body.id });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal((await owner.query("SELECT max(pack_number)::int AS n FROM question_packs")).rows[0].n, 3);
  assert.equal((await c.post({ op: "import.run", id: again.body.id })).body.error, "import_expired");
  assert.equal(await staged(), 0);

  // An archived category takes no imports.
  assert.equal((await c.post({ op: "category.archive", id: category })).status, 200);
  assert.equal((await c.check(archive(good.rows.slice(0, 6), good.files.slice(0, 2)), category)).body.error, "category_archived");
  assert.equal((await c.check(archive(good.rows.slice(0, 6), good.files.slice(0, 2)), randomUUID())).body.error, "not_found");
  assert.equal(await staged(), 0);
});

test("staged uploads expire and are removed; signed previews stop working", { timeout: 120000 }, async (t) => {
  const cleanup = [], media = await mkdtemp(path.join(tmpdir(), "sahsah-import-media-")), staging = await mkdtemp(path.join(tmpdir(), "sahsah-import-stage-"));
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database("sahsah_admin_import_expiry");
  t.after(async () => {
    await owner.end();
    await rm(media, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
    for (const fn of cleanup) await fn();
  });
  const base = await startAdmin(t, pg.url("sahsah_app", "sahsah_admin_import_expiry"), media, { ADMIN_IMPORT_DIR: staging, ADMIN_IMPORT_TTL_MS: "1500" });
  const c = client(base, await login(base));
  const section = (await c.post({ op: "section.create", nameAr: "قسم" })).body.id;
  const category = (await c.post({ op: "category.create", nameAr: "استيراد", sectionId: section })).body.id;
  const good = goodImport();
  const first = await c.check(archive(good.rows.slice(0, 6), good.files.slice(0, 2)), category);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const link = first.body.packs[0].rows[0].files[0].url;
  assert.equal((await fetch(base + link)).status, 200);
  assert.equal((await readdir(path.join(staging, "sahsah-import"))).length, 1);
  await new Promise((resolve) => setTimeout(resolve, 1800));
  assert.equal((await fetch(base + link)).status, 404, "an expired link is refused");
  assert.equal((await c.post({ op: "import.run", id: first.body.id })).body.error, "import_expired");
  assert.equal((await readdir(path.join(staging, "sahsah-import"))).length, 0, "the expired upload is removed");
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM question_packs")).rows[0].n, 0);
});
