import React, { useCallback, useEffect, useState } from "react";
import { H3, Text } from "@adminjs/design-system";
import { FORMAT_LABELS, Field, button, card, colors, get, input, useSend } from "./content-ui";

const BASES = { text: "Text only (no starting file)", image: "A picture", audio: "An audio clip" };
const ANSWERS = { none: "Text only", image: "A picture", audio: "An audio clip (host plays it)" };
const blank = { nameEn: "", labelAr: "", baseKind: "image", stageKinds: ["image", "image", "image"], answerKind: "image", showPrompt: true };

/** The same plain-language summary the server stores for every format, computed live while staff edit. */
export function describe(form) {
  const stages = 1 + form.stageKinds.length;
  const base = { text: "The question text only", image: "A starting picture", audio: "A starting audio clip" }[form.baseKind];
  const hints = form.stageKinds.length ? ` Then ${form.stageKinds.length} hint stage${form.stageKinds.length === 1 ? "" : "s"}: ${form.stageKinds.map((k, i) => `${i + 1}. ${k}`).join(", ")}, each replacing the previous one and lowering the suggested points.` : " No hint stages.";
  const answer = form.answerKind === "none" ? "The answer is text only." : `The answer also shows ${form.answerKind === "image" ? "a picture" : "an audio clip for the host"}.`;
  return `${stages} stage${stages === 1 ? "" : "s"}. ${base}.${hints} ${answer} The question text is ${form.showPrompt ? "shown to players" : "kept for staff only"}.`;
}

/** The uploads a question of this format will ask for. */
function slotLines(form) {
  const lines = [];
  if (form.baseKind !== "text") lines.push(`Starting ${form.baseKind === "image" ? "picture" : "audio"}`);
  form.stageKinds.forEach((k, i) => lines.push(`Hint stage ${i + 1} ${k === "image" ? "picture" : "audio"} (with suggested points)`));
  if (form.answerKind !== "none") lines.push(`Answer ${form.answerKind === "image" ? "picture" : "audio"}`);
  return lines;
}

const FormatForm = ({ initial, onSubmit, onCancel, busy, label }) => {
  const [form, setForm] = useState(initial);
  const setStages = (count) => setForm({ ...form, stageKinds: Array.from({ length: count }, (_, i) => form.stageKinds[i] ?? "image") });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} aria-label="Format form" style={{ ...card, borderColor: colors.gold, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Name (English, for staff)" required><input style={input} required value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></Field>
        <Field label="Label players see (Arabic)" required><input style={input} dir="rtl" required value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} /></Field>
        <Field label="Starts with">
          <select style={input} value={form.baseKind} onChange={(e) => setForm({ ...form, baseKind: e.target.value })}>
            {Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Hint stages">
          <select style={input} value={form.stageKinds.length} onChange={(e) => setStages(Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>
      {form.stageKinds.map((kind, i) => (
        <Field key={i} label={`Hint stage ${i + 1} file`}>
          <select style={{ ...input, width: 220 }} value={kind} onChange={(e) => setForm({ ...form, stageKinds: form.stageKinds.map((k, j) => (j === i ? e.target.value : k)) })}>
            <option value="image">Picture</option>
            <option value="audio">Audio clip</option>
          </select>
        </Field>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Answer shows">
          <select style={input} value={form.answerKind} onChange={(e) => setForm({ ...form, answerKind: e.target.value })}>
            {Object.entries(ANSWERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
          <input type="checkbox" checked={form.showPrompt} onChange={(e) => setForm({ ...form, showPrompt: e.target.checked })} /> Show the question text to players
        </label>
      </div>
      <div data-testid="format-description" style={{ background: colors.cream, borderRadius: 6, padding: 12, margin: "8px 0 12px" }}>
        <strong>What this format needs</strong>
        <p style={{ margin: "6px 0" }}>{describe(form)}</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{slotLines(form).map((line) => <li key={line}>{line}</li>)}{slotLines(form).length === 0 && <li>No files.</li>}</ul>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={button("primary", busy)} disabled={busy}>{label}</button>
        <button type="button" style={button("secondary")} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

const FormatsView = ({ setNotice }) => {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const { send, busy } = useSend(setNotice);
  const load = useCallback(async () => {
    try { setData(await get({ view: "formats" })); } catch { setNotice({ kind: "danger", text: "The formats could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Text>Loading…</Text>;
  const save = async (form) => {
    const fields = { nameEn: form.nameEn, labelAr: form.labelAr, baseKind: form.baseKind, stageKinds: form.stageKinds, answerKind: form.answerKind, showPrompt: form.showPrompt };
    const done = editing === "new"
      ? await send({ op: "format.create", ...fields }, { success: "Format created. It is now available when you add a question." })
      : await send({ op: "format.update", id: editing.id, ...fields }, { success: "Format saved. Games already running keep the old version; new games use this one." });
    if (done) { setEditing(null); load(); }
  };
  return (
    <>
      {!data.mobileSupported && (
        <div role="note" style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 12, background: "#fff4d6", color: "#6b4a00" }}>
          Mobile app support arrives with the Flutter update. Staff-defined formats play on the website; do not publish questions that use them to mobile players until the app can draw them.
        </div>
      )}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <H3>Staff-defined formats</H3>
          {!editing && <button style={button("primary")} onClick={() => setEditing("new")}>New format</button>}
        </div>
        <Text mb="md">A format is built only from text, pictures, audio and finished files you upload. The game sequence (board, hint stages with falling points, 60 second timer, reveal, award) never changes. Editing a format affects games started later; running games keep their own copy. Archiving hides it from new questions, and questions that already use it stay valid.</Text>
        {editing && <FormatForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? blank : { nameEn: editing.nameEn, labelAr: editing.labelAr, baseKind: editing.baseKind, stageKinds: editing.stageKinds, answerKind: editing.answerKind, showPrompt: editing.showPrompt }} onSubmit={save} onCancel={() => setEditing(null)} busy={busy} label={editing === "new" ? "Create format" : "Save format"} />}
        {data.composed.length === 0 && <Text>No staff-defined formats yet.</Text>}
        {data.composed.map((f) => (
          <div key={f.id} data-testid={`format-${f.code}`} style={{ borderTop: `1px solid ${colors.line}`, padding: "10px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{f.nameEn}</strong> <span dir="rtl" style={{ color: colors.muted }}>{f.labelAr}</span>
              <span style={{ color: colors.muted }}>· {f.usedBy} question{f.usedBy === 1 ? "" : "s"}</span>
              {f.archived && <span style={{ color: colors.red }}>Archived</span>}
              <span style={{ flex: 1 }} />
              <button style={button("secondary")} onClick={() => setEditing(f)}>Edit</button>
              <button style={button(f.archived ? "primary" : "danger", busy)} disabled={busy} onClick={async () => (await send({ op: f.archived ? "format.unarchive" : "format.archive", id: f.id }, { success: f.archived ? "Format restored." : "Format archived: hidden from new questions." })) && load()}>{f.archived ? "Restore" : "Archive"}</button>
            </div>
            <div style={{ fontSize: 13, color: colors.muted }}>{f.description}</div>
            <div style={{ fontSize: 13 }}>Files: {f.slots.map((s) => s.label).join("; ") || "none"}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <H3>Built-in formats</H3>
        <Text mb="md">These are part of the game and cannot be edited here. Memory and charades are built in because their interaction is defined in code.</Text>
        {data.builtIn.map((f) => (
          <div key={f.code} style={{ borderTop: `1px solid ${colors.line}`, padding: "8px 0" }}>
            <strong>{FORMAT_LABELS[f.code]}</strong>
            <div style={{ fontSize: 13, color: colors.muted }}>{f.description}</div>
          </div>
        ))}
      </div>
    </>
  );
};

export default FormatsView;
