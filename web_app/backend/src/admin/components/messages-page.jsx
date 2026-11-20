import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useLocation, useNavigate } from "react-router";
import { Field, Notice, button, card, colors, get, input, messageFor, useSend } from "./content-ui";

const PAGE = "/admin/pages/messages";
const PAGE_NAME = "messages";
// Postgres text: "2026-11-20 10:00:00.123456+00".
const when = (value) => (value ? new Date(value.replace(" ", "T").replace(/\+00$/, "Z")).toLocaleString() : "");
const th = { textAlign: "left", color: colors.muted, padding: "6px 8px" };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };
const KIND = { support: "Support", business: "Business", experience: "Experience" };
const REASON = { technical: "Technical", purchase: "Purchase", account: "Account" };
const BUSINESS = { business: "Business", influencer: "Influencer" };
const Badge = ({ kind, children }) => (
  <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, marginRight: 4, background: kind === "red" ? "#fbe3e1" : kind === "gold" ? "#fbefcf" : kind === "green" ? "#e3f1e8" : "#e7e3d6", color: kind === "red" ? "#8a1f18" : kind === "gold" ? "#7a5200" : kind === "green" ? "#134b2c" : colors.muted }}>{children}</span>
);
const Link = ({ to, navigate, children }) => <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>;
const Stars = ({ rating }) => <span aria-label={`${rating} out of 5`} title={`${rating} out of 5`}>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
const detailOf = (row) => row.kind === "support" ? REASON[row.supportReason] ?? row.supportReason : row.kind === "business" ? BUSINESS[row.businessKind] ?? row.businessKind : row.rating ? <Stars rating={row.rating} /> : "No rating";

// ---- inbox -----------------------------------------------------------------------------------------

const Inbox = ({ navigate, setNotice }) => {
  // The Home queue links here with ?state=open, so the page opens on the same list the count came from.
  const query = new URLSearchParams(useLocation().search);
  const [filters, setFilters] = useState({ state: query.get("state") ?? "open", kind: query.get("kind") ?? "" });
  const [data, setData] = useState(null);
  const key = JSON.stringify(filters);
  const fetchRows = useCallback(async (cursor) => {
    try {
      const params = { ...JSON.parse(key), cursor };
      for (const name of Object.keys(params)) if (!params[name]) delete params[name];
      const next = await get(params, PAGE_NAME);
      setData((previous) => (cursor && previous ? { ...next, rows: [...previous.rows, ...next.rows] } : next));
    } catch {
      setData({ rows: [], nextCursor: null });
      setNotice({ kind: "danger", text: "The messages could not be loaded." });
    }
  }, [key, setNotice]);
  useEffect(() => { fetchRows(); }, [fetchRows]);
  const set = (name) => (e) => setFilters({ ...filters, [name]: e.target.value });
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select aria-label="State" style={{ ...input, width: 150 }} value={filters.state} onChange={set("state")}><option value="">Open and closed</option><option value="open">Open</option><option value="closed">Closed</option></select>
        <select aria-label="Kind" style={{ ...input, width: 170 }} value={filters.kind} onChange={set("kind")}><option value="">All kinds</option><option value="support">Support</option><option value="business">Business</option><option value="experience">Experience</option></select>
      </div>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Received</th><th style={th}>Kind</th><th style={th}>From</th><th style={th}>Message</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={td}><Link navigate={navigate} to={`${PAGE}?view=message&id=${row.id}`}>{when(row.createdAt)}</Link></td>
                  <td style={td}><strong>{KIND[row.kind]}</strong><br /><span style={{ color: colors.muted, fontSize: 12 }}>{detailOf(row)}</span></td>
                  <td style={td}>{row.name ?? <span style={{ color: colors.muted }}>No name</span>}<br /><span style={{ color: colors.muted, fontSize: 12 }}>{row.email ?? "No email"}</span></td>
                  <td style={{ ...td, maxWidth: 360 }}>{row.preview ?? <span style={{ color: colors.muted }}>No text</span>}</td>
                  <td style={td}>{row.state === "open" ? <Badge kind="gold">Open</Badge> : <Badge>Closed</Badge>}{row.replied && <Badge kind="green">Replied</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">{filters.state || filters.kind ? "No messages match these filters." : "No messages yet. Messages sent from the website contact form appear here."}</Text>}
          {data.nextCursor && <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => fetchRows(data.nextCursor)}>Load more</button></div>}
        </>
      )}
    </div>
  );
};

// ---- one message -----------------------------------------------------------------------------------

const REPLY_STATUS = { sending: ["Sending", "gold"], sent: ["Sent by email", "green"], failed: ["Failed: not sent", "red"], external: ["Answered from an email app", "green"] };
const Fact = ({ label, children }) => <div><Text color="grey60">{label}</Text><strong>{children}</strong></div>;

/** The staff's own mail app, with the address, subject and the original quoted. */
const mailtoOf = (message, subject) => {
  const quoted = (message.message ?? "").split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const body = `\n\n---\nOriginal message (${when(message.createdAt)}):\n${quoted}\n`;
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const MessageView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchMessage = useCallback(async () => {
    try { setData(await get({ view: "message", id }, PAGE_NAME)); } catch { setNotice({ kind: "danger", text: "That message could not be loaded." }); }
  }, [id, setNotice]);
  useEffect(() => { fetchMessage(); }, [fetchMessage]);
  if (!data) return <Text>Loading…</Text>;
  const { message, replies, subject, replyBlocked, emailConfigured } = data;
  // The thread is reloaded after a failed send too: the failed attempt is recorded.
  const act = async (payload, success) => { const done = await send(payload, { success }); await fetchMessage(); return done; };
  const sendReply = async (e) => { e.preventDefault(); const done = await act({ op: "reply", id, body }, "Reply sent."); if (done) setBody(""); };
  const markReplied = async (e) => { e.preventDefault(); const done = await act({ op: "reply.external", id, note }, "Marked as replied."); if (done) setNote(""); };
  return (
    <>
      <p><Link navigate={navigate} to={PAGE}>← All messages</Link></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <H3>{KIND[message.kind]} message</H3>
          <div>
            {message.state === "open" ? <Badge kind="gold">Open</Badge> : <Badge>Closed</Badge>}
            <button style={{ ...button("secondary", busy), marginLeft: 8 }} disabled={busy} onClick={() => act({ op: message.state === "open" ? "close" : "reopen", id }, message.state === "open" ? "Message closed." : "Message reopened.")}>{message.state === "open" ? "Close message" : "Reopen message"}</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", margin: "12px 0" }}>
          <Fact label="Received">{when(message.createdAt)}</Fact>
          {message.kind === "support" && <Fact label="Reason">{REASON[message.supportReason] ?? message.supportReason}</Fact>}
          {message.kind === "business" && <Fact label="Enquiry">{BUSINESS[message.businessKind] ?? message.businessKind}</Fact>}
          {message.kind === "experience" && <Fact label="Rating">{message.rating ? <Stars rating={message.rating} /> : "No rating"}</Fact>}
          <Fact label="Name">{message.name ?? "Not given"}</Fact>
          <Fact label="Email">{message.email ?? "Not given"}</Fact>
          {message.handle && <Fact label="Handle">{message.handle}</Fact>}
          <Fact label="Account">{message.accountId ? <Link navigate={navigate} to={`/admin/pages/players?view=account&id=${message.accountId}`}>{message.accountPhone ?? message.accountName ?? "(deleted)"}</Link> : "Not signed in"}</Fact>
          {message.closedAt && <Fact label="Closed">{when(message.closedAt)} by {message.closedBy}</Fact>}
        </div>
        <Text color="grey60">Message</Text>
        <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{message.message ?? "No text, rating only."}</p>
        <Text mt="md" color="grey60" fontSize="sm">The email address is what the sender typed; it is not verified.</Text>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Replies</H3>
        {replies.length === 0 && <Text mb="md">No replies yet. The player's answers arrive in the support mailbox, not here.</Text>}
        {replies.map((reply) => {
          const [label, kind] = REPLY_STATUS[reply.status] ?? [reply.status, ""];
          return (
            <div key={reply.id} style={{ borderTop: `1px solid ${colors.line}`, padding: "10px 0" }}>
              <div><Badge kind={kind}>{label}</Badge> <span style={{ color: colors.muted, fontSize: 13 }}>{reply.staffEmail}, {when(reply.createdAt)}</span></div>
              {reply.status === "failed" && <Text color="error">{messageFor(reply.errorCode)}</Text>}
              <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{reply.body}</p>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <H3>Answer this message</H3>
        {replyBlocked === "experience" ? (
          <Text>Experience feedback is not answered by email. Close it when you have read it.</Text>
        ) : replyBlocked === "no_email" ? (
          <Text>This message has no usable email address, so it cannot be answered by email. Close it when it is dealt with.</Text>
        ) : emailConfigured ? (
          <form onSubmit={sendReply}>
            <Text mb="md">Sent from the support address with the subject "{subject}", quoting the original message.</Text>
            <Field label="Reply"><textarea aria-label="Reply" style={{ ...input, minHeight: 140 }} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></Field>
            <button style={button("primary", busy || !body.trim())} disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send reply"}</button>
          </form>
        ) : (
          <>
            <div role="note" style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 12, background: "#fbefcf", color: "#7a5200" }}>Email sending is not configured on this service (no RESEND_API_KEY), so Sahsah cannot send the reply itself. Write it in your own email app, then mark it as replied here.</div>
            <p><a href={mailtoOf(message, subject)} style={{ ...button("primary"), display: "inline-block", textDecoration: "none" }}>Reply in your email app</a></p>
            <form onSubmit={markReplied} style={{ marginTop: 16 }}>
              <Field label="Note (optional)" hint="Kept with the reply record. Leave it empty if you only want to record that you answered."><input aria-label="Note" style={input} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} /></Field>
              <button style={button("secondary", busy)} disabled={busy}>Mark replied</button>
            </form>
          </>
        )}
      </div>
    </>
  );
};

const MessagesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  useEffect(() => setNotice(null), [location.search]);
  return (
    <Box variant="white">
      <H3>Messages</H3>
      <Notice notice={notice} />
      {view === "message" ? <MessageView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} /> : <Inbox key={location.search} navigate={navigate} setNotice={setNotice} />}
    </Box>
  );
};

export default MessagesPage;
