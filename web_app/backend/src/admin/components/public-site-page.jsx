import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useLocation, useNavigate } from "react-router";
import { Field, Notice, button, card, colors, get, input, useSend } from "./content-ui";

const PAGE = "/admin/pages/public-site";
const PAGE_NAME = "public-site";
const TABS = [["announcements", "Announcements"], ["pages", "Pages"], ["settings", "Site settings"]];
// Postgres text: "2026-11-20 10:00:00.123456+00".
const toDate = (value) => new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
const when = (value) => (value ? toDate(value).toLocaleString() : "");
/** The value of a datetime-local input, in the browser's own time zone. */
const local = (value) => {
  if (!value) return "";
  const date = toDate(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const th = { textAlign: "left", color: colors.muted, padding: "6px 8px" };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };
const rtl = { direction: "rtl", textAlign: "right" };
const STATUS = { live: ["Live", "green"], scheduled: ["Scheduled", "gold"], ended: ["Ended", ""], inactive: ["Inactive", "red"] };
const Badge = ({ kind, children }) => (
  <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, marginRight: 4, background: kind === "red" ? "#fbe3e1" : kind === "gold" ? "#fbefcf" : kind === "green" ? "#e3f1e8" : "#e7e3d6", color: kind === "red" ? "#8a1f18" : kind === "gold" ? "#7a5200" : kind === "green" ? "#134b2c" : colors.muted }}>{children}</span>
);

const Tabs = ({ view, navigate, analyticsUrl }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
    <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {TABS.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={view === key} style={button(view === key ? "primary" : "secondary")} onClick={() => navigate(key === "announcements" ? PAGE : `${PAGE}?view=${key}`)}>{label}</button>
      ))}
    </div>
    {analyticsUrl && <a href={analyticsUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}>Open Cloudflare Web Analytics</a>}
  </div>
);

// ---- announcements ---------------------------------------------------------------------------------

const emptyAnnouncement = () => ({ titleAr: "", titleFranco: "", bodyAr: "", bodyFranco: "", linkLabel: "", linkUrl: "", startsAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), endsAt: "" });
const fromRow = (row) => ({ titleAr: row.titleAr, titleFranco: row.titleFranco ?? "", bodyAr: row.bodyAr, bodyFranco: row.bodyFranco ?? "", linkLabel: row.linkLabel ?? "", linkUrl: row.linkUrl ?? "", startsAt: local(row.startsAt), endsAt: local(row.endsAt) });
const toPayload = (form) => ({ ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "", endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "" });

const AnnouncementForm = ({ initial, onSave, onCancel, busy, submitLabel }) => {
  const [form, setForm] = useState(initial);
  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(toPayload(form)); }} style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Title (Arabic)"><input aria-label="Title (Arabic)" style={{ ...input, ...rtl }} value={form.titleAr} maxLength={120} onChange={set("titleAr")} /></Field>
        <Field label="Title (Franco, optional)"><input aria-label="Title (Franco)" style={input} value={form.titleFranco} maxLength={120} onChange={set("titleFranco")} /></Field>
        <Field label="Message (Arabic)"><textarea aria-label="Message (Arabic)" style={{ ...input, ...rtl, minHeight: 80 }} value={form.bodyAr} maxLength={500} onChange={set("bodyAr")} /></Field>
        <Field label="Message (Franco, optional)"><textarea aria-label="Message (Franco)" style={{ ...input, minHeight: 80 }} value={form.bodyFranco} maxLength={500} onChange={set("bodyFranco")} /></Field>
        <Field label="Link label (optional)"><input aria-label="Link label" style={{ ...input, ...rtl }} value={form.linkLabel} maxLength={60} onChange={set("linkLabel")} /></Field>
        <Field label="Link address (optional)" hint="An https address, or a path on the site such as /faq."><input aria-label="Link address" style={input} value={form.linkUrl} maxLength={500} onChange={set("linkUrl")} /></Field>
        <Field label="Starts"><input aria-label="Starts" type="datetime-local" style={input} value={form.startsAt} onChange={set("startsAt")} /></Field>
        <Field label="Ends (optional)" hint="Leave empty to keep it up until you switch it off."><input aria-label="Ends" type="datetime-local" style={input} value={form.endsAt} onChange={set("endsAt")} /></Field>
      </div>
      <button style={button("primary", busy)} disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
      <button type="button" style={{ ...button("secondary"), marginLeft: 8 }} onClick={onCancel}>Cancel</button>
    </form>
  );
};

const Announcements = ({ setNotice }) => {
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchRows = useCallback(async (cursor) => {
    try {
      const params = { view: "announcements", status: status || undefined, cursor };
      for (const name of Object.keys(params)) if (!params[name]) delete params[name];
      const next = await get(params, PAGE_NAME);
      setData((previous) => (cursor && previous ? { ...next, rows: [...previous.rows, ...next.rows] } : next));
    } catch {
      setData({ rows: [], nextCursor: null });
      setNotice({ kind: "danger", text: "The announcements could not be loaded." });
    }
  }, [status, setNotice]);
  useEffect(() => { fetchRows(); }, [fetchRows]);
  const act = async (payload, success) => {
    const done = await send(payload, { success });
    if (done) { setEditing(null); await fetchRows(); }
    return done;
  };
  return (
    <>
      <Tabs view="announcements" navigate={useNavigate()} analyticsUrl={data?.analyticsUrl} />
      <Text mb="md">An announcement is a dated message shown at the top of the website for everyone. The newest live one is shown; players can dismiss it.</Text>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select aria-label="Status" style={{ ...input, width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="live">Live</option><option value="scheduled">Scheduled</option><option value="ended">Ended</option><option value="inactive">Inactive</option>
        </select>
        <button style={button("primary")} onClick={() => setEditing({ create: true })}>New announcement</button>
      </div>
      {editing?.create && <AnnouncementForm initial={emptyAnnouncement()} busy={busy} submitLabel="Create announcement" onCancel={() => setEditing(null)} onSave={(fields) => act({ op: "announcement.create", ...fields }, "Announcement created.")} />}
      {editing?.row && <AnnouncementForm key={editing.row.id} initial={fromRow(editing.row)} busy={busy} submitLabel="Save changes" onCancel={() => setEditing(null)} onSave={(fields) => act({ op: "announcement.update", id: editing.row.id, ...fields }, "Announcement saved.")} />}
      <div style={card}>
        {!data ? <Text>Loading…</Text> : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Announcement</th><th style={th}>Window</th><th style={th}>Status</th><th style={th}></th></tr></thead>
              <tbody>
                {data.rows.map((row) => {
                  const [label, kind] = STATUS[row.status] ?? [row.status, ""];
                  return (
                    <tr key={row.id}>
                      <td style={{ ...td, maxWidth: 360 }}><strong style={rtl}>{row.titleAr}</strong><div style={{ ...rtl, color: colors.muted }}>{row.bodyAr}</div>{row.linkUrl && <div style={{ fontSize: 12, color: colors.muted }}>Link: {row.linkLabel} → {row.linkUrl}</div>}</td>
                      <td style={td}>{when(row.startsAt)}<br /><span style={{ color: colors.muted, fontSize: 12 }}>{row.endsAt ? `until ${when(row.endsAt)}` : "no end"}</span></td>
                      <td style={td}><Badge kind={kind}>{label}</Badge></td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button style={button("secondary", busy)} disabled={busy} onClick={() => setEditing({ row })}>Edit</button>{" "}
                        <button style={button("secondary", busy)} disabled={busy} onClick={() => act({ op: row.isActive ? "announcement.deactivate" : "announcement.activate", id: row.id }, row.isActive ? "Announcement deactivated." : "Announcement activated.")}>{row.isActive ? "Deactivate" : "Activate"}</button>{" "}
                        {row.deletable ? <button style={button("danger", busy)} disabled={busy} onClick={() => window.confirm("Delete this announcement? It was never shown.") && act({ op: "announcement.delete", id: row.id }, "Announcement deleted.")}>Delete</button> : <span title="It was shown, so it is kept. Deactivate it instead." style={{ color: colors.muted, fontSize: 12 }}>Kept (was shown)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.rows.length === 0 && <Text mt="md">{status ? "No announcements match this filter." : "No announcements yet."}</Text>}
            {data.nextCursor && <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => fetchRows(data.nextCursor)}>Load more</button></div>}
          </>
        )}
      </div>
    </>
  );
};

// ---- pages -----------------------------------------------------------------------------------------

const emptyItem = () => ({ questionAr: "", answerAr: "", questionFranco: "", answerFranco: "" });
const pageForm = (page) => {
  const c = page.content ?? {};
  if (page.slug === "faq") return { titleAr: c.titleAr ?? "", titleFranco: c.titleFranco ?? "", items: (c.items?.length ? c.items : [emptyItem()]).map((i) => ({ ...emptyItem(), ...i })) };
  return { titleAr: c.titleAr ?? "", titleFranco: c.titleFranco ?? "", bodyAr: c.bodyAr ?? "", bodyFranco: c.bodyFranco ?? "" };
};

const PageEditor = ({ page, setNotice, reload }) => {
  const [form, setForm] = useState(() => pageForm(page));
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const set = (name) => (e) => setForm({ ...form, [name]: e.target.value });
  const setItem = (index, name) => (e) => setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, [name]: e.target.value } : item)) });
  const act = async (payload, success) => { const done = await send(payload, { success }); if (done) await reload(); };
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <H3>{page.label}</H3>
        <div>
          {page.exists && (page.isPublished ? <Badge kind="green">Published</Badge> : <Badge kind="gold">Hidden</Badge>)}
          {!page.exists && <Badge>Not written yet</Badge>}
          {page.exists && <button style={{ ...button("secondary", busy), marginLeft: 8 }} disabled={busy} onClick={() => act({ op: page.isPublished ? "page.unpublish" : "page.publish", slug: page.slug }, page.isPublished ? "Page hidden." : "Page published.")}>{page.isPublished ? "Unpublish" : "Publish"}</button>}
        </div>
      </div>
      {page.updatedAt && <Text color="grey60" mb="md">Last saved {when(page.updatedAt)} by {page.updatedBy}. A page that is not published shows "not found" on the website.</Text>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Title (Arabic)"><input aria-label={`${page.label} title (Arabic)`} style={{ ...input, ...rtl }} value={form.titleAr} maxLength={120} onChange={set("titleAr")} /></Field>
        <Field label="Title (Franco, optional)"><input aria-label={`${page.label} title (Franco)`} style={input} value={form.titleFranco} maxLength={120} onChange={set("titleFranco")} /></Field>
      </div>
      {page.slug === "faq" ? (
        <>
          {form.items.map((item, index) => (
            <div key={index} style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label={`Question ${index + 1} (Arabic)`}><input aria-label={`Question ${index + 1} (Arabic)`} style={{ ...input, ...rtl }} value={item.questionAr} maxLength={200} onChange={setItem(index, "questionAr")} /></Field>
                <Field label="Question (Franco, optional)"><input aria-label={`Question ${index + 1} (Franco)`} style={input} value={item.questionFranco} maxLength={200} onChange={setItem(index, "questionFranco")} /></Field>
                <Field label="Answer (Arabic)"><textarea aria-label={`Answer ${index + 1} (Arabic)`} style={{ ...input, ...rtl, minHeight: 70 }} value={item.answerAr} maxLength={2000} onChange={setItem(index, "answerAr")} /></Field>
                <Field label="Answer (Franco, optional)"><textarea aria-label={`Answer ${index + 1} (Franco)`} style={{ ...input, minHeight: 70 }} value={item.answerFranco} maxLength={2000} onChange={setItem(index, "answerFranco")} /></Field>
              </div>
              <button type="button" style={button("secondary")} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>Remove question</button>
            </div>
          ))}
          <div style={{ marginTop: 12 }}><button type="button" style={button("secondary")} disabled={form.items.length >= 50} onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>Add question</button></div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Text (Arabic)" hint="Plain text. A blank line starts a new paragraph, a line starting with ## is a heading, and lines starting with - are a list."><textarea aria-label={`${page.label} text (Arabic)`} style={{ ...input, ...rtl, minHeight: 260 }} value={form.bodyAr} maxLength={20000} onChange={set("bodyAr")} /></Field>
          <Field label="Text (Franco, optional)"><textarea aria-label={`${page.label} text (Franco)`} style={{ ...input, minHeight: 260 }} value={form.bodyFranco} maxLength={20000} onChange={set("bodyFranco")} /></Field>
        </div>
      )}
      <div style={{ marginTop: 12 }}><button style={button("primary", busy)} disabled={busy} onClick={() => act({ op: "page.save", slug: page.slug, content: form }, "Page saved.")}>{busy ? "Saving…" : "Save page"}</button></div>
    </div>
  );
};

const Pages = ({ setNotice }) => {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    try { setData(await get({ view: "pages" }, PAGE_NAME)); } catch { setNotice({ kind: "danger", text: "The pages could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { reload(); }, [reload]);
  return (
    <>
      <Tabs view="pages" navigate={navigate} analyticsUrl={data?.analyticsUrl} />
      {!data ? <Text>Loading…</Text> : data.pages.map((page) => <PageEditor key={`${page.slug}-${page.updatedAt}-${page.isPublished}`} page={page} setNotice={setNotice} reload={reload} />)}
    </>
  );
};

// ---- site settings ---------------------------------------------------------------------------------

const FIELDS = [
  ["supportPhone", "Support phone"],
  ["whatsapp", "WhatsApp number"],
  ["supportEmail", "Support email"],
  ["facebookUrl", "Facebook address"],
  ["instagramUrl", "Instagram address"],
  ["tiktokUrl", "TikTok address"],
];

const Settings = ({ setNotice }) => {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const navigate = useNavigate();
  const reload = useCallback(async () => {
    try {
      const next = await get({ view: "settings" }, PAGE_NAME);
      setData(next);
      setForm(Object.fromEntries(FIELDS.map(([key]) => [key, next.settings[key] ?? ""])));
    } catch { setNotice({ kind: "danger", text: "The settings could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { reload(); }, [reload]);
  if (!data || !form) return <Text>Loading…</Text>;
  const act = async (payload, success) => { const done = await send(payload, { success }); if (done) await reload(); };
  return (
    <>
      <Tabs view="settings" navigate={navigate} analyticsUrl={data.analyticsUrl} />
      <div style={{ ...card, marginBottom: 16 }}>
        <H3>Logo</H3>
        {data.uploadsEnabled ? null : <Notice notice={{ kind: "danger", text: "File storage is not configured on this service, so the logo cannot be uploaded." }} />}
        {data.logoUrl ? <img src={data.logoUrl} alt="Current logo" style={{ maxWidth: 200, maxHeight: 120, display: "block", marginBottom: 8, background: "#eee" }} /> : <Text>No logo uploaded. The site shows the Sahsah mark.</Text>}
        <input aria-label="Upload logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !data.uploadsEnabled} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) act({ op: "logo.upload", file }, "Logo updated."); }} />
        <Text color="grey60" mt="sm">PNG, JPEG or WebP, at most 2 MB. It is public.</Text>
        {data.logoUrl && <div style={{ marginTop: 8 }}><button style={button("secondary", busy)} disabled={busy} onClick={() => act({ op: "logo.remove" }, "Logo removed.")}>Remove logo</button></div>}
      </div>
      <form style={card} onSubmit={(e) => { e.preventDefault(); act({ op: "settings.save", ...form }, "Settings saved."); }}>
        <H3>Contact and social</H3>
        <Text mb="md">Shown in the footer of the website. Leave a field empty to hide it.</Text>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {FIELDS.map(([key, label]) => <Field key={key} label={label}><input aria-label={label} style={input} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Field>)}
        </div>
        {data.updatedAt && <Text color="grey60" mb="md">Last saved {when(data.updatedAt)} by {data.updatedBy}.</Text>}
        <button style={button("primary", busy)} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      </form>
    </>
  );
};

const PublicSitePage = () => {
  const location = useLocation();
  const [notice, setNotice] = useState(null);
  const view = new URLSearchParams(location.search).get("view");
  useEffect(() => setNotice(null), [location.search]);
  return (
    <Box variant="white">
      <H3>Public site</H3>
      <Notice notice={notice} />
      {view === "pages" ? <Pages setNotice={setNotice} /> : view === "settings" ? <Settings setNotice={setNotice} /> : <Announcements setNotice={setNotice} />}
    </Box>
  );
};

export default PublicSitePage;
