import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, H3, Text } from "@adminjs/design-system";
import { useLocation, useNavigate } from "react-router";
import { Field, Notice, button, card, colors, get, input, messageFor, useSend } from "./content-ui";

const PAGE = "/admin/pages/shop";
const PAGE_NAME = "shop";
const load = (params) => get(params, PAGE_NAME);
// Postgres text: "2026-11-20 10:00:00.123456+00".
const toDate = (value) => new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
const when = (value) => (value ? toDate(value).toLocaleString() : "");
const pounds = (minor) => (minor === null || minor === undefined ? "" : `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`);
const percent = (bps) => `${bps / 100}%`;
const th = { textAlign: "left", color: colors.muted, padding: "6px 8px" };
const td = { padding: "6px 8px", borderTop: `1px solid ${colors.line}`, verticalAlign: "top" };
const TABS = [["pricing", "Pricing"], ["promotions", "Promotions"], ["orders", "Orders"], ["reviews", "Payment reviews"], ["products", "Store products"]];
const Badge = ({ kind, children }) => (
  <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, marginRight: 4, background: kind === "red" ? "#fbe3e1" : kind === "gold" ? "#fbefcf" : kind === "green" ? "#e3f1e8" : "#e7e3d6", color: kind === "red" ? "#8a1f18" : kind === "gold" ? "#7a5200" : kind === "green" ? "#134b2c" : colors.muted }}>{children}</span>
);
const Link = ({ to, navigate, children }) => <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>;
const LoadMore = ({ cursor, onClick }) => (cursor ? <div style={{ marginTop: 12 }}><button style={button("secondary")} onClick={() => onClick(cursor)}>Load more</button></div> : null);

/** Fetches a keyset-paged list; "Load more" appends the next page. */
function usePaged(params, message) {
  const [result, setResult] = useState(null);
  const latestRequest = useRef(0);
  const key = JSON.stringify(params);
  const fetchRows = useCallback(async (cursor) => {
    const request = ++latestRequest.current;
    try {
      const next = await load({ ...JSON.parse(key), cursor });
      if (request !== latestRequest.current) return;
      setResult((previous) => ({
        key,
        data: cursor && previous?.key === key && previous.data ? { ...next, rows: [...previous.data.rows, ...next.rows] } : next,
      }));
    } catch (error) {
      if (request !== latestRequest.current) return;
      const code = error?.response?.data?.error;
      const text = code === "invalid_search" ? messageFor(code)
        : code === "invalid_promotion_id" ? "Enter a valid UUID in Promotion ID." : message;
      setResult({ key, error: { kind: "danger", text } });
    }
  }, [key, message]);
  useEffect(() => {
    fetchRows();
    return () => { latestRequest.current += 1; };
  }, [fetchRows]);
  const current = result?.key === key ? result : null;
  return [current?.data, fetchRows, current?.error];
}

const Tabs = ({ view, navigate }) => {
  const current = view === "order" ? "orders" : view === "review" ? "reviews" : view;
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {TABS.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={current === key} style={button(current === key ? "primary" : "secondary")} onClick={() => navigate(key === "pricing" ? PAGE : `${PAGE}?view=${key}`)}>{label}</button>
      ))}
    </div>
  );
};

// ---- pricing ---------------------------------------------------------------------------------------

const roundHalfUp = (value) => Math.floor(value + 0.5);
/** Same arithmetic as the order rules: round each reduction to whole piasters, quantity discount first. */
function quote(quantity, base, tiers, giftBps) {
  const tier = tiers.filter((t) => t.is_active && t.minimum_quantity <= quantity).sort((a, b) => b.minimum_quantity - a.minimum_quantity)[0];
  const list = quantity * base;
  const offer = list - roundHalfUp((list * (tier?.discount_bps ?? 0)) / 10000);
  return { tier, list, offer, gift: offer - roundHalfUp((offer * giftBps) / 10000) };
}
const toBps = (text) => (/^\d+(\.\d{1,2})?$/.test(String(text).trim()) ? Math.round(Number(text) * 100) : NaN);

const PricingView = ({ setNotice }) => {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchPricing = useCallback(async () => {
    try {
      const data = await load({ view: "pricing" });
      setSaved(data);
      setForm({
        price: (data.baseUnitPriceMinor / 100).toFixed(2),
        gift: String(data.giftDiscountBps / 100),
        tiers: data.tiers.map((t) => ({ min: String(t.minimum_quantity), percent: String(t.discount_bps / 100), active: t.is_active })),
        bundles: data.bundles.map((b) => ({ quantity: b.quantity, active: b.is_active, order: String(b.display_order + 1) })),
      });
    } catch { setNotice({ kind: "danger", text: "The prices could not be loaded." }); }
  }, [setNotice]);
  useEffect(() => { fetchPricing(); }, [fetchPricing]);
  if (!form) return <Text>Loading…</Text>;
  const price = form.price.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/٫/g, ".");
  const base = toBps(price), gift = toBps(form.gift);
  const baseValid = base >= 1 && base <= saved.maxBaseUnitPriceMinor;
  const tiers = form.tiers.map((t) => ({ minimum_quantity: Number(t.min), discount_bps: toBps(t.percent), is_active: t.active }));
  const valid = baseValid && Number.isFinite(gift) && tiers.every((t) => Number.isInteger(t.minimum_quantity) && Number.isFinite(t.discount_bps));
  const setTier = (index, patch) => setForm({ ...form, tiers: form.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  const setBundle = (index, patch) => setForm({ ...form, bundles: form.bundles.map((b, i) => (i === index ? { ...b, ...patch } : b)) });
  const save = async (e) => {
    e.preventDefault();
    if (!valid) return;
    const done = await send({ op: "pricing.save", expectedVersion: saved.version, baseUnitPriceMinor: base, giftDiscountBps: gift, tiers, bundles: form.bundles.map((b) => ({ quantity: b.quantity, is_active: b.active, display_order: Number(b.order) - 1 })) }, { success: "Prices saved." });
    if (done) fetchPricing();
  };
  const rows = valid ? Array.from({ length: 20 }, (_, i) => ({ quantity: i + 1, ...quote(i + 1, base, tiers, gift) })) : [];
  return (
    <form onSubmit={save}>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Token price</H3>
        <Text mb="md">{saved.configured ? `Pricing version ${saved.version}, last saved ${when(saved.updatedAt)}. Every save creates a new version; orders keep the prices they were accepted at.` : "Prices have not been saved yet. These are suggested starting values; saving creates version 1."}</Text>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 200 }}>
            <Field label="Base price per token (EGP)">
              <input aria-label="Base price" inputMode="decimal" aria-invalid={!baseValid} aria-describedby={baseValid ? undefined : "base-price-error"}
                style={baseValid ? input : { ...input, borderColor: colors.red }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            {!baseValid && <p id="base-price-error" style={{ color: colors.red, fontSize: 13, margin: "0 0 12px" }}>{messageFor("price_invalid")} For example, 123.45 or ١٢٣٫٤٥.</p>}
          </div>
          <div style={{ width: 200 }}><Field label="Gift discount (%)" hint="Applies to gifted orders, instead of a promo code."><input aria-label="Gift discount" inputMode="decimal" style={input} value={form.gift} onChange={(e) => setForm({ ...form, gift: e.target.value })} /></Field></div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Quantity discounts</H3>
        <Text mb="md">The highest active discount whose quantity is not above the order quantity applies. Quantities go up from 1 to 20, at most 20 rows.</Text>
        {form.tiers.map((tier, index) => (
          <div key={index} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ width: 130 }}><Field label="From quantity"><input aria-label={`Tier ${index + 1} quantity`} inputMode="numeric" style={input} value={tier.min} onChange={(e) => setTier(index, { min: e.target.value })} /></Field></div>
            <div style={{ width: 130 }}><Field label="Discount (%)"><input aria-label={`Tier ${index + 1} discount`} inputMode="decimal" style={input} value={tier.percent} onChange={(e) => setTier(index, { percent: e.target.value })} /></Field></div>
            <label style={{ marginBottom: 20 }}><input type="checkbox" checked={tier.active} onChange={(e) => setTier(index, { active: e.target.checked })} /> Active</label>
            <div style={{ marginBottom: 12 }}><button type="button" style={button("secondary")} onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, i) => i !== index) })}>Remove</button></div>
          </div>
        ))}
        {form.tiers.length === 0 && <Text mb="md">No quantity discounts: every quantity pays the base price.</Text>}
        <button type="button" style={button("secondary", form.tiers.length >= 20)} disabled={form.tiers.length >= 20} onClick={() => setForm({ ...form, tiers: [...form.tiers, { min: "", percent: "", active: true }] })}>Add a discount</button>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Bundles</H3>
        <Text mb="md">The three fixed bundles. Turn one off to hide it; the position decides the order on the shop (1 first).</Text>
        {form.bundles.map((bundle, index) => (
          <div key={bundle.quantity} style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
            <strong style={{ width: 90 }}>{bundle.quantity} token{bundle.quantity > 1 ? "s" : ""}</strong>
            <label><input type="checkbox" checked={bundle.active} onChange={(e) => setBundle(index, { active: e.target.checked })} /> Active</label>
            <label>Position <input aria-label={`Position of ${bundle.quantity} token bundle`} inputMode="numeric" style={{ ...input, width: 60 }} value={bundle.order} onChange={(e) => setBundle(index, { order: e.target.value })} /></label>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Price table</H3>
        <Text mb="md">What each quantity costs with the values above, before saving. A gift shows the gift price; a promo code replaces the gift discount.</Text>
        {!valid ? <Text>Enter a valid base price, discount and quantities to see prices.</Text> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Tokens</th><th style={th}>List price</th><th style={th}>Quantity discount</th><th style={th}>Price</th><th style={th}>Price as a gift</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.quantity}>
                  <td style={td}>{row.quantity}{[1, 2, 5].includes(row.quantity) && <Badge>bundle</Badge>}</td>
                  <td style={td}>{pounds(row.list)}</td>
                  <td style={td}>{row.tier ? percent(row.tier.discount_bps) : "None"}</td>
                  <td style={td}><strong>{pounds(row.offer)}</strong></td>
                  <td style={td}>{pounds(row.gift)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button style={button("primary", busy || !valid)} disabled={busy || !valid}>Save prices</button>
    </form>
  );
};

// ---- promotions --------------------------------------------------------------------------------------

const STATUS = { scheduled: ["Scheduled", "gold"], active: ["Active", "green"], ended: ["Ended", ""], inactive: ["Inactive", ""], used_up: ["Used up", "red"] };
const localInput = (value) => {
  if (!value) return "";
  const d = toDate(value), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const iso = (local) => (local ? new Date(local).toISOString() : "");
const BLANK = { kind: "code", code: "", percent: "10", bundle: "1", startsAt: "", endsAt: "", max: "", perBuyer: "1" };

const PromoForm = ({ initial, editing, locked, busy, onSubmit, onCancel }) => {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const free = form.kind === "automatic_free";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {!editing && (
          <div style={{ width: 200 }}><Field label="Type"><select aria-label="Type" style={input} value={form.kind} onChange={set("kind")}><option value="code">Promo code</option><option value="automatic_free">Free campaign (automatic)</option></select></Field></div>
        )}
        {!free && <div style={{ width: 200 }}><Field label="Code" hint="Letters, digits, - and _. Saved in capitals."><input aria-label="Code" style={input} value={form.code} disabled={locked} onChange={set("code")} /></Field></div>}
        {!free && <div style={{ width: 120 }}><Field label="Discount (%)"><input aria-label="Discount percent" inputMode="decimal" style={input} value={form.percent} disabled={locked} onChange={set("percent")} /></Field></div>}
        {free && <div style={{ width: 160 }}><Field label="Discount"><input style={input} value="100% (free)" disabled readOnly /></Field></div>}
        <div style={{ width: 150 }}><Field label="Eligible bundle"><select aria-label="Eligible bundle" style={input} value={form.bundle} disabled={locked} onChange={set("bundle")}><option value="1">1 token</option><option value="2">2 tokens</option><option value="5">5 tokens</option></select></Field></div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 220 }}><Field label="Starts"><input aria-label="Starts" type="datetime-local" style={input} value={form.startsAt} onChange={set("startsAt")} /></Field></div>
        <div style={{ width: 220 }}><Field label="Ends"><input aria-label="Ends" type="datetime-local" style={input} value={form.endsAt} onChange={set("endsAt")} /></Field></div>
        <div style={{ width: 170 }}><Field label="Total uses (blank: no cap)"><input aria-label="Total uses" inputMode="numeric" style={input} value={form.max} onChange={set("max")} /></Field></div>
        <div style={{ width: 150 }}><Field label="Uses per buyer"><input aria-label="Uses per buyer" inputMode="numeric" style={input} value={form.perBuyer} onChange={set("perBuyer")} /></Field></div>
      </div>
      {locked && <Text mb="md">This promotion was already used, so its code, discount and bundle are fixed. Dates and limits can still change.</Text>}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={button("primary", busy)} disabled={busy}>{editing ? "Save changes" : free ? "Create free campaign" : "Create promo code"}</button>
        <button type="button" style={button("secondary")} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

const PromotionsView = ({ setNotice }) => {
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null); // null, "new" or a row
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const [data, fetchRows, error] = usePaged({ view: "promotions", status: status || undefined }, "The promotions could not be loaded.");
  const act = async (body, success) => { const done = await send(body, { success }); if (done) { setEditing(null); setConfirmDelete(null); fetchRows(); } return done; };
  const expiredMessage = "This promotion has ended. Edit its end date before activating it.";
  const cannotActivate = (row) => !row.isActive && toDate(row.endsAt).getTime() <= Date.now();
  const togglePromotion = (row) => {
    if (cannotActivate(row)) {
      setNotice({ kind: "danger", text: expiredMessage });
      return;
    }
    return act({ op: row.isActive ? "promo.deactivate" : "promo.activate", id: row.id }, row.isActive ? "Deactivated." : "Activated.");
  };
  const fields = (f) => ({ code: f.code, discountBps: toBps(f.percent), bundle: Number(f.bundle), startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), maximumRedemptions: f.max === "" ? null : Number(f.max), perBuyerLimit: Number(f.perBuyer) });
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select aria-label="Status" style={{ ...input, width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>{Object.entries(STATUS).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button style={button("primary")} onClick={() => setEditing(editing === "new" ? null : "new")}>New promotion</button>
      </div>
      {editing === "new" && <div style={{ ...card, background: colors.cream, marginBottom: 16 }}><PromoForm initial={BLANK} busy={busy} onCancel={() => setEditing(null)} onSubmit={(f) => act({ op: "promo.create", kind: f.kind, ...fields(f), ...(f.kind === "automatic_free" ? { code: undefined, discountBps: undefined } : {}) }, "Promotion created.")} /></div>}
      {error ? <Notice notice={error} /> : !data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Code</th><th style={th}>Discount</th><th style={th}>Bundle</th><th style={th}>Runs</th><th style={th}>Used</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>
              {data.rows.map((row) => {
                const [label, kind] = STATUS[row.status];
                const deletable = row.used === 0 && row.orders === 0;
                const activationBlocked = cannotActivate(row);
                return (
                  <React.Fragment key={row.id}>
                    <tr>
                      <td style={{ ...td, overflowWrap: "anywhere" }}>{row.trigger === "code" ? <strong>{row.code}</strong> : <em>Free campaign</em>}</td>
                      <td style={td}>{percent(row.discountBps)}</td>
                      <td style={td}>{row.bundle} token{row.bundle > 1 ? "s" : ""}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{when(row.startsAt)}<br />to {when(row.endsAt)}</td>
                      <td style={td}>{row.used} / {row.maximumRedemptions ?? "no cap"}<br /><span style={{ color: colors.muted, fontSize: 12 }}>{row.perBuyerLimit} per buyer</span></td>
                      <td style={td}><Badge kind={kind}>{label}</Badge></td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button style={button("secondary")} onClick={() => setEditing(editing?.id === row.id ? null : row)}>Edit</button>
                          <button style={{ ...button("secondary", busy || activationBlocked), whiteSpace: "nowrap" }} disabled={busy || activationBlocked}
                            title={activationBlocked ? expiredMessage : undefined} onClick={() => togglePromotion(row)}>{row.isActive ? "Deactivate" : "Activate"}</button>
                          {deletable ? <button style={button("danger", busy)} disabled={busy} onClick={() => setConfirmDelete(confirmDelete === row.id ? null : row.id)}>Delete</button> : <span style={{ color: colors.muted, fontSize: 12, alignSelf: "center" }}>Used: deactivate instead</span>}
                        </div>
                      </td>
                    </tr>
                    {confirmDelete === row.id && (
                      <tr><td style={td} colSpan={7}>Delete this promotion permanently? Nobody has used it. <button style={button("danger", busy)} disabled={busy} onClick={() => act({ op: "promo.delete", id: row.id }, "Promotion deleted.")}>Yes, delete</button> <button style={button("secondary")} onClick={() => setConfirmDelete(null)}>Keep</button></td></tr>
                    )}
                    {editing?.id === row.id && (
                      <tr><td style={td} colSpan={7}>
                        <PromoForm editing locked={row.used > 0 || row.orders > 0} busy={busy} onCancel={() => setEditing(null)}
                          initial={{ kind: row.trigger, code: row.code ?? "", percent: String(row.discountBps / 100), bundle: String(row.bundle), startsAt: localInput(row.startsAt), endsAt: localInput(row.endsAt), max: row.maximumRedemptions === null ? "" : String(row.maximumRedemptions), perBuyer: String(row.perBuyerLimit ?? 1) }}
                          onSubmit={(f) => act({ op: "promo.update", id: row.id, ...fields(f) }, "Promotion saved.")} />
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No promotions{status ? " with that status" : " yet"}.</Text>}
          <LoadMore cursor={data.nextCursor} onClick={fetchRows} />
        </>
      )}
    </div>
  );
};

// ---- orders ------------------------------------------------------------------------------------------

const STATE_LABELS = { pending: "Pending payment", paid: "Paid", not_required: "Free (no payment)", store_verified: "Store verified", cancelled: "Cancelled" };
const CHANNEL_LABELS = { paymob: "Website", apple_app_store: "App Store", google_play: "Google Play" };
const SETTLEMENT_LABELS = { payment: "Paid", zero_cost: "Zero-cost", native_store: "Store" };

const OrdersView = ({ navigate }) => {
  const [filters, setFilters] = useState({ status: "", settlement: "", channel: "", promo: "", from: "", to: "", phone: "" });
  const [phoneDraft, setPhoneDraft] = useState("");
  const params = { view: "orders" };
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params[key] = value.trim();
  const [data, fetchRows, error] = usePaged(params, "The orders could not be loaded.");
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const filtered = Object.values(filters).some(Boolean);
  return (
    <div style={card}>
      <form onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, phone: phoneDraft.trim() }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input aria-label="Buyer phone" placeholder="Buyer phone or last digits" style={{ ...input, width: 220 }} value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} />
        <button style={button("primary")}>Search</button>
        <select aria-label="Payment state" style={{ ...input, width: 170 }} value={filters.status} onChange={set("status")}><option value="">Any state</option>{Object.entries(STATE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="Settlement" style={{ ...input, width: 160 }} value={filters.settlement} onChange={set("settlement")}><option value="">Any settlement</option><option value="payment">Paid</option><option value="zero_cost">Zero-cost</option><option value="native_store">Store</option><option value="none">Not settled</option></select>
        <select aria-label="Channel" style={{ ...input, width: 140 }} value={filters.channel} onChange={set("channel")}><option value="">Web and native</option><option value="web">Website</option><option value="native">Native app</option></select>
        <input aria-label="Promotion ID" placeholder="Promotion ID" style={{ ...input, width: 150 }} value={filters.promo} onChange={set("promo")} />
        <label>From <input aria-label="From date" type="date" style={{ ...input, width: 150 }} value={filters.from} onChange={set("from")} /></label>
        <label>To <input aria-label="To date" type="date" style={{ ...input, width: 150 }} value={filters.to} onChange={set("to")} /></label>
        {filtered && <button type="button" style={button("secondary")} onClick={() => { setPhoneDraft(""); setFilters({ status: "", settlement: "", channel: "", promo: "", from: "", to: "", phone: "" }); }}>Clear filters</button>}
      </form>
      {error ? <Notice notice={error} /> : !data ? <Text>Loading…</Text> : !data.rows.length ? (
        <Text>{data.anyOrder ? "No orders match these filters." : "There are no orders yet."}</Text>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Created</th><th style={th}>Buyer</th><th style={th}>Type</th><th style={th}>Tokens</th><th style={th}>Total</th><th style={th}>State</th><th style={th}>Channel</th><th style={th}>Promo</th></tr></thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}><Link navigate={navigate} to={`${PAGE}?view=order&id=${row.id}`}>{when(row.createdAt)}</Link></td>
                  <td style={td}>{row.buyerPhone ?? "(deleted)"}</td>
                  <td style={{ ...td, textTransform: "capitalize" }}>{row.orderKind}</td>
                  <td style={td}>{row.tokenQuantity}</td>
                  <td style={td}>{row.totalMinor === null ? "Store price" : pounds(row.totalMinor)}</td>
                  <td style={td}>{STATE_LABELS[row.paymentState]}</td>
                  <td style={td}>{CHANNEL_LABELS[row.purchaseChannel] ?? row.purchaseChannel}</td>
                  <td style={{ ...td, overflowWrap: "anywhere" }}>{row.promoCode ?? (row.promoTrigger === "automatic_free" ? "Free campaign" : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <LoadMore cursor={data.nextCursor} onClick={fetchRows} />
        </>
      )}
    </div>
  );
};

const Fact = ({ label, children }) => <div><Text color="grey60">{label}</Text><strong>{children}</strong></div>;
const Account = ({ account, navigate }) => (account ? <Link navigate={navigate} to={`/admin/pages/players?view=account&id=${account.id}`}>{account.phone ?? account.displayName ?? "(deleted)"}</Link> : "Not bound yet");

const OrderView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  useEffect(() => { load({ view: "order", id }).then(setData).catch(() => setNotice({ kind: "danger", text: "That order could not be loaded." })); }, [id, setNotice]);
  if (!data) return <Text>Loading…</Text>;
  const { order, buyer, beneficiary, promotion } = data;
  const quoted = order.totalMinor !== null;
  return (
    <>
      <p><Link navigate={navigate} to={`${PAGE}?view=orders`}>← All orders</Link></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Order from {when(order.createdAt)}</H3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <Fact label="Buyer"><Account account={buyer} navigate={navigate} /></Fact>
          <Fact label={order.kind === "gift" ? "Gift recipient" : "Beneficiary"}>{order.kind === "gift" && !beneficiary ? `${order.recipientPhone ?? "(phone removed)"} (not claimed yet)` : <Account account={beneficiary} navigate={navigate} />}</Fact>
          <Fact label="Type"><span style={{ textTransform: "capitalize" }}>{order.kind}</span></Fact>
          <Fact label="Tokens">{order.tokenQuantity}</Fact>
          <Fact label="Channel">{CHANNEL_LABELS[order.channel] ?? order.channel}</Fact>
          <Fact label="Payment state">{STATE_LABELS[order.paymentState]}</Fact>
          <Fact label="Settlement">{order.settlementKind ? `${SETTLEMENT_LABELS[order.settlementKind]}, ${when(order.settledAt)}` : "Not settled"}</Fact>
        </div>
      </div>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Prices at the time of the order</H3>
        {!quoted ? <Text>Native store purchases carry no website price: the store charged its own price.</Text> : (
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={td}>Base price per token (pricing version {order.pricingVersion})</td><td style={td}>{pounds(order.baseUnitPriceMinor)}</td></tr>
              <tr><td style={td}>List price</td><td style={td}>{pounds(order.listSubtotalMinor)}</td></tr>
              <tr><td style={td}>Quantity discount {order.priceTierMinimumQuantity ? `(from ${order.priceTierMinimumQuantity} tokens, ${percent(order.quantityDiscountBps)})` : ""}</td><td style={td}>− {pounds(order.quantityDiscountMinor)}</td></tr>
              <tr><td style={td}>Price after quantity discount</td><td style={td}>{pounds(order.offerSubtotalMinor)}</td></tr>
              <tr><td style={td}>{order.additionalDiscountKind === "promo_code" ? `Promo ${promotion?.code ?? ""}` : order.additionalDiscountKind === "gift" ? "Gift discount" : "Additional discount"} {order.additionalDiscountBps ? `(${percent(order.additionalDiscountBps)})` : "(none)"}</td><td style={td}>− {pounds(order.additionalDiscountMinor)}</td></tr>
              {promotion && promotion.trigger === "automatic_free" && <tr><td style={td} colSpan={2}>Free campaign applied.</td></tr>}
              <tr><td style={td}><strong>Total</strong></td><td style={td}><strong>{pounds(order.totalMinor)}</strong></td></tr>
            </tbody>
          </table>
        )}
      </div>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3>Payment attempts</H3>
        {data.attempts.length === 0 ? <Text>No payment attempts{order.settlementKind === "zero_cost" ? ": a zero-cost order needs no payment" : ""}.</Text> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Started</th><th style={th}>Provider</th><th style={th}>Environment</th><th style={th}>State</th><th style={th}>Confirmed unpaid</th></tr></thead>
            <tbody>{data.attempts.map((a) => <tr key={a.id}><td style={td}>{when(a.createdAt)}</td><td style={td}>{a.provider}</td><td style={td}>{a.environment}</td><td style={td}>{a.state.replace(/_/g, " ")}</td><td style={td}>{a.confirmedUnpaidAt ? when(a.confirmedUnpaidAt) : ""}</td></tr>)}</tbody>
          </table>
        )}
        <H3 mt="lg">Payment events</H3>
        {data.events.length === 0 ? <Text>No payment events.</Text> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Received</th><th style={th}>Type</th><th style={th}>Outcome</th><th style={th}>State</th><th style={th}>Error</th></tr></thead>
            <tbody>{data.events.map((e) => <tr key={e.id}><td style={td}>{when(e.receivedAt)}</td><td style={td}>{e.notificationType ?? ""}</td><td style={td}>{e.outcome ?? e.nativeState ?? ""}</td><td style={td}>{e.state.replace(/_/g, " ")}</td><td style={td}>{e.lastErrorCode ?? ""}</td></tr>)}</tbody>
          </table>
        )}
        {data.cases.length > 0 && <Text mt="md">Reconciliation: {data.cases.map((c) => <span key={c.id}><Link navigate={navigate} to={`${PAGE}?view=review&id=${c.id}`}>{c.caseType.replace(/_/g, " ")} ({c.state})</Link> </span>)}</Text>}
      </div>
    </>
  );
};

// ---- payment reviews ---------------------------------------------------------------------------------

const ReviewsView = ({ navigate }) => {
  // The Home queue links here with &state=open.
  const [state, setState] = useState(new URLSearchParams(useLocation().search).get("state") === "resolved" ? "resolved" : "open");
  const [data, fetchRows, error] = usePaged({ view: "reviews", state }, "The payment reviews could not be loaded.");
  return (
    <div style={card}>
      <Text mb="md">Cases the payment system could not settle by itself. Marking one reviewed records that you checked it and handled it outside this tool; it moves no money. Refunds are made in Paymob, the App Store or Google Play.</Text>
      <div style={{ marginBottom: 12 }}>
        <select aria-label="Case state" style={{ ...input, width: 180 }} value={state} onChange={(e) => setState(e.target.value)}><option value="open">Open (oldest first)</option><option value="resolved">Reviewed</option></select>
      </div>
      {error ? <Notice notice={error} /> : !data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Opened</th><th style={th}>Case</th><th style={th}>State</th><th style={th}>Reviewed</th></tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.id}><td style={td}><Link navigate={navigate} to={`${PAGE}?view=review&id=${row.id}`}>{when(row.openedAt)}</Link></td><td style={{ ...td, textTransform: "capitalize" }}>{row.caseType.replace(/_/g, " ")}</td><td style={td}>{row.state === "open" ? <Badge kind="gold">Open</Badge> : <Badge kind="green">Reviewed</Badge>}</td><td style={td}>{row.resolvedAt ? when(row.resolvedAt) : ""}</td></tr>)}</tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">{state === "open" ? "No payment cases are waiting for review." : "No case has been reviewed yet."}</Text>}
          <LoadMore cursor={data.nextCursor} onClick={fetchRows} />
        </>
      )}
    </div>
  );
};

const ReviewView = ({ id, navigate, setNotice }) => {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const { send, busy } = useSend(setNotice, PAGE_NAME);
  const fetchCase = useCallback(() => load({ view: "review", id }).then(setData).catch(() => setNotice({ kind: "danger", text: "That case could not be loaded." })), [id, setNotice]);
  useEffect(() => { fetchCase(); }, [fetchCase]);
  if (!data) return <Text>Loading…</Text>;
  const { review, order, event, purchase, resolution } = data;
  return (
    <>
      <p><Link navigate={navigate} to={`${PAGE}?view=reviews`}>← All payment reviews</Link></p>
      <div style={{ ...card, marginBottom: 20 }}>
        <H3 style={{ textTransform: "capitalize" }}>{review.caseType.replace(/_/g, " ")} {review.state === "open" ? <Badge kind="gold">Open</Badge> : <Badge kind="green">Reviewed</Badge>}</H3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          <Fact label="Opened">{when(review.openedAt)}</Fact>
          {order && <Fact label="Order"><Link navigate={navigate} to={`${PAGE}?view=order&id=${order.id}`}>{order.buyerPhone ?? "order"}, {order.quantity} token{order.quantity > 1 ? "s" : ""}{order.totalMinor !== null ? `, ${pounds(order.totalMinor)}` : ""}</Link></Fact>}
          {event && <Fact label="Payment event">{event.notificationType ?? "event"}, {event.outcome ?? ""} ({event.state.replace(/_/g, " ")})</Fact>}
          {purchase && <Fact label="Store purchase">{purchase.provider}, {purchase.state}</Fact>}
        </div>
        <Text mt="md" color="grey60">Evidence recorded with the case</Text>
        <pre style={{ background: colors.cream, padding: 12, borderRadius: 6, overflow: "auto", maxHeight: 280 }}>{JSON.stringify(review.details, null, 2)}</pre>
      </div>
      {review.state === "open" ? (
        <div style={card}>
          <H3>Mark reviewed</H3>
          <Text mb="md">Write what you checked and what was done, for example the refund reference in Paymob. The note is kept in the audit log. This does not refund or change the order.</Text>
          <form onSubmit={async (e) => { e.preventDefault(); const done = await send({ op: "review.resolve", id, note }, { success: "Marked as reviewed." }); if (done) fetchCase(); }}>
            <Field label="Note (required)"><textarea aria-label="Note" style={{ ...input, minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <button style={button("primary", busy)} disabled={busy}>Mark reviewed</button>
          </form>
        </div>
      ) : resolution && <div style={card}><Text>Reviewed {when(resolution.createdAt)} by {resolution.staffEmail}: {resolution.reason}</Text></div>}
    </>
  );
};

// ---- store products ----------------------------------------------------------------------------------

const ProductsView = ({ setNotice }) => {
  const [data, setData] = useState(null);
  useEffect(() => { load({ view: "products" }).then(setData).catch(() => setNotice({ kind: "danger", text: "The store products could not be loaded." })); }, [setNotice]);
  return (
    <div style={card}>
      <Text mb="md">Which App Store and Google Play products give which token bundle. Read-only: the mapping is set up with the store listing.</Text>
      {!data ? <Text>Loading…</Text> : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Store</th><th style={th}>Product id</th><th style={th}>App</th><th style={th}>Tokens</th><th style={th}>Target price</th><th style={th}>Status</th></tr></thead>
            <tbody>{data.rows.map((p) => <tr key={p.id}><td style={td}>{CHANNEL_LABELS[p.provider] ?? p.provider}</td><td style={td}>{p.providerProductId}</td><td style={td}>{p.applicationId}</td><td style={td}>{p.tokenQuantity}</td><td style={td}>{p.targetEgpPriceMinor === null ? "Set by the store" : pounds(p.targetEgpPriceMinor)}</td><td style={td}>{p.isActive ? <Badge kind="green">Active</Badge> : <Badge>Inactive</Badge>}</td></tr>)}</tbody>
          </table>
          {data.rows.length === 0 && <Text mt="md">No store products are set up yet.</Text>}
        </>
      )}
    </div>
  );
};

const ShopPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const params = new URLSearchParams(location.search);
  const view = params.get("view") ?? "pricing";
  useEffect(() => setNotice(null), [location.search]);
  const body = view === "promotions" ? <PromotionsView setNotice={setNotice} />
    : view === "orders" ? <OrdersView navigate={navigate} />
    : view === "order" ? <OrderView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} />
    : view === "reviews" ? <ReviewsView key={location.search} navigate={navigate} />
    : view === "review" ? <ReviewView key={params.get("id")} id={params.get("id")} navigate={navigate} setNotice={setNotice} />
    : view === "products" ? <ProductsView setNotice={setNotice} />
    : <PricingView setNotice={setNotice} />;
  return (
    <Box variant="white">
      <H3>Shop</H3>
      <Tabs view={view} navigate={navigate} />
      <Notice notice={notice} />
      {body}
    </Box>
  );
};

export default ShopPage;
