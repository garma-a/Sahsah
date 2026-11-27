import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { questionView, answerView, hintStages } from "../dist/gameplay/games/content.js";
import { gameplayFixture } from "./gameplay/fixture.mjs";
import { mp3, png } from "./fixtures/media-files.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const EMAIL = "formats@example.test", PASSWORD = "formats-password-123";

async function startAdmin(t, databaseUrl, media) {
  const admin = await createAdminApplication({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    ADMIN_SESSION_SECRET: SECRET,
    ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000",
    GAMEPLAY_LOCAL_MEDIA_DIR: media,
  });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function client(base) {
  const login = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email: EMAIL, password: PASSWORD }), redirect: "manual" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const url = `${base}/admin/api/pages/content`;
  const read = async (query) => (await fetch(url + query, { headers: { Cookie: cookie } })).json();
  const post = async (body, requestKey = randomUUID()) => {
    const response = await fetch(url, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
    return { status: response.status, body: await response.json() };
  };
  const upload = async (purpose, file, name) => {
    const form = new FormData();
    form.append("requestKey", randomUUID());
    form.append("op", "media.upload");
    form.append("purpose", purpose);
    form.append("file", new Blob([file]), name);
    const response = await fetch(url, { method: "POST", headers: { Cookie: cookie }, body: form });
    return (await response.json()).asset;
  };
  return { read, post, upload };
}

test("staff-defined formats: CRUD and audit, constraints, publish validation, a full game, snapshot isolation", { timeout: 300000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 1 });
  const dir = await mkdtemp(path.join(tmpdir(), "sahsah-formats-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await f.owner.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), EMAIL, await hashPassword(PASSWORD)]);
  const c = await client(await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"), dir));

  // ---- format CRUD, validation and audit ----
  const spec = { nameEn: "Zoom 3 stages", labelAr: "زوم", baseKind: "image", stageKinds: ["image", "image", "image"], answerKind: "image", showPrompt: true };
  const created = await c.post({ op: "format.create", ...spec });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.code, "zoom_3_stages");
  assert.equal((await c.post({ op: "format.create", ...spec })).body.error, "format_exists");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "Four", stageKinds: ["image", "image", "image", "image"] })).body.error, "invalid_stages");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "Bad", stageKinds: ["video"] })).body.error, "invalid_stages");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "Bad", baseKind: "video" })).body.error, "invalid_base");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "Empty", baseKind: "text", stageKinds: [], answerKind: "none" })).body.error, "format_empty");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "No label", labelAr: " " })).body.error, "label_required");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: " " })).body.error, "format_name_required");
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "a".repeat(81) })).body.error, "format_name_too_long");
  assert.equal((await c.post({ op: "format.create", ...spec, labelAr: "س".repeat(81) })).body.error, "label_too_long");
  const key = randomUUID();
  assert.equal((await c.post({ op: "format.create", ...spec, nameEn: "Voice ladder", baseKind: "audio", stageKinds: ["audio"], answerKind: "audio", labelAr: "صوت" }, key)).status, 200);
  assert.deepEqual((await c.post({ op: "format.create", ...spec, nameEn: "Voice ladder", baseKind: "audio", stageKinds: ["audio"], answerKind: "audio", labelAr: "صوت" }, key)).body, { replayed: true });
  const list = await c.read("?view=formats");
  assert.equal(list.builtIn.length, 12);
  assert.equal((await c.read("?view=formats")).composed.length, 2);
  assert.equal(list.mobileSupported, false);
  const zoom = list.composed.find((x) => x.code === "zoom_3_stages");
  assert.equal(zoom.slots.length, 5, "start picture, three hint pictures and the answer picture");
  assert.match(zoom.description, /^4 stages\./);
  const audioFormat = list.composed.find((x) => x.code === "voice_ladder");

  // ---- database check: COMPOSED exactly when a format is referenced ----
  const { packId } = f.selections[0];
  const insert = (format, formatId) => f.owner.query("INSERT INTO questions(id,pack_id,slot_number,format,composed_format_id,prompt_ar,answer_ar,retired_at) VALUES($1,$2,1,$3,$4,'p','a',now())", [randomUUID(), packId, format, formatId]);
  await assert.rejects(insert("COMPOSED", null), /questions_composed_format_pair/);
  await assert.rejects(insert("STANDARD", zoom.id), /questions_composed_format_pair/);

  // ---- publish validation uses the definition ----
  let view = await c.read(`?view=pack&id=${packId}`);
  assert.equal(view.composedFormats.length, 2);
  const save = (slot, extra, mode = "replace") => c.post({ op: "question.save", packId, slot, mode, questionId: view.slots[slot - 1].question?.id, confirmPublicEdit: true, ...extra });
  const [original, h0, h1, h2, answer] = await Promise.all([1, 2, 3, 4, 5].map((n) => c.upload("image", png(300 + n, 200), `s${n}.png`)));
  const media = (points) => [
    { key: "base", assetId: original.id }, { key: "hint0", assetId: h0.id, points: points[0] }, { key: "hint1", assetId: h1.id, points: points[1] },
    { key: "hint2", assetId: h2.id, points: points[2] }, { key: "answer", assetId: answer.id },
  ];
  const composedQuestion = { format: "COMPOSED", composedFormatId: zoom.id, promptAr: "مين في الصورة؟", answerAr: "الجواب" };
  const missing = await save(1, { ...composedQuestion, media: media([150, 100, 50]).filter((m) => m.key !== "hint1") });
  assert.equal(missing.body.error, "pack_incomplete");
  assert.ok(missing.body.issues.some((i) => i.code === "missing_hint1"), "a missing stage file is refused");
  const rising = await save(1, { ...composedQuestion, media: media([150, 150, 50]) });
  assert.ok(rising.body.issues.some((i) => i.code === "config_invalid"), "suggested points must keep falling");
  assert.equal((await save(1, { ...composedQuestion, composedFormatId: undefined, media: media([150, 100, 50]) })).body.error, "format_required");
  assert.equal((await save(1, { ...composedQuestion, media: [{ key: "bogus", assetId: original.id }] })).body.error, "invalid_media");
  assert.equal((await c.read(`?view=pack&id=${packId}`)).slots[0].question.format, "STANDARD", "refusals left the old question in place");
  const saved = await save(1, { ...composedQuestion, media: media([150, 100, 50]) });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  // A second composed question: audio base, one audio hint, audio answer.
  view = await c.read(`?view=pack&id=${packId}`);
  const [a0, a1, a2] = await Promise.all([1, 2, 3].map((n) => c.upload("audio", mp3(), `a${n}.mp3`)));
  const audioSaved = await save(2, { format: "COMPOSED", composedFormatId: audioFormat.id, promptAr: "اسمع", answerAr: "x", media: [{ key: "base", assetId: a0.id }, { key: "hint0", assetId: a1.id, points: 100 }, { key: "answer", assetId: a2.id }] });
  assert.equal(audioSaved.status, 200, JSON.stringify(audioSaved.body));
  // A correction cannot move a composed question to another format.
  view = await c.read(`?view=pack&id=${packId}`);
  assert.equal((await save(2, { format: "COMPOSED", composedFormatId: zoom.id, promptAr: "x", answerAr: "y", media: [] }, "edit")).body.error, "format_change_needs_replacement");

  // ---- a full game through the existing pipeline ----
  // The edits bumped the pack revision; a lobby has to pick the pack at its current revision.
  f.selections[0].observedRevision = String((await f.owner.query("SELECT content_revision FROM question_packs WHERE id=$1", [packId])).rows[0].content_revision);
  const room = await f.create();
  const started = await f.call("POST", `/rooms/${room.roomId}/games`, { expectedRoomVersion: room.roomVersion, expectedReadyGeneration: room.readyGeneration }, { control: room.control });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const gameId = started.body.gameId;
  let version = started.body.gameVersion;
  const command = async (name, extra = {}, question = [1, 1]) => {
    const r = await f.call("POST", `/games/${gameId}/commands`, { name, expectedGameVersion: version, boardPosition: question[0], questionPosition: question[1], ...extra }, { control: room.control });
    if (r.status === 200) version = r.body.gameVersion;
    return r;
  };
  const snapshot = async () => (await f.call("GET", `/games/${gameId}`, undefined, { control: room.control })).body.view;

  // Snapshot isolation: the format is edited after the game started and before the question opens.
  const copy = (await f.owner.query("SELECT content_snapshot FROM game_questions WHERE game_id=$1 AND board_position=1 AND question_position=1", [gameId])).rows[0].content_snapshot;
  assert.equal(copy.composed.labelAr, "زوم");
  assert.deepEqual(copy.config.stageSuggestions, [200, 150, 100, 50]);
  // The shape cannot change under questions that use it; the label and prompt switch can.
  assert.equal((await c.post({ op: "format.update", id: zoom.id, ...spec, stageKinds: ["image"] })).body.error, "format_in_use");
  const edited = await c.post({ op: "format.update", id: zoom.id, ...spec, labelAr: "تقريب", showPrompt: false });
  assert.equal(edited.status, 200);
  const spare = (await c.post({ op: "format.create", ...spec, nameEn: "Spare" })).body.id;
  assert.equal((await c.post({ op: "format.update", id: spare, ...spec, nameEn: "Spare", stageKinds: ["image"] })).status, 200, "an unused format can change shape");
  assert.equal((await f.owner.query("SELECT content_snapshot->'composed' AS composed FROM game_questions WHERE game_id=$1 AND board_position=1 AND question_position=1", [gameId])).rows[0].composed.showPrompt, true, "the running game keeps its copy");

  assert.equal((await command("open_question")).status, 200);
  let view1 = await snapshot();
  assert.equal(view1.phase, "question");
  assert.deepEqual(view1.question, { format: "COMPOSED", label: "زوم", baseKind: "image", prompt: "مين في الصورة؟" /* still shown: the game copied showPrompt=true */, stageIndex: 0, stageSuggestions: [200, 150, 100, 50], mediaKind: "image", image: { kind: "image", boardPosition: 1, questionPosition: 1, role: "prompt_image", variantNumber: 0 } });
  assert.equal(view1.suggestedPoints, 200);
  assert.ok(view1.controls.includes("advance_hint"));
  for (const [stage, points] of [[1, 150], [2, 100], [3, 50]]) {
    assert.equal((await command("advance_hint")).status, 200);
    view1 = await snapshot();
    assert.equal(view1.question.stageIndex, stage);
    assert.equal(view1.suggestedPoints, points);
    assert.deepEqual(view1.question.image, { kind: "image", boardPosition: 1, questionPosition: 1, role: "hint_image", variantNumber: stage - 1 });
  }
  assert.equal(view1.controls.includes("advance_hint"), false);
  assert.notEqual((await command("advance_hint")).status, 200, "no stage past the last one");
  assert.equal((await command("reveal_answer")).status, 200);
  view1 = await snapshot();
  assert.equal(view1.phase, "answer");
  assert.deepEqual(view1.answer, { format: "COMPOSED", text: "الجواب", image: { kind: "image", boardPosition: 1, questionPosition: 1, role: "answer_image", variantNumber: 0 } });
  assert.equal((await command("resolve_question", { winningTeamNumber: 1 })).status, 200);
  const board = await snapshot();
  assert.equal(board.teams[0].score, "50", "the award is the suggestion of the stage that was showing");

  // The audio format: the host gets the clip, the answer clip is host-only.
  assert.equal((await command("open_question", {}, [1, 2])).status, 200);
  const audioView = await snapshot();
  assert.equal(audioView.question.mediaKind, "audio");
  assert.equal(audioView.question.audio.role, "question_audio");
  assert.ok(audioView.question.durationMs > 1000);
  assert.equal((await command("advance_hint", {}, [1, 2])).status, 200);
  assert.equal((await snapshot()).question.audio.role, "hint_audio");
  assert.equal((await command("reveal_answer", {}, [1, 2])).status, 200);
  const audioAnswer = (await snapshot()).answer;
  assert.equal(audioAnswer.audio.role, "answer_audio");
  assert.equal(audioAnswer.image, undefined);

  // Viewers never receive audio references, only durations; hint stages count from the copied definition.
  const row = { format: "COMPOSED", boardPosition: 1, questionPosition: 2, stageIndex: 1, contentSnapshot: { promptAr: "p", answerAr: "a", config: { stageSuggestions: [200, 100] }, composed: { code: "v", nameEn: "V", labelAr: "صوت", baseKind: "audio", stageKinds: ["audio"], answerKind: "audio", showPrompt: false } } };
  const pins = [{ mediaRole: "hint_audio", variantNumber: 0, durationMs: 2000 }, { mediaRole: "answer_audio", variantNumber: 0, durationMs: 1500 }];
  assert.equal(hintStages(row), 2);
  assert.deepEqual(questionView(row, pins, false, "ar"), { format: "COMPOSED", label: "صوت", baseKind: "audio", stageIndex: 1, mediaKind: "audio", stageSuggestions: [200, 100], durationMs: 2000 });
  assert.equal(answerView(row, pins, false, "ar").audio, undefined);

  // ---- archive: hidden from new questions, existing questions stay valid ----
  assert.equal((await c.post({ op: "format.archive", id: audioFormat.id })).status, 200);
  assert.equal((await c.post({ op: "format.archive", id: audioFormat.id })).body.error, "no_change");
  view = await c.read(`?view=pack&id=${packId}`);
  assert.equal(view.issues.length, 0, "a question whose format is archived is still valid");
  assert.equal((await save(3, { format: "COMPOSED", composedFormatId: audioFormat.id, promptAr: "x", answerAr: "y", media: [] })).body.error, "format_archived");
  assert.equal((await c.read("?view=formats")).composed.find((x) => x.id === audioFormat.id).usedBy, 1);
  assert.equal((await c.post({ op: "format.unarchive", id: audioFormat.id })).status, 200);

  // Every change was audited, with the previous values on edits.
  const audit = (await f.owner.query("SELECT action_code, details FROM staff_audit_events WHERE action_code LIKE 'content.format.%' ORDER BY created_at")).rows;
  for (const expected of ["create", "update", "archive", "unarchive"]) assert.ok(audit.some((r) => r.action_code === `content.format.${expected}`), `${expected} is audited`);
  assert.equal(audit.find((r) => r.action_code === "content.format.update").details.previous.labelAr, "زوم");
});
