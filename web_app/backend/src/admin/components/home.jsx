import React, { useCallback, useEffect, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { api, button, card, colors } from "./content-ui";

const QUEUES = [
  { key: "messages", label: "Open messages", hint: "Contact messages waiting for an answer", to: "/admin/pages/messages?state=open" },
  { key: "payments", label: "Payment reviews", hint: "Reconciliation cases to review", to: "/admin/pages/shop?view=reviews&state=open" },
  { key: "deletions", label: "Deletion requests", hint: "Accounts waiting to be deleted", to: "/admin/pages/players?view=deletions" },
  { key: "drafts", label: "Unfinished drafts", hint: "Draft packs with fewer than six questions", to: "/admin/pages/content?view=drafts" },
  { key: "flags", label: "Flagged accounts", hint: "Accounts with an open staff flag", to: "/admin/pages/players?flagged=yes" },
  { key: "disliked", label: "Disliked questions", hint: "Questions with many thumbs-down votes", to: "/admin/pages/content?view=disliked" },
];

// Three columns at desktop width, so six cards make two even rows.
const grid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" };
const number = (value) => value.toLocaleString("en-US");
const money = (value) => `EGP ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const weekday = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

const Kpi = ({ label, value, hint }) => (
  <div style={card}>
    <div style={{ color: colors.muted, fontSize: 13, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: colors.forest, margin: "4px 0" }}>{value}</div>
    {hint && <div style={{ color: colors.muted, fontSize: 12 }}>{hint}</div>}
  </div>
);

/** Seven bars, one per Cairo day, scaled to the busiest day of that series. */
const Bars = ({ title, rows, color }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ flex: "1 1 280px" }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 96 }} role="img" aria-label={`${title}: ${rows.map((r) => `${weekday(r.date)} ${r.value}`).join(", ")}`}>
        {rows.map((r) => (
          <div key={r.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 11, color: colors.muted }}>{r.value}</span>
            <div style={{ width: "100%", height: `${Math.max(3, (r.value / max) * 70)}%`, background: color, borderRadius: "3px 3px 0 0", opacity: r.value === 0 ? 0.35 : 1 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>{rows.map((r) => <span key={r.date} style={{ flex: 1, textAlign: "center", fontSize: 11, color: colors.muted }}>{weekday(r.date)}</span>)}</div>
    </div>
  );
};

const Home = () => {
  const { email, role } = useSelector((state) => state.session) ?? {};
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const load = useCallback(async (refresh) => {
    setLoading(true);
    try {
      const response = await api.getDashboard(refresh ? { params: { refresh: 1 } } : {});
      if (response.data?.error) throw new Error(response.data.error);
      setData(response.data);
      setReceivedAt(Date.now());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = data ? data.ageSeconds + Math.max(0, Math.floor((now - receivedAt) / 1000)) : 0;
  const k = data?.kpis;
  return (
    <Box variant="white">
      <Box flex style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <H3 style={{ marginBottom: 0 }}>Home</H3>
          <Text color="grey60">Signed in as {email} ({role === "super_admin" ? "Super Admin" : "Admin"}).{data ? ` Figures for ${data.cairoDate} (Cairo time).` : ""}</Text>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {data && <span style={{ color: colors.muted, fontSize: 13 }} aria-live="off">Updated {age} s ago</span>}
          <button style={button("secondary", loading)} disabled={loading} onClick={() => load(true)}>{loading ? "Refreshing…" : "Refresh now"}</button>
        </div>
      </Box>
      {failed && <div role="alert" style={{ padding: "10px 14px", borderRadius: 6, margin: "12px 0", background: "#fbe3e1", color: "#8a1f18" }}>The figures could not be loaded. Try Refresh now.</div>}
      {!data && !failed && <Text mt="lg">Loading…</Text>}
      {data && (
        <>
          <H3 mt="xl">Needs attention</H3>
          <div style={grid}>
            {QUEUES.map((queue) => {
              const count = data.queues[queue.key];
              return (
                <a key={queue.key} href={queue.to} data-queue={queue.key} onClick={(e) => { e.preventDefault(); navigate(queue.to); }}
                  style={{ ...card, textDecoration: "none", color: "inherit", borderColor: count > 0 ? colors.gold : colors.line, borderWidth: count > 0 ? 2 : 1 }}>
                  <div style={{ color: colors.muted, fontSize: 13, fontWeight: 600 }}>{queue.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: count > 0 ? "#7a5200" : colors.forest, margin: "4px 0" }} data-count>{number(count)}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>{count > 0 ? queue.hint : "Nothing waiting"}</div>
                </a>
              );
            })}
          </div>

          <H3 mt="xl">Today</H3>
          <div style={grid}>
            <Kpi label="Games started today" value={number(k.gamesToday)} />
            <Kpi label="Sales today" value={money(k.salesTodayEgp)} hint={!k.anyOrder ? "Checkout not live: no orders yet" : `${k.paidOrdersToday} paid ${k.paidOrdersToday === 1 ? "order" : "orders"}`} />
            <Kpi label="New accounts today" value={number(k.newAccountsToday)} />
            <Kpi label="Tokens in all banks" value={number(k.tokensInBanks)} hint="Held by players right now" />
            <Kpi label="Active games" value={number(k.activeGames)} hint="Being played right now" />
            <Kpi label="Live rooms" value={number(k.liveRooms)} hint="Open lobbies and games" />
          </div>

          <H3 mt="xl">Last 7 days</H3>
          <div style={{ ...card, display: "flex", gap: 32, flexWrap: "wrap" }}>
            <Bars title="Games started per day" color={colors.forest} rows={data.trend.map((d) => ({ date: d.date, value: d.games }))} />
            <Bars title="New accounts per day" color={colors.gold} rows={data.trend.map((d) => ({ date: d.date, value: d.accounts }))} />
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Top categories by games played</div>
              {data.topCategories.length === 0 ? <Text color="grey60">No games in the last 7 days.</Text> : (
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {data.topCategories.map((c) => <li key={c.id} style={{ marginBottom: 4 }}><span dir="rtl">{c.nameAr}</span> <span style={{ color: colors.muted }}>· {number(c.games)} {c.games === 1 ? "game" : "games"}</span></li>)}
                </ol>
              )}
            </div>
          </div>

          <H3 mt="xl">Website traffic</H3>
          <div style={card}>
            {data.analyticsUrl
              ? <Text>Visits and page views are measured by Cloudflare Web Analytics. <a href={data.analyticsUrl} target="_blank" rel="noopener noreferrer">Open website traffic</a></Text>
              : <Text color="grey60">Website traffic is not configured. Set CLOUDFLARE_ANALYTICS_URL on this service to link Cloudflare Web Analytics here.</Text>}
          </div>
        </>
      )}
    </Box>
  );
};

export default Home;
