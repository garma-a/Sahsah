import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { FORMAT_LABELS, Field, Notice, button, card, colors, get, input, useSend } from "./content-ui";

const PAGE = "/admin/pages/content";
const FORMATS = Object.keys(FORMAT_LABELS).filter((f) => f !== "COMPOSED");
const STATES = { draft: "Draft", published: "Published", archived: "Archived" };

// ---- preview as a player ---------------------------------------------------------------------

/** The stages a player sees, in order: each hint stage, then the answer. Simplified, not the real screen. */
function stagesFor(q, slotPoints, composed) {
  const url = (role, variant = 0) => q.media.find((m) => m.role === role && m.variant === variant)?.url ?? null;
  const pts = (variant) => q.media.find((m) => m.role === "hint_image" && m.variant === variant)?.points ?? null;
  const answer = { name: "Answer revealed", answerText: true, image: url("answer_image"), color: q.config.colorHex };
  switch (q.format) {
    case "COMPOSED": {
      const kinds = composed?.stageKinds ?? [];
      const media = (role, variant) => ({ [role.endsWith("audio") ? "audio" : "image"]: url(role, variant) });
      const stages = [{ name: "Stage 1 (start)", points: slotPoints, prompt: composed?.showPrompt, ...(composed?.baseKind === "image" ? media("prompt_image", 0) : composed?.baseKind === "audio" ? media("question_audio", 0) : {}) }];
      kinds.forEach((kind, i) => stages.push({ name: `Stage ${i + 2} (hint ${i + 1})`, points: q.media.find((m) => m.role === `hint_${kind}` && m.variant === i)?.points ?? null, prompt: composed?.showPrompt, ...media(`hint_${kind}`, i) }));
      return stages.concat({ name: "Answer revealed", answerText: true, image: url("answer_image"), audio: url("answer_audio") });
    }
    case "IMAGE_BLUR":
    case "IMAGE_ZOOM":
      return [0, 1, 2].map((i) => ({ name: `Hint stage ${i + 1}`, points: pts(i), image: url("hint_image", i), prompt: true })).concat(answer);
    case "IMAGE_CLUES":
      return [0, 1, 2, 3]
        .filter((i) => i === 0 || url("hint_image", i - 1))
        .map((i) => ({ name: i === 0 ? "Picture only" : `Clue ${i} revealed`, points: i === 0 ? slotPoints : pts(i - 1), image: url("prompt_image"), clues: [...Array(i).keys()].map((c) => url("hint_image", c)), prompt: true }))
        .concat(answer);
    case "IMAGE_MEMORY":
      return [
        { name: "Viewing the scene", image: url("prompt_image"), instruction: true },
        { name: "Recall (scene hidden)", prompt: true },
        { name: "Answer revealed", answerText: true, image: url("answer_image") },
      ];
    case "CHARADES":
      return [
        { name: "Shared screen", prompt: true, note: "A code is shown; the card stays private." },
        { name: "Private card (opened by the code)", image: url("prompt_image"), prompt: false },
        { ...answer },
      ];
    case "AUDIO_GUESS":
    case "AUDIO_VOICE":
    case "AUDIO_REVERSE":
      return [
        { name: "Question (host plays the clip)", prompt: true, audio: url("question_audio"), hint: q.format === "AUDIO_VOICE" },
        { name: "Answer revealed", answerText: true, audio: q.config.allowForward ? url("answer_audio") : null },
      ];
    default:
      return [{ name: "Question", prompt: true, image: url("prompt_image") }, { ...answer }];
  }
}

const Preview = ({ question, slotPoints, composed }) => {
  const stages = stagesFor(question, slotPoints, composed);
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState("ar");
  const stage = stages[Math.min(index, stages.length - 1)];
  const pick = (ar, franco) => (lang === "franco" && franco ? franco : ar);
  return (
    <div style={{ ...card, background: colors.cream }}>
      <Box flex style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {stages.map((s, i) => (
          <button key={i} type="button" style={button(i === index ? "primary" : "secondary")} onClick={() => setIndex(i)}>{s.name}</button>
        ))}
        <select aria-label="Preview language" style={{ ...input, width: 140 }} value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="ar">Arabic</option>
          <option value="franco">Franco-Arabic</option>
        </select>
      </Box>
      <div data-testid="preview" style={{ maxWidth: 420, margin: "0 auto", background: colors.forest, color: "#fff", borderRadius: 16, padding: 20, minHeight: 240, overflowWrap: "anywhere" }} dir={lang === "franco" ? "ltr" : "rtl"}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }} dir="ltr">
          {stage.points ? `Suggested points: ${stage.points}` : `Tile value: ${slotPoints}`}
        </div>
        {stage.instruction && <p>{pick(question.config.instructionAr ?? "احفظ الصورة ثم أخفها للإجابة", question.config.instructionFranco)}</p>}
        {stage.prompt !== false && !stage.answerText && stage.prompt && <p style={{ fontSize: 20, fontWeight: 700 }}>{pick(question.promptAr, question.promptFranco)}</p>}
        {stage.hint && (question.config.hintAr || question.config.hintFranco) && <p style={{ opacity: 0.85 }}>{pick(question.config.hintAr ?? "", question.config.hintFranco)}</p>}
        {stage.note && <p style={{ opacity: 0.8 }}>{stage.note}</p>}
        {stage.image ? <img src={stage.image} alt="" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, display: "block", margin: "8px auto" }} /> : stage.image === null ? <p style={{ opacity: 0.7 }} dir="ltr">Picture not available</p> : null}
        {stage.clues?.map((clue, i) => clue && <img key={i} src={clue} alt="" style={{ maxHeight: 90, borderRadius: 6, margin: 4 }} />)}
        {stage.audio && <audio controls src={stage.audio} style={{ width: "100%", marginTop: 8 }} />}
        {stage.answerText && (
          <>
            <p style={{ fontSize: 20, fontWeight: 700, color: colors.gold }}>{pick(question.answerAr, question.answerFranco)}</p>
            {stage.color && <div aria-label="Colour swatch" style={{ width: 48, height: 48, borderRadius: 8, background: stage.color }} />}
          </>
        )}
      </div>
      <Text fontSize="xs" color="grey60" mt="sm">A simplified preview using short-lived links. The real screen may differ in layout.</Text>
    </div>
  );
};

// ---- slot editor -----------------------------------------------------------------------------

const toForm = (slot, defaultFormat = "STANDARD") => {
  const q = slot.question;
  const media = {};
  for (const m of q?.media ?? []) media[`${m.role}:${m.variant}`] = m;
  return {
    format: q?.format ?? defaultFormat,
    composedFormatId: q?.composedFormatId ?? null,
    promptAr: q?.promptAr ?? "",
    promptFranco: q?.promptFranco ?? "",
    answerAr: q?.answerAr ?? "",
    answerFranco: q?.answerFranco ?? "",
    config: { ...(q?.config ?? {}) },
    media,
  };
};

const SlotEditor = ({ data, slot, published, isPublic, onDone, setNotice }) => {
  const q = slot.question;
  const [mode, setMode] = useState(q ? "edit" : "create");
  const [form, setForm] = useState(() => toForm(slot));
  const [confirm, setConfirm] = useState(false);
  const { send, busy } = useSend(setNotice);
  const [uploading, setUploading] = useState(null);
  const composed = form.format === "COMPOSED" ? data.composedFormats.find((f) => f.id === form.composedFormatId) : null;
  const specs = (composed ? composed.slots : data.formats[form.format]).filter((s) => composed || s.role !== "answer_audio");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setConfig = (key, value) => setForm({ ...form, config: { ...form.config, [key]: value } });
  const stageDefaults = data.defaultStages[slot.points];
  const switchMode = (next) => {
    setMode(next);
    // A replacement starts from the old wording but with no files: it is a new question.
    setForm(next === "replace" ? { ...toForm(slot), media: {} } : toForm(slot));
  };

  const onFile = async (spec, file) => {
    if (!file) return;
    setUploading(spec.key);
    const done = await send({ op: "media.upload", purpose: spec.kind, file });
    setUploading(null);
    const asset = done?.asset;
    if (!asset) return;
    const id = `${spec.role}:${spec.variant}`;
    const hintCount = composed?.stageKinds.length ?? 0;
    const composedDefault = Math.max(10, Math.round((slot.points * (hintCount - spec.variant)) / (hintCount + 1) / 10) * 10);
    const points = form.media[id]?.points ?? (spec.points ? (form.format === "IMAGE_CLUES" ? null : composed ? composedDefault : stageDefaults?.[spec.variant]) : null);
    setForm((f) => ({ ...f, media: { ...f.media, [id]: { role: spec.role, variant: spec.variant, points, asset, url: asset.url } } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const media = specs.flatMap((spec) => {
      const m = form.media[`${spec.role}:${spec.variant}`];
      return m ? [{ key: spec.key, assetId: m.asset.id, ...(spec.points ? { points: Number(m.points) } : {}) }] : [];
    });
    const done = await send({
      op: "question.save", packId: data.pack.id, slot: slot.slot, mode, questionId: q?.id, format: form.format, composedFormatId: form.format === "COMPOSED" ? form.composedFormatId : undefined,
      promptAr: form.promptAr, promptFranco: form.promptFranco, answerAr: form.answerAr, answerFranco: form.answerFranco,
      config: form.config, media, confirmPublicEdit: published ? confirm : undefined,
    }, { success: mode === "replace" ? "Question replaced." : mode === "edit" ? "Correction saved." : "Question added." });
    if (done) onDone();
  };

  const retire = async () => {
    if (!window.confirm("Retire this question? The slot becomes empty and the pack cannot be published until it is filled.")) return;
    if (await send({ op: "question.retire", packId: data.pack.id, slot: slot.slot, questionId: q.id }, { success: "Question retired." })) onDone();
  };

  return (
    <form onSubmit={submit} style={{ ...card, borderColor: colors.gold, marginTop: 12 }} aria-label={`Slot ${slot.slot} editor`}>
      <H3>Slot {slot.slot} · {slot.points} points</H3>
      {q && (
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" role="tab" aria-selected={mode === "edit"} style={button(mode === "edit" ? "primary" : "secondary")} onClick={() => switchMode("edit")}>Edit (correct a mistake)</button>
          <button type="button" role="tab" aria-selected={mode === "replace"} style={button(mode === "replace" ? "primary" : "secondary")} onClick={() => switchMode("replace")}>Replace with a new question</button>
        </div>
      )}
      {mode === "edit" && <Notice notice={{ kind: "ok", text: "Editing keeps this as the same question: players who have already seen it still count as having seen it. Use it for typos and small fixes, and you cannot change the format." }} />}
      {mode === "replace" && <Notice notice={{ kind: "danger", text: "Replacing retires the current question and puts a brand new one in this slot. Players who saw the old one will see the new one as unseen, and a pack they completed is shown as Updated. Upload the new files below." }} />}
      {published && <Notice notice={{ kind: "danger", text: isPublic
        ? "Players can start games with this pack. Your change goes live as soon as you save, and the whole pack must stay valid."
        : "This pack is hidden from new games. Edits to published packs must keep all six slots valid." }} />}
      <Field label="Format">
        <select aria-label="Format" style={input} value={form.format === "COMPOSED" ? `composed:${form.composedFormatId}` : form.format} disabled={mode === "edit"} onChange={(e) => { const v = e.target.value; setForm({ ...form, format: v.startsWith("composed:") ? "COMPOSED" : v, composedFormatId: v.startsWith("composed:") ? v.slice(9) : null, media: {}, config: {} }); }}>
          {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
          {data.composedFormats.filter((f) => !f.archived || f.id === form.composedFormatId).map((f) => <option key={f.id} value={`composed:${f.id}`}>{f.nameEn}{f.archived ? " (archived)" : ""} · staff-defined</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Question (Arabic)" required><textarea style={input} dir="rtl" rows={3} required value={form.promptAr} onChange={set("promptAr")} /></Field>
        <Field label="Question (Franco, optional)"><textarea style={input} rows={3} value={form.promptFranco} onChange={set("promptFranco")} /></Field>
        <Field label="Answer (Arabic)" required><textarea style={input} dir="rtl" rows={2} required value={form.answerAr} onChange={set("answerAr")} /></Field>
        <Field label="Answer (Franco, optional)"><textarea style={input} rows={2} value={form.answerFranco} onChange={set("answerFranco")} /></Field>
      </div>
      {form.format === "IMAGE_MEMORY" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Viewing instruction (Arabic, optional)"><input style={input} dir="rtl" value={form.config.instructionAr ?? ""} onChange={(e) => setConfig("instructionAr", e.target.value)} /></Field>
          <Field label="Viewing instruction (Franco, optional)"><input style={input} value={form.config.instructionFranco ?? ""} onChange={(e) => setConfig("instructionFranco", e.target.value)} /></Field>
        </div>
      )}
      {form.format === "AUDIO_VOICE" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Hint or joke (Arabic, optional)"><input style={input} dir="rtl" value={form.config.hintAr ?? ""} onChange={(e) => setConfig("hintAr", e.target.value)} /></Field>
          <Field label="Hint or joke (Franco, optional)"><input style={input} value={form.config.hintFranco ?? ""} onChange={(e) => setConfig("hintFranco", e.target.value)} /></Field>
        </div>
      )}
      {form.format === "AUDIO_REVERSE" && (
        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={form.config.allowForward === true} onChange={(e) => setConfig("allowForward", e.target.checked)} /> The host may play the forward clip when the answer is revealed
        </label>
      )}
      {form.format === "IMAGE_COLOR" && (
        <Field label="Colour swatch (optional, like #c0392b)"><input style={{ ...input, width: 160 }} value={form.config.colorHex ?? ""} onChange={(e) => setConfig("colorHex", e.target.value)} /></Field>
      )}
      {composed && <Notice notice={{ kind: "ok", text: `${composed.nameEn}: ${composed.stageKinds.length + 1} stage${composed.stageKinds.length ? "s" : ""}. Upload every file below as a finished file; the game shows them in order. Staff-defined formats play on the website; the mobile app cannot draw them yet.` }} />}
      <Text fontWeight="bold" mb="sm">Files</Text>
      <Text fontSize="sm" color="grey60" mb="md">Upload finished files prepared elsewhere: Sahsah does not edit pictures or audio. Pictures: PNG, JPEG or WebP up to 10 MB. Audio: MP3 up to 25 MB and 10 minutes.</Text>
      {!data.mediaEnabled && <Notice notice={{ kind: "danger", text: "File storage is not configured, so files cannot be uploaded." }} />}
      {specs.map((spec) => {
        const m = form.media[`${spec.role}:${spec.variant}`];
        const required = spec.required === true;
        return (
          <div key={spec.key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${colors.line}` }}>
            <div style={{ width: 220 }}>
              <strong>{spec.label}</strong>
              <div style={{ fontSize: 12, color: colors.muted }}>{required ? "Required" : "Optional"}</div>
            </div>
            <div style={{ width: 120 }}>
              {m?.url ? (spec.kind === "audio" ? <audio controls src={m.url} style={{ width: 120 }} /> : <img src={m.url} alt={spec.label} style={{ maxWidth: 110, maxHeight: 80, borderRadius: 4 }} />) : <span style={{ color: colors.muted }}>No file</span>}
            </div>
            <div style={{ flex: 1 }}>
              <input aria-label={`Upload ${spec.label}`} type="file" accept={spec.kind === "audio" ? "audio/mpeg,.mp3" : "image/png,image/jpeg,image/webp"} disabled={busy || !data.mediaEnabled} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onFile(spec, f); }} />
              {uploading === spec.key && <span> Uploading…</span>}
              {m?.asset && <div style={{ fontSize: 12, color: colors.muted }}>{m.asset.contentType}{m.asset.widthPx ? ` · ${m.asset.widthPx}×${m.asset.heightPx}` : ""}{m.asset.durationMs ? ` · ${(m.asset.durationMs / 1000).toFixed(1)} s` : ""}{m.asset.state === "pending" ? " · not saved yet" : ""}</div>}
            </div>
            {spec.points && m && (
              <Field label="Points">
                <input aria-label={`Points for ${spec.label}`} type="number" min={1} max={600} style={{ ...input, width: 90 }} value={m.points ?? ""} onChange={(e) => setForm({ ...form, media: { ...form.media, [`${spec.role}:${spec.variant}`]: { ...m, points: e.target.value } } })} />
              </Field>
            )}
          </div>
        );
      })}
      {["IMAGE_BLUR", "IMAGE_ZOOM"].includes(form.format) && <Text fontSize="sm" color="grey60" mt="sm">Points must start at {slot.points} and keep falling (default {stageDefaults?.join(" → ")}). Uploading a new original means uploading the hint stages again.</Text>}
      {composed && composed.stageKinds.length > 0 && <Text fontSize="sm" color="grey60" mt="sm">Hint stage points must be below {slot.points} and keep falling from one stage to the next.</Text>}
      {form.format === "IMAGE_CLUES" && <Text fontSize="sm" color="grey60" mt="sm">Each clue lowers the suggested points below {slot.points}. Add clue cards in order, without gaps.</Text>}
      {published && <label style={{ display: "block", margin: "12px 0" }}><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> {isPublic ? "I understand this change goes live immediately." : "I confirm this edit to a published pack."}</label>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={button("primary", busy)} disabled={busy}>{mode === "replace" ? "Replace question" : mode === "edit" ? "Save correction" : "Add question"}</button>
        <button type="button" style={button("secondary")} onClick={onDone}>Cancel</button>
        {q && !published && <button type="button" style={button("danger", busy)} disabled={busy} onClick={retire}>Retire question</button>}
      </div>
    </form>
  );
};

// ---- pack view -------------------------------------------------------------------------------

const PackView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const { send, busy } = useSend(setNotice);
  const load = useCallback(async () => {
    try { setData(await get({ view: "pack", id })); } catch { setNotice({ kind: "danger", text: "That pack could not be loaded." }); }
  }, [id, setNotice]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Text>Loading…</Text>;
  const { pack, category } = data;
  const state = pack.archived ? "archived" : pack.publicationState;
  const published = pack.publicationState === "published";
  const isPublic = published && !pack.archived && !category.archived;
  const act = async (op, success) => {
    if (await send({ op, id }, { success })) load();
  };
  const issuesFor = (slot) => data.issues.filter((i) => i.slot === slot);
  return (
    <>
      <p><a href={`${PAGE}?view=category&id=${category.id}`} onClick={(e) => { e.preventDefault(); navigate(`${PAGE}?view=category&id=${category.id}`); }}>← <span dir="rtl">{category.nameAr}</span></a></p>
      <div style={{ ...card, marginBottom: 16 }}>
        <Box flex style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <H3>Pack {pack.packNumber} · <span data-testid="pack-state">{STATES[state]}</span></H3>
          <div style={{ display: "flex", gap: 8 }}>
            {!published && !pack.archived && <button style={button("primary", busy)} disabled={busy} onClick={() => act("pack.publish", category.archived ? "Pack published. Restore the category to make it available for new games." : "Pack published: hosts can now start games with it.")}>Publish</button>}
            <button style={button(pack.archived ? "primary" : "danger", busy)} disabled={busy} onClick={() => {
              if (!pack.archived && !window.confirm(`Archive Pack ${pack.packNumber} in “${category.nameAr}”? It will be hidden from new games.`)) return;
              act(pack.archived ? "pack.unarchive" : "pack.archive", pack.archived ? "Pack restored." : "Pack archived: it is hidden from new games.");
            }}>{pack.archived ? "Restore pack" : "Archive pack"}</button>
          </div>
        </Box>
        <Text>{pack.archived
          ? "This pack is archived and hidden from new games."
          : category.archived
            ? "This category is archived. Its packs are hidden from new games."
            : published
              ? "This pack is public: edits go live immediately and the whole pack must stay valid."
              : "A draft can stay incomplete. Publishing checks all six slots, the file types and the point bands."}</Text>
        {data.issues.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Notice notice={{ kind: "danger", text: `${data.issues.length} thing${data.issues.length === 1 ? "" : "s"} to fix before this pack is playable:`, issues: data.issues }} />
          </div>
        )}
        {data.issues.length === 0 && <Notice notice={{ kind: "ok", text: "All six slots are valid and ready." }} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {data.slots.map((slot) => {
          const q = slot.question;
          const slotIssues = issuesFor(slot.slot);
          return (
            <div key={slot.slot} style={{ ...card, minWidth: 0, overflowWrap: "anywhere", borderColor: slotIssues.length ? colors.red : colors.line }} data-testid={`slot-${slot.slot}`}>
              <strong>Slot {slot.slot} · {slot.points} pts</strong>
              {q ? (
                <>
                  <div style={{ fontSize: 12, color: colors.muted }}>{q.format === "COMPOSED" ? (data.composedFormats.find((f) => f.id === q.composedFormatId)?.nameEn ?? "Staff-defined format") : FORMAT_LABELS[q.format]}</div>
                  <p dir="rtl" style={{ margin: "8px 0" }}>{q.promptAr}</p>
                  <p dir="rtl" style={{ margin: 0, color: colors.muted }}>{q.answerAr}</p>
                  <p style={{ margin: "8px 0", fontSize: 13 }} title="Games that copied this question">
                    Played {q.stats.played}× · 👍 {q.stats.likes} · 👎 {q.stats.dislikes}
                  </p>
                </>
              ) : (
                <p style={{ color: colors.muted }}>Empty slot</p>
              )}
              {slotIssues.map((i) => <div key={i.code} style={{ color: colors.red, fontSize: 12 }}>{i.message}</div>)}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, whiteSpace: "nowrap" }}>
                <button style={{ ...button("secondary"), whiteSpace: "inherit" }} onClick={() => { setOpen(open === slot.slot ? null : slot.slot); setPreviewing(null); }}>{q ? "Edit or replace" : "Add question"}</button>
                {q && <button style={{ ...button("secondary"), whiteSpace: "inherit" }} onClick={() => { setPreviewing(previewing === slot.slot ? null : slot.slot); setOpen(null); }}>Preview as player</button>}
              </div>
            </div>
          );
        })}
      </div>
      {open && <SlotEditor key={`${open}-${data.slots[open - 1].question?.id}`} data={data} slot={data.slots[open - 1]} published={published} isPublic={isPublic} setNotice={setNotice} onDone={() => { setOpen(null); load(); }} />}
      {previewing && (
        <div style={{ marginTop: 12 }}>
          <Box flex style={{ justifyContent: "space-between" }}>
            <H3>Preview · slot {previewing}</H3>
            <button style={button("secondary")} onClick={load}>Refresh links</button>
          </Box>
          <Preview key={previewing} question={data.slots[previewing - 1].question} slotPoints={data.slots[previewing - 1].points} composed={data.composedFormats.find((f) => f.id === data.slots[previewing - 1].question.composedFormatId)} />
        </div>
      )}
      {data.retired.length > 0 && (
        <details style={{ marginTop: 16, overflowWrap: "anywhere" }}>
          <summary>Retired questions ({data.retired.length})</summary>
          <ul>{data.retired.map((r) => <li key={r.id}>Slot {r.slot} · {FORMAT_LABELS[r.format]} · <span dir="rtl">{r.promptAr}</span></li>)}</ul>
        </details>
      )}
    </>
  );
};

export default PackView;
