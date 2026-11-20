import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useLocation, useNavigate } from "react-router";
import { Field, Notice, button, card, colors, get, input, useSend } from "./content-ui";

const PAGE = "/admin/pages/players";
const PAGE_NAME = "players";
const load = (params) => get(params, PAGE_NAME);
// Postgres text: "2026-11-20 10:00:00.123456+00".
const when = (value) => (value ? new Date(value.replace(" ", "T").replace(/\+00$/, "Z")).toLocaleString() : "");
const STATES = { active: "Active", deletion_pending: "Deletion pending", deleted: "Deleted" };
const th = { textAlign: "left", color: colors.muted, padding: "6px 8px" };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };
const Badge = ({ kind, children }) => (
  <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, marginRight: 4, background: kind === "red" ? "#fbe3e1" : kind === "gold" ? "#fbefcf" : "#e7e3d6", color: kind === "red" ? "#8a1f18" : kind === "gold" ? "#7a5200" : colors.muted }}>{children}</span>
);

const Link = ({ to, navigate, children }) => (
  <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>
);

const Tabs = ({ view, navigate }) => (
  <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
    {[["list", "Accounts"], ["bulk", "Bulk grant"], ["deletions", "Deletion requests"]].map(([key, label]) => (
      <button key={key} role="tab" aria-selected={view === key || (view === "account" && key === "list")} style={button(view === key || (view === "account" && key === "list") ? "primary" : "secondary")} onClick={() => navigate(key === "list" ? PAGE : `${PAGE}?view=${key}`)}>{label}</button>
    ))}
  </div>
);

const ListView = ({ navigate, setNotice }) => {
  const [filters, setFilters] = useState({ q: "", state: "", banned: "", flagged: "" });
  const [draft, setDraft] = useState("");
  const [data, setData] = useState(null);
  const fetchRows = useCallback(async (cursor) => {
    try {
      const next = await load({ view: "list", q: filters.q || undefined, state: filters.state || undefined, banned: filters.banned || undefined, flagged: filters.flagged || undefined, cursor });
      setNotice(null);
      setData((previous) => (cursor && previous ? { ...next, rows: [...previous.rows, ...next.rows] } : next));
    } catch (error) {
      setData({ rows: [], nextCursor: null });
      setNotice({ kind: "danger", text: error?.response?.data?.error === "invalid_search" ? "Search with a phone number or at least the last 4 digits of one." : "The accounts could not be loaded." });
    }
  }, [filters, setNotice]);
  useEffect(() => { fetchRows(); }, [fetchRows]);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  return (
    <div style={card}>
      <form onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, q: draft.trim() }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input aria-label="Phone number" placeholder="Phone number or last digits" style={{ ...input, width: 240 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button style={button("primary")}>Search</button>
        <select aria-label="State" style={{ ...input, width: 170 }} value={filters.state} onChange={set("state")}>
          <option value="">Any state</option>
          {Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Banned" style={{ ...input, width: 150 }} value={filters.banned} onChange={set("banned")}>
          <option value="">Banned or not</option><option value="yes">Banned</option><option value="no">Not banned</option>
        </select>
        <select aria-label="Flagged" style={{ ...input, width: 150 }} value={filters.flagged} onChange={set("flagged")}>
          <option value="">Flagged or not</option><option value="yes">Flagged</option><option value="no">Not flagged</option>
        </select>
      </form>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Phone</th><th style={th}>Name</th><th style={th}>State</th><th style={th}>Tokens</th><th style={th}>Created</th><th style={th}>Marks</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}><Link navigate={navigate} to={`${PAGE}?view=account&id=${row.id}`}>{row.phone ?? "(deleted)"}</Link></td>
                  <td style={td}>{row.displayName ?? ""}</td>
                  <td style={td}>{STATES[row.state]}</td>
                  <td style={td}>{row.tokenBalance}</td>
                  <td style={td}>{when(row.createdAt)}</td>
                  <td style={td}>{row.banned && <Badge kind="red">Banned</Badge>}{row.flagged && <Badge kind="gold">Flagged</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No accounts match.</Text>}
          {data.nextCursor && <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => fetchRows(data.nextCursor)}>Load more</button></div>}
        </>
      )}
    </div>
  );
};

const ReasonForm = ({ label, placeholder, submit, busy, kind = "primary", children }) => {
  const [text, setText] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await submit(text)) setText(""); }} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      {children}
      <div style={{ flex: "1 1 260px" }}><Field label={label}><input style={input} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} /></Field></div>
      <div style={{ marginBottom: 12 }}><button style={button(kind, busy)} disabled={busy}>{kind === "danger" ? "Ban account" : "Save"}</button></div>
    </form>
  );
};

const AccountView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const [quantity, setQuantity] = useState("");
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchAccount = useCallback(async (cursor) => {
    try {
      const next = await load({ view: "account", id, cursor });
      setData((previous) => (cursor && previous ? { ...next, ledger: [...previous.ledger, ...next.ledger] } : next));
    } catch {
      setNotice({ kind: "danger", text: "That account could not be loaded." });
    }
  }, [id, setNotice]);
  useEffect(() => { fetchAccount(); }, [fetchAccount]);
  if (!data) return <Text>Loading…</Text>;
  const { account } = data;
  const act = async (body, success) => { const done = await send(body, { success }); if (done) fetchAccount(); return done; };
  const activeBan = data.bans.find((ban) => !ban.liftedAt);
  return (
    <>
      <p><Link navigate={navigate} to={PAGE}>← All accounts</Link></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>{account.displayName ?? "Deleted account"} {account.banned && <Badge kind="red">Banned</Badge>}{account.openFlags > 0 && <Badge kind="gold">Flagged</Badge>}</H3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <div><Text color="grey60">Phone</Text><strong>{account.phone ?? "(removed)"}</strong></div>
          <div><Text color="grey60">State</Text><strong>{STATES[account.state]}</strong></div>
          <div><Text color="grey60">Created</Text><strong>{when(account.createdAt)}</strong></div>
          <div><Text color="grey60">Token bank</Text><strong style={{ fontSize: 22 }}>{account.tokenBalance}</strong></div>
          <div><Text color="grey60">Games hosted</Text><strong>{account.gamesHosted}</strong></div>
        </div>
        {data.deletionRequest && <Text mt="md">Deletion request: {data.deletionRequest.state} since {when(data.deletionRequest.requestedAt)}.</Text>}
      </div>

      {account.state === "active" && (
        <div style={{ ...card, marginBottom: 20 }}>
          <H3>Add complimentary credit</H3>
          <Text mb="md">Adds tokens to the bank. Credit is permanent and cannot be taken back here, so check the amount.</Text>
          <ReasonForm label="Reason (kept in the audit log)" busy={busy} submit={(reason) => act({ op: "credit", id, quantity, reason }, `Added ${quantity} token${quantity === "1" ? "" : "s"}.`).then((done) => { if (done) setQuantity(""); return done; })}>
            <div style={{ width: 120 }}><Field label="Tokens (1–1000)"><input type="number" min="1" max="1000" style={input} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field></div>
          </ReasonForm>
        </div>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Account ban</H3>
        {activeBan ? (
          <>
            <Text mb="md">Banned by {activeBan.bannedBy} on {when(activeBan.bannedAt)}: {activeBan.reason}. The account cannot sign in or host, join or start games. A game it is already in can finish, and its token bank is kept.</Text>
            <ReasonForm label="Reason for lifting the ban" busy={busy} submit={(reason) => act({ op: "unban", id, reason }, "Ban lifted.")} />
          </>
        ) : account.state === "deleted" ? <Text>This account was deleted.</Text> : (
          <ReasonForm label="Reason (kept in the audit log)" kind="danger" busy={busy} submit={(reason) => act({ op: "ban", id, reason }, "Account banned.")} />
        )}
        {data.bans.filter((ban) => ban.liftedAt).map((ban) => (
          <Text key={ban.id} fontSize="xs" color="grey60">Earlier ban {when(ban.bannedAt)} by {ban.bannedBy}: {ban.reason}. Lifted {when(ban.liftedAt)} by {ban.liftedBy}: {ban.liftReason}.</Text>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Flags</H3>
        <Text mb="md">Staff-only notes for attention. A flag restricts nothing and players never see it.</Text>
        {data.flags.length === 0 && <Text mb="md">No flags.</Text>}
        {data.flags.map((flag) => (
          <div key={flag.id} style={{ display: "flex", gap: 12, padding: "6px 0", borderTop: `1px solid ${colors.line}`, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ textDecoration: flag.resolvedAt ? "line-through" : "none" }}>{flag.note}</div>
              <Text fontSize="xs" color="grey60">{flag.createdBy}, {when(flag.createdAt)}{flag.resolvedAt ? ` · resolved ${when(flag.resolvedAt)} by ${flag.resolvedBy}` : ""}</Text>
            </div>
            {!flag.resolvedAt && <button style={button("secondary", busy)} disabled={busy} onClick={() => act({ op: "flag.resolve", id: flag.id }, "Flag resolved.")}>Resolve</button>}
          </div>
        ))}
        <FlagForm busy={busy} submit={(note) => act({ op: "flag.add", id, note }, "Flag added.")} />
      </div>

      <div style={card}>
        <H3>Token history</H3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Tokens</th></tr></thead>
          <tbody>
            {data.ledger.map((entry) => (
              <tr key={entry.id}>
                <td style={td}>{when(entry.createdAt)}</td>
                <td style={td}>{entry.label}</td>
                <td style={{ ...td, fontWeight: 700, color: entry.amount < 0 ? colors.red : colors.forest }}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.ledger.length === 0 && <Text mt="md">No token movements yet.</Text>}
        {data.nextCursor && <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => fetchAccount(data.nextCursor)}>Load older</button></div>}
      </div>
    </>
  );
};

const FlagForm = ({ busy, submit }) => {
  const [note, setNote] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await submit(note)) setNote(""); }} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 12 }}>
      <div style={{ flex: 1 }}><Field label="New note"><input style={input} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
      <div style={{ marginBottom: 12 }}><button style={button("primary", busy)} disabled={busy}>Add flag</button></div>
    </form>
  );
};

const PhoneList = ({ title, phones, count }) =>
  count > 0 ? (
    <div style={{ marginTop: 8 }}>
      <strong>{title} ({count})</strong>
      <div style={{ fontFamily: "monospace", fontSize: 13 }}>{phones.join(", ")}{count > phones.length ? ` … and ${count - phones.length} more` : ""}</div>
    </div>
  ) : null;

const BulkView = ({ navigate, setNotice }) => {
  const empty = { target: "all_active", phones: "", quantity: "", reason: "" };
  const [form, setForm] = useState(empty);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [grants, setGrants] = useState(null);
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchGrants = useCallback(async () => {
    try { setGrants((await load({ view: "bulk" })).grants); } catch { setNotice({ kind: "danger", text: "The grant history could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { fetchGrants(); }, [fetchGrants]);
  const change = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setPreview(null); setResult(null); };
  const body = { target: form.target, phones: form.target === "phone_list" ? form.phones : undefined };
  const check = async (e) => {
    e.preventDefault();
    const data = await send({ op: "bulk.preview", ...body });
    if (data) setPreview(data);
  };
  const grant = async () => {
    const data = await send({ op: "bulk.grant", ...body, quantity: form.quantity, reason: form.reason });
    if (data) {
      setResult(data);
      setPreview(null);
      if (data.completed) { setNotice({ kind: "ok", text: `Credited ${data.grantedCount} account${data.grantedCount === 1 ? "" : "s"}.` }); setForm(empty); }
      fetchGrants();
    }
  };
  const resume = async (grantId) => {
    const data = await send({ op: "bulk.resume", id: grantId });
    if (data) { setResult(data.completed ? null : data); if (data.completed) setNotice({ kind: "ok", text: `Finished: ${data.grantedCount} of ${data.targetCount} accounts credited.` }); fetchGrants(); }
  };
  const ready = preview && form.quantity && form.reason.trim();
  return (
    <>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Bulk grant</H3>
        <Text mb="md">Gives every chosen account the same complimentary credit with one reason. Accounts that are deleted, pending deletion or banned are skipped. Credits are permanent and cannot be taken back here.</Text>
        <form onSubmit={check}>
          <Field label="Who receives it">
            <select style={{ ...input, width: 300 }} value={form.target} onChange={change("target")}>
              <option value="all_active">Every active account</option>
              <option value="phone_list">A pasted list of phone numbers</option>
            </select>
          </Field>
          {form.target === "phone_list" && <Field label="Phone numbers" hint="One per line, or separated by commas. Egyptian mobile numbers in any common spelling."><textarea style={{ ...input, fontFamily: "monospace" }} rows={6} value={form.phones} onChange={change("phones")} /></Field>}
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
            <Field label="Tokens each (1–1000)"><input type="number" min="1" max="1000" style={input} value={form.quantity} onChange={change("quantity")} /></Field>
            <Field label="Reason (kept in the audit log)"><input style={input} value={form.reason} onChange={change("reason")} /></Field>
          </div>
          <button style={button("secondary", busy)} disabled={busy}>Preview</button>
        </form>
        {preview && (
          <div style={{ marginTop: 16, padding: 12, background: colors.cream, borderRadius: 6 }}>
            <Text><strong>{preview.accounts}</strong> account{preview.accounts === 1 ? "" : "s"} would receive {form.quantity || "…"} token{form.quantity === "1" ? "" : "s"} each{form.quantity ? ` (${preview.accounts * Number(form.quantity)} in total)` : ""}.</Text>
            {preview.target === "phone_list" && <Text>{preview.numbers} number{preview.numbers === 1 ? "" : "s"} in the list.</Text>}
            <PhoneList title="Not found: no account has these numbers" phones={preview.notFound ?? []} count={preview.notFoundCount ?? 0} />
            <PhoneList title="Skipped: deleted, pending deletion or banned" phones={preview.skipped ?? []} count={preview.skippedCount ?? 0} />
            <PhoneList title="Not valid phone numbers" phones={preview.invalid ?? []} count={preview.invalidCount ?? 0} />
            <div style={{ marginTop: 12 }}>
              <button style={button("primary", busy || !ready || preview.accounts === 0)} disabled={busy || !ready || preview.accounts === 0} onClick={grant}>
                Grant {form.quantity || "…"} token{form.quantity === "1" ? "" : "s"} to {preview.accounts} account{preview.accounts === 1 ? "" : "s"}
              </button>
              {!form.quantity || !form.reason.trim() ? <Text fontSize="xs" color="grey60" mt="sm">Enter the tokens and a reason to enable the grant.</Text> : null}
            </div>
          </div>
        )}
        {result && !result.completed && (
          <Notice notice={{ kind: "danger", text: `Stopped after ${result.grantedCount} of ${result.targetCount} accounts. Nothing is lost or repeated: continue to finish.` }} />
        )}
        {result && !result.completed && <button style={button("primary", busy)} disabled={busy} onClick={() => resume(result.id)}>Continue the grant</button>}
      </div>
      <div style={card}>
        <H3>Recent bulk grants</H3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>When</th><th style={th}>By</th><th style={th}>Who</th><th style={th}>Each</th><th style={th}>Progress</th><th style={th}>Reason</th><th style={th} /></tr></thead>
          <tbody>
            {(grants ?? []).map((g) => (
              <tr key={g.id}>
                <td style={td}>{when(g.createdAt)}</td><td style={td}>{g.staffEmail}</td>
                <td style={td}>{g.targetKind === "all_active" ? "Every active account" : "Pasted list"}</td>
                <td style={td}>{g.quantity}</td>
                <td style={td}>{g.grantedCount} / {g.targetCount}{g.completedAt ? "" : " (unfinished)"}</td>
                <td style={td}>{g.reason}</td>
                <td style={td}>{!g.completedAt && <button style={button("secondary", busy)} disabled={busy} onClick={() => resume(g.id)}>Continue</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {grants && grants.length === 0 && <Text mt="md">No bulk grants yet.</Text>}
      </div>
    </>
  );
};

const DeletionsView = ({ navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const fetchRows = useCallback(async (cursor) => {
    try {
      const next = await load({ view: "deletions", cursor });
      setData((previous) => (cursor && previous ? { ...next, rows: [...previous.rows, ...next.rows] } : next));
    } catch { setNotice({ kind: "danger", text: "The deletion requests could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { fetchRows(); }, [fetchRows]);
  return (
    <div style={card}>
      <H3>Deletion requests</H3>
      <Text mb="md">Read-only. These are the requests waiting to be completed, oldest first. Completing a deletion (settling pending payments, the owner's confirmation and forfeiting the remaining tokens) belongs to the player-facing deletion flow, which is not built yet, so staff cannot approve, complete or cancel a request from here.</Text>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Requested</th><th style={th}>Account</th><th style={th}>Request</th><th style={th}>Tokens now</th><th style={th}>Funding cleared</th><th style={th}>Confirmed bank</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}>{when(row.requestedAt)}</td>
                  <td style={td}><Link navigate={navigate} to={`${PAGE}?view=account&id=${row.accountId}`}>{row.phone ?? row.displayName ?? row.accountId}</Link></td>
                  <td style={{ ...td, textTransform: "capitalize" }}>{row.state}</td>
                  <td style={td}>{row.tokenBalance}</td>
                  <td style={td}>{row.fundingClearedAt ? when(row.fundingClearedAt) : "Not yet"}</td>
                  <td style={td}>{row.confirmedBank ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No deletion requests are waiting.</Text>}
          {data.nextCursor && <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => fetchRows(data.nextCursor)}>Load more</button></div>}
        </>
      )}
    </div>
  );
};

const PlayersPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const params = new URLSearchParams(location.search);
  const view = params.get("view") ?? "list";
  useEffect(() => setNotice(null), [location.search]);
  return (
    <Box variant="white">
      <H3>Players</H3>
      <Tabs view={view} navigate={navigate} />
      <Notice notice={notice} />
      {view === "account" ? <AccountView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} /> : view === "bulk" ? <BulkView navigate={navigate} setNotice={setNotice} /> : view === "deletions" ? <DeletionsView navigate={navigate} setNotice={setNotice} /> : <ListView navigate={navigate} setNotice={setNotice} />}
    </Box>
  );
};

export default PlayersPage;
