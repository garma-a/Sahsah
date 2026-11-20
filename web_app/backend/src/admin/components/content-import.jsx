import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { FORMAT_LABELS, Field, button, card, colors, get, input, useSend } from "./content-ui";

const PAGE = "/admin/pages/content";
const th = { textAlign: "left", color: colors.muted, padding: "6px 8px", fontWeight: 600 };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };

const download = (filename, text) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const where = (error) => [error.row ? `Row ${error.row}` : null, error.column ? `column ${error.column}` : null, error.file ? `file ${error.file}` : null].filter(Boolean).join(", ");

const Problems = ({ errors }) => (
  <ul style={{ margin: 0, paddingLeft: 18, color: "#8a1f18" }}>
    {errors.map((error, index) => (
      <li key={index}>{where(error) && <strong>{where(error)}: </strong>}{error.message}</li>
    ))}
  </ul>
);

const Pack = ({ pack }) => (
  <div style={{ ...card, marginBottom: 12, borderColor: pack.ok ? colors.line : colors.red }}>
    <Box flex style={{ justifyContent: "space-between", alignItems: "center" }}>
      <strong>Pack “{pack.label || "(no label)"}”</strong>
      <span style={{ fontWeight: 600, color: pack.ok ? "#134b2c" : colors.red }}>{pack.ok ? "Ready to import" : "Needs fixing"}</span>
    </Box>
    {pack.errors.length > 0 && <div style={{ margin: "8px 0" }}><Problems errors={pack.errors} /></div>}
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead><tr><th style={th}>Row</th><th style={th}>Slot</th><th style={th}>Format</th><th style={th}>Question</th><th style={th}>Files</th><th style={th}>Status</th></tr></thead>
      <tbody>
        {pack.rows.map((row) => (
          <tr key={row.row}>
            <td style={td}>{row.row}</td>
            <td style={td}>{row.slot ?? "—"}</td>
            <td style={td}>{FORMAT_LABELS[row.format.toUpperCase()]?.split(" (")[0] ?? row.format}</td>
            <td style={{ ...td, maxWidth: 260 }} dir="rtl">{row.promptAr.length > 80 ? `${row.promptAr.slice(0, 80)}…` : row.promptAr}</td>
            <td style={td}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {row.files.map((file) => (
                  <div key={file.key} style={{ width: 130, fontSize: 12 }}>
                    {file.ok && file.url ? (file.kind === "audio" ? <audio controls preload="none" src={file.url} style={{ width: 130, height: 32 }} /> : <img src={file.url} alt={file.label} style={{ maxWidth: 130, maxHeight: 80, borderRadius: 4, display: "block" }} />) : null}
                    <div title={file.label} style={{ overflowWrap: "anywhere" }}>{file.file}</div>
                    <div style={{ color: colors.muted }}>{file.detail}{file.points ? ` · ${file.points} pts` : ""}</div>
                  </div>
                ))}
                {row.files.length === 0 && <span style={{ color: colors.muted }}>none</span>}
              </div>
            </td>
            <td style={td}>{row.errors.length === 0 ? <span style={{ color: "#134b2c", fontWeight: 600 }}>OK</span> : <Problems errors={row.errors} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ImportView = ({ id, navigate, setNotice }) => {
  const [options, setOptions] = useState(null);
  const [choice, setChoice] = useState("STANDARD");
  const [template, setTemplate] = useState(null);
  const [zip, setZip] = useState(null);
  const [report, setReport] = useState(null);
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);
  const { send, busy } = useSend(setNotice);

  useEffect(() => {
    get({ view: "import", id }).then(setOptions).catch(() => setNotice({ kind: "danger", text: "That category could not be loaded." }));
  }, [id, setNotice]);
  const loadTemplate = useCallback(async (code) => {
    try { setTemplate(await get({ view: "import-template", format: code })); } catch { setTemplate(null); setNotice({ kind: "danger", text: "That template could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { loadTemplate(choice); }, [choice, loadTemplate]);

  if (!options) return <Text>Loading…</Text>;
  const check = async () => {
    setReport(null);
    setResult(null);
    const data = await send({ op: "import.check", categoryId: id, file: zip });
    if (data) setReport(data);
  };
  const run = async () => {
    const data = await send({ op: "import.run", id: report.id });
    if (data) { setResult(data); setReport(null); setZip(null); if (fileInput.current) fileInput.current.value = ""; }
  };
  const errorCount = report?.summary.errors ?? 0;

  return (
    <>
      <p><a href={`${PAGE}?view=category&id=${id}`} onClick={(e) => { e.preventDefault(); navigate(`${PAGE}?view=category&id=${id}`); }}>← Back to the category</a></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Import packs into <span dir="rtl">{options.category.nameAr}</span></H3>
        <Text mb="md">Upload one ZIP holding <code>pack.csv</code> and the media files it names. Each pack is six rows (slots 1 to 6). The ZIP is checked first and nothing is saved until you import. Imported packs are always <strong>drafts</strong>: nothing is published.</Text>
        {!options.mediaEnabled && <Text style={{ color: colors.red }}>File storage is not configured on this service, so only text-only questions can be imported.</Text>}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>1. Get a CSV template</H3>
        <Text mb="md">The columns depend on the format: one file column for each file the format needs, plus suggested points for hint stages. To mix formats in one file, put all the columns in one header and leave the cells a row does not use empty. Save the file as <strong>CSV UTF-8</strong> and keep Arabic text as is.</Text>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 300 }}>
            <Field label="Format">
              <select aria-label="Template format" style={input} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <optgroup label="Built-in formats">{options.builtIn.map((f) => <option key={f.code} value={f.code}>{FORMAT_LABELS[f.code] ?? f.code}</option>)}</optgroup>
                {options.composed.length > 0 && <optgroup label="Staff-defined formats">{options.composed.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}</optgroup>}
              </select>
            </Field>
          </div>
          <div style={{ marginBottom: 12 }}><button type="button" style={button("primary", !template)} disabled={!template} onClick={() => download(template.filename, template.csv)}>Download CSV template</button></div>
        </div>
        {template && (
          <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Template columns">
            <thead><tr><th style={th}>Column</th><th style={th}>Needed</th><th style={th}>What goes in it</th></tr></thead>
            <tbody>{template.columns.map((c) => <tr key={c.name}><td style={td}><code>{c.name}</code></td><td style={td}>{c.required ? "Yes" : "Optional"}</td><td style={td}>{c.help}</td></tr>)}</tbody>
          </table>
        )}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>2. Check your ZIP</H3>
        <Text mb="md">Put <code>pack.csv</code> and every media file in the ZIP, in one folder at most. Rows name files by file name only. Up to {options.limits.zipMegabytes} MB and {options.limits.rows} questions ({options.limits.packs} packs) per ZIP.</Text>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input ref={fileInput} aria-label="ZIP file" type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => { setZip(e.target.files?.[0] ?? null); setReport(null); setResult(null); }} />
          <button type="button" style={button("primary", busy || !zip)} disabled={busy || !zip} onClick={check}>{busy && !report ? "Checking…" : "Check ZIP"}</button>
        </div>
        {busy && !report && <Text mt="md">Uploading and checking the ZIP. Large files can take a minute. Nothing is being saved.</Text>}
      </div>

      {result && (
        <div style={{ ...card, borderColor: "#134b2c", marginBottom: 20 }} role="status">
          <H3>{result.replayed ? "Already imported" : "Import finished"}</H3>
          <Text mb="md">{result.packs.length} draft pack{result.packs.length === 1 ? "" : "s"} created{result.replayed ? " by an earlier attempt of this import" : ` with ${result.questions} questions and ${result.files} files`}. Nothing is published: open each draft to review it, then publish it.</Text>
          <ul>
            {result.packs.map((p) => <li key={p.id}><a href={`${PAGE}?view=pack&id=${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`${PAGE}?view=pack&id=${p.id}`); }}>Pack {p.packNumber}</a> — {p.label}</li>)}
          </ul>
        </div>
      )}

      {report && (
        <div style={{ ...card, marginBottom: 20 }}>
          <H3>3. Check report</H3>
          <div role="status" style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 12, background: report.canImport ? "#e3f1e8" : "#fbe3e1", color: report.canImport ? "#134b2c" : "#8a1f18" }}>
            {report.canImport
              ? `No problems found: ${report.summary.packs} pack${report.summary.packs === 1 ? "" : "s"}, ${report.summary.questions} questions, ${report.summary.files} files. Nothing has been saved yet.`
              : `${errorCount} problem${errorCount === 1 ? "" : "s"} found in ${report.summary.packs} pack${report.summary.packs === 1 ? "" : "s"} and ${report.summary.questions} rows. Fix them, then upload the ZIP again. Nothing was saved.`}
            {report.summary.ignored > 0 && <div style={{ fontSize: 12 }}>{report.summary.ignored} system file{report.summary.ignored === 1 ? " was" : "s were"} ignored (such as __MACOSX).</div>}
          </div>
          {report.errors.length > 0 && <div style={{ marginBottom: 12 }}><strong>Problems with the file as a whole</strong><Problems errors={report.errors} /></div>}
          {report.packs.map((pack) => <Pack key={pack.label} pack={pack} />)}
          <Box flex style={{ gap: 12, alignItems: "center" }}>
            <button type="button" style={button("primary", busy || !report.canImport)} disabled={busy || !report.canImport} onClick={run}>{busy ? "Importing…" : `Import ${report.summary.packs} draft pack${report.summary.packs === 1 ? "" : "s"}`}</button>
            {!report.canImport && <Text>Import is available when the check finds no problems.</Text>}
            {busy && <Text>Uploading files and saving the drafts. Keep this page open.</Text>}
          </Box>
          <Text fontSize="xs" color="grey60" mt="md">Previews are available for {Math.round((new Date(report.expiresAt) - Date.now()) / 60000)} more minutes; after that, upload the ZIP again.</Text>
        </div>
      )}
    </>
  );
};

export default ImportView;
