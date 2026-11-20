import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useLocation, useNavigate } from "react-router";
import { Field, Notice, button, card, colors, get, input, useSend } from "./content-ui";
import PackView from "./content-pack";
import FormatsView from "./content-formats";
import ImportView from "./content-import";

const PAGE = "/admin/pages/content";
const Arrows = ({ onMove, first, last, busy }) => (
  <span style={{ display: "inline-flex", gap: 4 }}>
    <button type="button" aria-label="Move up" disabled={first || busy} onClick={() => onMove("up")} style={button("secondary", first || busy)}>↑</button>
    <button type="button" aria-label="Move down" disabled={last || busy} onClick={() => onMove("down")} style={button("secondary", last || busy)}>↓</button>
  </span>
);

const SectionsPanel = ({ sections, reload, setNotice }) => {
  const { send, busy } = useSend(setNotice);
  const [draft, setDraft] = useState({ nameAr: "", nameFranco: "" });
  const [editing, setEditing] = useState(null);
  const create = async (event) => {
    event.preventDefault();
    if (await send({ op: "section.create", ...draft }, { success: "Section added." })) {
      setDraft({ nameAr: "", nameFranco: "" });
      reload();
    }
  };
  const rename = async (event) => {
    event.preventDefault();
    if (await send({ op: "section.rename", id: editing.id, nameAr: editing.nameAr, nameFranco: editing.nameFranco }, { success: "Section renamed." })) {
      setEditing(null);
      reload();
    }
  };
  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <H3>Sections</H3>
      <Text mb="md">A section is a shelf of categories on the selection screen. The order here is the order players see.</Text>
      {sections.length === 0 && <Text mb="md">No sections yet. Add the first one to start creating categories.</Text>}
      {sections.map((section, index) => (
        <div key={section.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.line}` }}>
          <Arrows busy={busy} first={index === 0} last={index === sections.length - 1} onMove={async (direction) => (await send({ op: "section.move", id: section.id, direction })) && reload()} />
          {editing?.id === section.id ? (
            <form onSubmit={rename} style={{ display: "flex", gap: 8, flex: 1 }}>
              <input aria-label="Arabic name" dir="rtl" style={input} value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
              <input aria-label="Franco name" style={input} value={editing.nameFranco ?? ""} onChange={(e) => setEditing({ ...editing, nameFranco: e.target.value })} />
              <button style={button("primary", busy)} disabled={busy}>Save</button>
              <button type="button" style={button("secondary")} onClick={() => setEditing(null)}>Cancel</button>
            </form>
          ) : (
            <>
              <span style={{ flex: 1 }}><strong dir="rtl">{section.nameAr}</strong>{section.nameFranco ? <span style={{ color: colors.muted }}> · {section.nameFranco}</span> : null}</span>
              <button type="button" style={button("secondary")} onClick={() => setEditing({ ...section })}>Rename</button>
            </>
          )}
        </div>
      ))}
      <form onSubmit={create} style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}><Field label="New section: Arabic name"><input style={input} dir="rtl" value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Franco name (optional)"><input style={input} value={draft.nameFranco} onChange={(e) => setDraft({ ...draft, nameFranco: e.target.value })} /></Field></div>
        <div style={{ marginBottom: 12 }}><button style={button("primary", busy)} disabled={busy}>Add section</button></div>
      </form>
    </div>
  );
};

const CategoryForm = ({ sections, initial, onSubmit, busy, submitLabel }) => {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Arabic name"><input style={input} dir="rtl" value={form.nameAr} onChange={set("nameAr")} /></Field>
        <Field label="Franco name (optional)"><input style={input} value={form.nameFranco ?? ""} onChange={set("nameFranco")} /></Field>
        <Field label="Arabic description (optional)"><textarea style={input} dir="rtl" rows={2} value={form.descriptionAr ?? ""} onChange={set("descriptionAr")} /></Field>
        <Field label="Franco description (optional)"><textarea style={input} rows={2} value={form.descriptionFranco ?? ""} onChange={set("descriptionFranco")} /></Field>
        <Field label="Section">
          <select style={input} value={form.sectionId ?? ""} onChange={set("sectionId")}>
            <option value="">Choose a section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
          </select>
        </Field>
      </div>
      <button style={button("primary", busy)} disabled={busy}>{submitLabel}</button>
    </form>
  );
};

const empty = { nameAr: "", nameFranco: "", descriptionAr: "", descriptionFranco: "", sectionId: "" };

const HomeView = ({ navigate, setNotice }) => {
  const [filters, setFilters] = useState({ section: "", status: "active" });
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);
  const { send, busy } = useSend(setNotice);
  const load = useCallback(async (cursor) => {
    try {
      const next = await get({ view: "home", section: filters.section || undefined, status: filters.status, cursor });
      setData((previous) => (cursor && previous ? { ...next, categories: [...previous.categories, ...next.categories], sections: next.sections } : next));
    } catch {
      setNotice({ kind: "danger", text: "The catalog could not be loaded." });
    }
  }, [filters, setNotice]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Text>Loading…</Text>;
  const move = async (id, direction) => (await send({ op: "category.move", id, direction })) && load();
  return (
    <>
      {!data.mediaEnabled && <Notice notice={{ kind: "danger", text: "File storage is not configured on this service: covers and question files cannot be uploaded until it is." }} />}
      <SectionsPanel sections={data.sections} reload={() => load()} setNotice={setNotice} />
      <div style={card}>
        <Box flex style={{ justifyContent: "space-between", alignItems: "center" }}>
          <H3>Categories</H3>
          <button style={button("primary")} onClick={() => setCreating(!creating)} disabled={data.sections.length === 0}>{creating ? "Close" : "New category"}</button>
        </Box>
        {creating && (
          <div style={{ marginBottom: 16 }}>
            <CategoryForm sections={data.sections} initial={{ ...empty, sectionId: filters.section && filters.section !== "none" ? filters.section : "" }} busy={busy} submitLabel="Create category"
              onSubmit={async (form) => { const done = await send({ op: "category.create", ...form }, { success: "Category created. Add a cover and a pack next." }); if (done?.id) navigate(`${PAGE}?view=category&id=${done.id}`); }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 12, margin: "8px 0 12px" }}>
          <select aria-label="Section" style={{ ...input, width: 220 }} value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })}>
            <option value="">All sections</option>
            <option value="none">No section</option>
            {data.sections.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
          </select>
          <select aria-label="Status" style={{ ...input, width: 160 }} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", color: colors.muted }}><th>Cover</th><th>Category</th><th>Section</th><th>Packs (published / draft)</th><th>Status</th><th>Order</th></tr></thead>
          <tbody>
            {data.categories.map((c, index) => (
              <tr key={c.id} style={{ borderTop: `1px solid ${colors.line}` }}>
                <td style={{ padding: 6 }}>{c.coverUrl ? <img src={c.coverUrl} alt="" width={40} height={50} style={{ objectFit: "cover", borderRadius: 4 }} /> : <span style={{ color: colors.muted }}>none</span>}</td>
                <td><a href={`${PAGE}?view=category&id=${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`${PAGE}?view=category&id=${c.id}`); }}><strong dir="rtl">{c.nameAr}</strong></a>{c.nameFranco ? <span style={{ color: colors.muted }}> · {c.nameFranco}</span> : null}</td>
                <td dir="rtl">{c.sectionName ?? "—"}</td>
                <td>{c.packs.published} / {c.packs.drafts}{c.packs.archived ? ` (+${c.packs.archived} archived)` : ""}</td>
                <td>{c.archived ? "Archived" : "Active"}</td>
                <td>{filters.section && filters.section !== "none" && filters.status === "active" ? <Arrows busy={busy} first={index === 0} last={index === data.categories.length - 1 && !data.nextCursor} onMove={(d) => move(c.id, d)} /> : <span style={{ color: colors.muted, fontSize: 12 }}>filter by one section to reorder</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.categories.length === 0 && <Text mt="md">No categories match.</Text>}
        {data.nextCursor && <Box mt="md"><button style={button("secondary")} onClick={() => load(data.nextCursor)}>Load more</button></Box>}
      </div>
    </>
  );
};

const CategoryView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const { send, busy } = useSend(setNotice);
  const load = useCallback(async () => {
    try { setData(await get({ view: "category", id })); } catch { setNotice({ kind: "danger", text: "That category could not be loaded." }); }
  }, [id, setNotice]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Text>Loading…</Text>;
  const { category } = data;
  const act = async (body, success) => { if (await send(body, { success })) load(); };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) act({ op: "category.cover", id, file }, "Cover updated.");
  };
  return (
    <>
      <p><a href={PAGE} onClick={(e) => { e.preventDefault(); navigate(PAGE); }}>← All categories</a></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <Box flex style={{ justifyContent: "space-between" }}>
          <H3><span dir="rtl">{category.nameAr}</span> {category.archived && <span style={{ color: colors.red }}>(archived)</span>}</H3>
          <button style={button(category.archived ? "primary" : "danger", busy)} disabled={busy} onClick={() => act({ op: category.archived ? "category.unarchive" : "category.archive", id }, category.archived ? "Category restored." : "Category archived: it is hidden from new games.")}>
            {category.archived ? "Restore category" : "Archive category"}
          </button>
        </Box>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px" }}>
            <CategoryForm sections={data.sections} initial={category} busy={busy} submitLabel="Save category" onSubmit={(form) => act({ op: "category.update", id, ...form }, "Category saved.")} />
          </div>
          <div style={{ width: 200 }}>
            <Text fontWeight="bold" mb="sm">Public cover</Text>
            {category.coverUrl ? <img src={category.coverUrl} alt="Current cover" style={{ width: 160, height: 200, objectFit: "cover", borderRadius: 6, border: `1px solid ${colors.line}` }} /> : <Text>No cover yet.</Text>}
            <input aria-label="Upload cover" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !data.mediaEnabled} onChange={upload} style={{ marginTop: 8, maxWidth: 190 }} />
            <Text fontSize="xs" color="grey60">Portrait 4:5, 400–2400 px wide, PNG, JPEG or WebP, up to 5 MB. It is public artwork.</Text>
          </div>
        </div>
      </div>
      <div style={card}>
        <Box flex style={{ justifyContent: "space-between" }}>
          <H3>Packs</H3>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button style={button("secondary", busy || category.archived)} disabled={busy || category.archived} onClick={() => navigate(`${PAGE}?view=import&id=${id}`)}>Import packs</button>
            <button style={button("primary", busy)} disabled={busy} onClick={async () => { const done = await send({ op: "pack.create", categoryId: id }); if (done?.id) navigate(`${PAGE}?view=pack&id=${done.id}`); }}>New draft pack</button>
          </span>
        </Box>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ textAlign: "left", color: colors.muted }}><th>Pack</th><th>Status</th><th>Questions</th><th>Problems</th></tr></thead>
          <tbody>
            {data.packs.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${colors.line}` }}>
                <td style={{ padding: 6 }}><a href={`${PAGE}?view=pack&id=${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`${PAGE}?view=pack&id=${p.id}`); }}>Pack {p.packNumber}</a></td>
                <td style={{ textTransform: "capitalize" }}>{p.state}</td>
                <td>{p.filledSlots} / 6</td>
                <td>{p.issueCount === 0 ? "Ready" : `${p.issueCount} to fix`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.packs.length === 0 && <Text mt="md">No packs yet. Create a draft pack and fill its six slots.</Text>}
      </div>
    </>
  );
};

const th = { textAlign: "left", color: colors.muted, padding: "6px 8px" };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };
const go = (navigate, to) => (e) => { e.preventDefault(); navigate(to); };

/** Lists behind the Home "needs attention" counts; paged by cursor like the other lists. */
const useQueue = (view, setNotice) => {
  const [data, setData] = useState(null);
  const load = useCallback(async (cursor) => {
    try {
      const next = await get({ view, cursor });
      setData((previous) => (cursor && previous ? { ...next, rows: [...previous.rows, ...next.rows] } : next));
    } catch {
      setData({ rows: [], nextCursor: null });
      setNotice({ kind: "danger", text: "The list could not be loaded." });
    }
  }, [view, setNotice]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
};

const DraftsView = ({ navigate, setNotice }) => {
  const [data, load] = useQueue("drafts", setNotice);
  return (
    <div style={card}>
      <H3>Unfinished drafts</H3>
      <Text mb="md">Draft packs of active categories with fewer than six current questions, oldest first.</Text>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Category</th><th style={th}>Pack</th><th style={th}>Questions</th><th style={th}>Created</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={td} dir="rtl"><a href={`${PAGE}?view=category&id=${row.categoryId}`} onClick={go(navigate, `${PAGE}?view=category&id=${row.categoryId}`)}>{row.categoryNameAr}</a></td>
                  <td style={td}><a href={`${PAGE}?view=pack&id=${row.id}`} onClick={go(navigate, `${PAGE}?view=pack&id=${row.id}`)}>Pack {row.packNumber}</a></td>
                  <td style={td}>{row.filled} / 6</td>
                  <td style={td}>{new Date(row.createdAt.replace(" ", "T").replace(/\+00$/, "Z")).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No unfinished drafts.</Text>}
          {data.nextCursor && <Box mt="md"><button style={button("secondary")} onClick={() => load(data.nextCursor)}>Load more</button></Box>}
        </>
      )}
    </div>
  );
};

const DislikedView = ({ navigate, setNotice }) => {
  const [data, load] = useQueue("disliked", setNotice);
  return (
    <div style={card}>
      <H3>Disliked questions</H3>
      <Text mb="md">Current questions with at least 20 votes of which at least 40% are thumbs-down. Open the pack to correct or replace the question.</Text>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Question</th><th style={th}>Pack</th><th style={th}>Thumbs-down</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...td, maxWidth: 420 }} dir="rtl">{row.promptAr}</td>
                  <td style={td}><span dir="rtl">{row.categoryNameAr}</span> · <a href={`${PAGE}?view=pack&id=${row.packId}`} onClick={go(navigate, `${PAGE}?view=pack&id=${row.packId}`)}>Pack {row.packNumber}, slot {row.slot}</a></td>
                  <td style={td}>{row.dislikes} of {row.votes} ({Math.round((row.dislikes / row.votes) * 100)}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No question has a high thumbs-down share.</Text>}
          {data.nextCursor && <Box mt="md"><button style={button("secondary")} onClick={() => load(data.nextCursor)}>Load more</button></Box>}
        </>
      )}
    </div>
  );
};

const ContentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const params = new URLSearchParams(location.search);
  const view = params.get("view") ?? "home";
  useEffect(() => setNotice(null), [location.search]);
  return (
    <Box variant="white">
      <H3>Content</H3>
      {(view === "home" || view === "formats") && (
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" role="tab" aria-selected={view === "home"} style={button(view === "home" ? "primary" : "secondary")} onClick={() => navigate(PAGE)}>Categories</button>
          <button type="button" role="tab" aria-selected={view === "formats"} style={button(view === "formats" ? "primary" : "secondary")} onClick={() => navigate(`${PAGE}?view=formats`)}>Formats</button>
        </div>
      )}
      {(view === "drafts" || view === "disliked") && <p><a href={PAGE} onClick={(e) => { e.preventDefault(); navigate(PAGE); }}>← All categories</a></p>}
      <Notice notice={notice} />
      {view === "category" ? <CategoryView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} /> : view === "pack" ? <PackView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} /> : view === "import" ? <ImportView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} /> : view === "formats" ? <FormatsView setNotice={setNotice} /> : view === "drafts" ? <DraftsView navigate={navigate} setNotice={setNotice} /> : view === "disliked" ? <DislikedView navigate={navigate} setNotice={setNotice} /> : <HomeView navigate={navigate} setNotice={setNotice} />}
    </Box>
  );
};

export default ContentPage;
