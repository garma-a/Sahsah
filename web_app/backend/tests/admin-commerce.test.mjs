import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { createAdminApplication } from "../dist/admin/app.js";
import { hashPassword } from "../dist/admin/passwords.js";
import { gameplayFixture } from "./gameplay/fixture.mjs";

const SECRET = "test-only-session-secret-with-at-least-32-characters";
const ADMIN = { email: "admin@example.test", password: "admin-password-123" };
const SUPER = { email: "super@example.test", password: "super-password-123" };

async function startAdmin(t, databaseUrl) {
  const admin = await createAdminApplication({ NODE_ENV: "test", DATABASE_URL: databaseUrl, ADMIN_SESSION_SECRET: SECRET, ADMIN_LOGIN_ATTEMPTS_PER_MINUTE: "1000", ADMIN_BOOTSTRAP_EMAIL: SUPER.email, ADMIN_BOOTSTRAP_PASSWORD: SUPER.password });
  const server = admin.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await admin.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function signIn(base, { email, password }) {
  const response = await fetch(`${base}/admin/login`, { method: "POST", body: new URLSearchParams({ email, password }), redirect: "manual" });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const read = async (query = "") => {
    const r = await fetch(`${base}/admin/api/pages/shop${query}`, { headers: { Cookie: cookie } });
    return { status: r.status, ...(await r.json()) };
  };
  const post = async (body, requestKey = randomUUID()) => {
    const r = await fetch(`${base}/admin/api/pages/shop`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey, ...body }) });
    return { status: r.status, body: await r.json() };
  };
  return { read, post };
}

const DAY = 86400000;
const when = (days) => new Date(Date.now() + days * DAY).toISOString();
const bundles = (order = [0, 1, 2], active = [true, true, true]) => [1, 2, 5].map((quantity, i) => ({ quantity, is_active: active[i], display_order: order[i] }));

test("shop: pricing, promotions, orders, payment reviews and store products", { timeout: 240000 }, async (t) => {
  const f = await gameplayFixture(t, { hosts: 3, tokens: 1 });
  const o = f.owner;
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin',$2,$3)", [randomUUID(), ADMIN.email, await hashPassword(ADMIN.password)]);
  await o.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'super_admin',$2,$3)", [randomUUID(), SUPER.email, await hashPassword(SUPER.password)]);
  const base = await startAdmin(t, f.pg.url("sahsah_app", "sahsah_gameplay_races"));
  const admin = await signIn(base, ADMIN);
  const superAdmin = await signIn(base, SUPER);
  assert.equal((await fetch(`${base}/admin/api/pages/shop`, { redirect: "manual" })).status === 200, false, "anonymous visitors are turned away");
  const audit = async (action) => (await o.query("SELECT * FROM staff_audit_events WHERE action_code=$1 ORDER BY created_at", [action])).rows;

  // ---- pricing ------------------------------------------------------------------------------
  let pricing = await admin.read("");
  assert.equal(pricing.configured, false);
  assert.equal(pricing.version, "0");
  const save = (over = {}, key) => admin.post({ op: "pricing.save", expectedVersion: pricing.version, baseUnitPriceMinor: 10000, giftDiscountBps: 1000, tiers: [{ minimum_quantity: 2, discount_bps: 500, is_active: true }, { minimum_quantity: 5, discount_bps: 1500, is_active: true }], bundles: bundles(), ...over }, key);
  let saved = await save();
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.version, "1");
  pricing = await admin.read("");
  assert.equal(pricing.configured, true);
  assert.equal(pricing.tiers.length, 2);
  assert.equal(pricing.version, "1");

  // Stale version, retried request, and no-op are refused truthfully.
  assert.equal((await save({ baseUnitPriceMinor: 12000, expectedVersion: "0" })).body.error, "stale_pricing");
  assert.equal((await save({ expectedVersion: "1" })).body.error, "no_change");
  const key = randomUUID();
  saved = await save({ baseUnitPriceMinor: 12000, giftDiscountBps: 2000, bundles: bundles([2, 1, 0], [true, true, false]) }, key);
  assert.equal(saved.body.version, "2");
  assert.equal((await save({ baseUnitPriceMinor: 12000, giftDiscountBps: 2000, bundles: bundles([2, 1, 0], [true, true, false]) }, key)).body.replayed, true);
  pricing = await admin.read("");
  assert.equal(pricing.version, "2", "a replay does not bump the version twice");
  assert.equal(pricing.baseUnitPriceMinor, 12000);
  assert.equal((await save({ baseUnitPriceMinor: 13000, expectedVersion: "1" })).body.error, "stale_pricing", "a save based on the old version is refused");
  assert.equal((await admin.read("")).baseUnitPriceMinor, 12000);
  const events = await audit("pricing.update");
  assert.equal(events.length, 2);
  assert.equal(events[1].details.before.baseUnitPriceMinor, 10000);
  assert.equal(events[1].details.after.baseUnitPriceMinor, 12000);
  assert.equal(events[1].details.after.pricingVersion, "2");
  assert.equal(events[1].details.before.pricingVersion, "1");

  // Validation.
  const tier = (minimum_quantity, discount_bps = 100, is_active = true) => ({ minimum_quantity, discount_bps, is_active });
  const bad = async (over, error) => assert.equal((await save({ expectedVersion: "2", ...over })).body.error, error);
  await bad({ tiers: [tier(5), tier(2)] }, "tiers_not_ascending");
  await bad({ tiers: [tier(2), tier(2)] }, "tiers_not_ascending");
  await bad({ tiers: [tier(0)] }, "tier_quantity_invalid");
  await bad({ tiers: [tier(21)] }, "tier_quantity_invalid");
  await bad({ tiers: [tier(2, 10001)] }, "tier_discount_invalid");
  await bad({ tiers: Array.from({ length: 21 }, (_, i) => tier(i + 1)) }, "tiers_too_many");
  await bad({ baseUnitPriceMinor: 0 }, "price_invalid");
  await bad({ giftDiscountBps: 10001 }, "gift_discount_invalid");
  await bad({ bundles: bundles([0, 0, 1]) }, "bundle_order_invalid");
  await bad({ bundles: bundles().slice(0, 2) }, "bundles_invalid");
  assert.equal((await save({ expectedVersion: "2", tiers: Array.from({ length: 20 }, (_, i) => tier(i + 1)) })).status, 200, "twenty tiers are allowed");
  assert.equal((await audit("pricing.update")).length, 3, "refusals leave no audit event");

  // ---- promotions ---------------------------------------------------------------------------
  const promo = (over = {}) => ({ op: "promo.create", kind: "code", code: " summer-10 ", discountBps: 1000, bundle: 2, startsAt: when(-1), endsAt: when(30), maximumRedemptions: 5, perBuyerLimit: 1, ...over });
  const created = await admin.post(promo());
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const promoId = created.body.id;
  const stored = (await o.query("SELECT * FROM promotions WHERE id=$1", [promoId])).rows[0];
  assert.equal(stored.code, "SUMMER-10", "code is normalized");
  assert.equal(stored.eligible_bundle_quantity, 2);
  assert.equal((await admin.post(promo({ code: "summer-10" }))).body.error, "code_taken");
  assert.equal((await admin.post(promo({ code: "x" }))).body.error, "code_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", discountBps: 0 }))).body.error, "discount_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", discountBps: 10001 }))).body.error, "discount_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", bundle: 3 }))).body.error, "bundle_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", endsAt: when(-2) }))).body.error, "window_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", startsAt: when(-5), endsAt: when(-2) }))).body.error, "ends_in_past");
  assert.equal((await admin.post(promo({ code: "OK1", maximumRedemptions: 0 }))).body.error, "limit_invalid");
  assert.equal((await admin.post(promo({ code: "OK1", startsAt: "nonsense" }))).body.error, "dates_invalid");
  assert.equal((await audit("promo.create")).length, 1);

  // Free campaign: always 100%, no code.
  const free = await admin.post({ op: "promo.create", kind: "automatic_free", code: "IGNORED", discountBps: 500, bundle: 5, startsAt: when(7), endsAt: when(14), maximumRedemptions: 10 });
  assert.equal(free.status, 200, JSON.stringify(free.body));
  const campaign = (await o.query("SELECT * FROM promotions WHERE id=$1", [free.body.id])).rows[0];
  assert.equal(campaign.trigger, "automatic_free");
  assert.equal(campaign.code, null);
  assert.equal(campaign.discount_bps, 10000);
  assert.equal(campaign.per_buyer_limit, 1);
  await assert.rejects(o.query("UPDATE promotions SET code='X1' WHERE id=$1", [free.body.id]), /promotions_trigger_shape/);

  // List, status and filter.
  let list = await admin.read("?view=promotions");
  assert.equal(list.rows.length, 2);
  const byId = Object.fromEntries(list.rows.map((r) => [r.id, r]));
  assert.equal(byId[promoId].status, "active");
  assert.equal(byId[free.body.id].status, "scheduled");
  assert.equal((await admin.read("?view=promotions&status=scheduled")).rows.length, 1);
  assert.equal((await admin.read("?view=promotions&status=bogus")).error, "invalid_filter");

  // Keyset paging over 28 more promotions.
  for (let n = 0; n < 28; n++) await o.query("INSERT INTO promotions(id,trigger,code,discount_bps,eligible_bundle_quantity,starts_at,ends_at) VALUES($1,'code',$2,1000,1,now()-interval '3 days'-($3 || ' minutes')::interval,now()+interval '1 day')", [randomUUID(), `BULK${n}`, String(n)]);
  const first = await admin.read("?view=promotions");
  assert.equal(first.rows.length, 25);
  const second = await admin.read(`?view=promotions&cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.equal(second.rows.length, 5);
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 30);
  assert.equal((await admin.read("?view=promotions&cursor=junk")).error, "invalid_cursor");

  // Deactivate and activate.
  assert.equal((await admin.post({ op: "promo.deactivate", id: promoId })).status, 200);
  assert.equal((await admin.read("?view=promotions&status=inactive")).rows.length, 1);
  assert.equal((await admin.post({ op: "promo.deactivate", id: promoId })).body.error, "no_change");
  assert.equal((await admin.post({ op: "promo.activate", id: promoId })).status, 200);
  assert.equal((await audit("promo.deactivate")).length, 1);

  // Update.
  const update = (over = {}) => admin.post({ op: "promo.update", id: promoId, code: "SUMMER-10", discountBps: 1500, bundle: 2, startsAt: when(-1), endsAt: when(40), maximumRedemptions: 8, perBuyerLimit: 2, ...over });
  assert.equal((await update()).status, 200);
  const edited = (await o.query("SELECT * FROM promotions WHERE id=$1", [promoId])).rows[0];
  assert.equal(edited.discount_bps, 1500);
  assert.equal(edited.per_buyer_limit, 2);
  assert.equal((await audit("promo.update")).length, 1);
  assert.equal((await update({ code: "bulk1" })).body.error, "code_taken");

  // ---- orders -------------------------------------------------------------------------------
  assert.equal((await admin.read("?view=orders")).anyOrder, false);
  assert.equal((await admin.read("?view=orders")).rows.length, 0);
  const [a0, a1, a2] = f.accounts;
  const phoneOf = async (id) => (await o.query("SELECT phone_e164 FROM accounts WHERE id=$1", [id])).rows[0].phone_e164;
  const order = async ({ buyer, quantity = 1, total = 10000, daysAgo = 0, promoId: promotionId, state = "pending", channel = "paymob" }) => {
    const id = randomUUID(), list = quantity * 10000, discount = list - total;
    await o.query(
      `INSERT INTO token_orders(id,buyer_account_id,order_kind,beneficiary_account_id,token_quantity,currency,pricing_version,base_unit_price_minor,quantity_discount_bps,list_subtotal_minor,quantity_discount_minor,offer_subtotal_minor,additional_discount_kind,additional_discount_bps,additional_discount_minor,total_minor,payment_state,idempotency_key,request_digest,created_at,purchase_channel,applied_promotion_id,applied_promotion_trigger)
       VALUES($1,$2,'personal',$2,$3,'EGP',1,10000,0,$4,0,$4,$5,$6,$7,$8,'pending',$9,$10,now()-($11||' days')::interval,$12,$13,$14)`,
      [id, buyer, quantity, list, promotionId ? "promo_code" : "none", promotionId ? Math.round((discount * 10000) / list) : 0, discount, total, randomUUID(), randomBytes(32), String(daysAgo), channel, promotionId ?? null, promotionId ? "code" : null],
    );
    if (promotionId) await o.query("INSERT INTO promo_usages(order_id,promotion_id,buyer_account_id,state,buyer_phone_fingerprint,phone_fingerprint_key_version) VALUES($1,$2,$3,'held',$4,1)", [id, promotionId, buyer, randomBytes(32)]);
    return id;
  };
  const ids = [];
  ids.push(await order({ buyer: a0, quantity: 1, daysAgo: 10 }));
  ids.push(await order({ buyer: a1, quantity: 2, total: 18000, daysAgo: 5, promoId }));
  for (let n = 0; n < 26; n++) ids.push(await order({ buyer: a2, quantity: 1, daysAgo: 1 }));
  let orders = await admin.read("?view=orders");
  assert.equal(orders.anyOrder, true);
  assert.equal(orders.rows.length, 25);
  const rest = await admin.read(`?view=orders&cursor=${encodeURIComponent(orders.nextCursor)}`);
  assert.equal(rest.rows.length, 3);
  assert.equal(new Set([...orders.rows, ...rest.rows].map((r) => r.id)).size, 28, "no order repeats or is skipped across pages");
  assert.equal((await admin.read(`?view=orders&phone=${encodeURIComponent(await phoneOf(a1))}`)).rows.map((r) => r.id).join(), ids[1]);
  assert.equal((await admin.read(`?view=orders&promo=${promoId}`)).rows.length, 1);
  assert.equal((await admin.read("?view=orders&status=paid")).rows.length, 0);
  assert.equal((await admin.read("?view=orders&status=pending")).rows.length, 25);
  assert.equal((await admin.read("?view=orders&channel=native")).rows.length, 0);
  assert.equal((await admin.read("?view=orders&settlement=none&channel=web")).nextCursor !== null, true);
  const day = (days) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  assert.deepEqual((await admin.read(`?view=orders&from=${day(6)}&to=${day(4)}`)).rows.map((r) => r.id), [ids[1]]);
  assert.equal((await admin.read("?view=orders&from=junk")).error, "invalid_filter");
  assert.equal((await admin.read("?view=orders&phone=12")).error, "invalid_search");
  assert.equal((await admin.read("?view=orders&status=bogus")).error, "invalid_filter");

  const detail = await admin.read(`?view=order&id=${ids[1]}`);
  assert.equal(detail.order.totalMinor, 18000);
  assert.equal(detail.order.listSubtotalMinor, 20000);
  assert.equal(detail.buyer.id, a1);
  assert.equal(detail.promotion.code, "SUMMER-10");
  assert.deepEqual(detail.attempts, []);
  assert.equal((await admin.read(`?view=order&id=${randomUUID()}`)).error, "not_found");

  // ---- promotion delete rule ----------------------------------------------------------------
  assert.equal((await admin.post({ op: "promo.delete", id: promoId })).body.error, "promo_used", "a used promotion cannot be deleted");
  assert.equal((await update({ discountBps: 2000 })).body.error, "promo_in_use", "its code and discount are fixed once used");
  assert.equal((await update({ endsAt: when(60) })).status, 200, "dates still change");
  assert.equal((await o.query("SELECT 1 FROM promotions WHERE id=$1", [promoId])).rowCount, 1);
  assert.equal((await admin.post({ op: "promo.deactivate", id: promoId })).status, 200, "deactivate instead");
  const orderOnly = (await admin.post(promo({ code: "ORDERED", bundle: 1 }))).body.id;
  const lone = await order({ buyer: a0, quantity: 1, total: 9000, promoId: orderOnly });
  await o.query("DELETE FROM promo_usages WHERE order_id=$1", [lone]);
  assert.equal((await admin.post({ op: "promo.delete", id: orderOnly })).body.error, "promo_used", "an order alone also blocks deletion");
  const unused = (await admin.post(promo({ code: "UNUSED" }))).body.id;
  const gone = await admin.post({ op: "promo.delete", id: unused });
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal((await o.query("SELECT 1 FROM promotions WHERE id=$1", [unused])).rowCount, 0);
  const deleted = await audit("promo.delete");
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].details.code, "UNUSED");
  assert.equal((await admin.post({ op: "promo.delete", id: unused })).body.error, "not_found");

  // ---- payment reviews ----------------------------------------------------------------------
  const caseId = randomUUID();
  await o.query("INSERT INTO payment_reconciliation_cases(id,case_key,case_type,order_id,details,opened_at) VALUES($1,$2,'late_payment',$3,'{\"note\":\"duplicate payment\"}',now()-interval '2 days')", [caseId, `case-${caseId}`, ids[0]]);
  const newer = randomUUID();
  await o.query("INSERT INTO payment_reconciliation_cases(id,case_key,case_type,order_id,opened_at) VALUES($1,$2,'unknown_outcome',$3,now())", [newer, `case-${newer}`, ids[0]]);
  let reviews = await admin.read("?view=reviews");
  assert.deepEqual(reviews.rows.map((r) => r.id), [caseId, newer], "oldest open case first");
  assert.equal((await admin.read(`?view=review&id=${caseId}`)).review.details.note, "duplicate payment");
  assert.equal((await admin.post({ op: "review.resolve", id: caseId, note: "  " })).body.error, "note_required");
  const resolveKey = randomUUID();
  const resolved = await admin.post({ op: "review.resolve", id: caseId, note: "Refunded in Paymob, ref 123" }, resolveKey);
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.equal((await admin.post({ op: "review.resolve", id: caseId, note: "Refunded in Paymob, ref 123" }, resolveKey)).body.replayed, true);
  assert.equal((await admin.post({ op: "review.resolve", id: caseId, note: "again" })).body.error, "already_resolved");
  const row = (await o.query("SELECT * FROM payment_reconciliation_cases WHERE id=$1", [caseId])).rows[0];
  assert.equal(row.state, "resolved");
  const reviewEvents = await audit("payment_case.review");
  assert.equal(reviewEvents.length, 1);
  assert.equal(reviewEvents[0].id, row.resolution_audit_event_id);
  assert.equal(reviewEvents[0].reason, "Refunded in Paymob, ref 123");
  reviews = await admin.read("?view=reviews");
  assert.deepEqual(reviews.rows.map((r) => r.id), [newer]);
  assert.deepEqual((await admin.read("?view=reviews&state=resolved")).rows.map((r) => r.id), [caseId]);
  const seen = await admin.read(`?view=review&id=${caseId}`);
  assert.equal(seen.resolution.reason, "Refunded in Paymob, ref 123");
  assert.equal((await o.query("SELECT payment_state FROM token_orders WHERE id=$1", [ids[0]])).rows[0].payment_state, "pending", "reviewing moves no order state");

  // ---- store products -----------------------------------------------------------------------
  assert.deepEqual((await admin.read("?view=products")).rows, []);
  await o.query("INSERT INTO store_products(id,provider,application_id,provider_product_id,token_quantity,updated_by_staff_id,created_at,updated_at) SELECT $1,'google_play','app.sahsah','tokens_2',2,id,now(),now() FROM staff_accounts LIMIT 1", [randomUUID()]);
  const products = await admin.read("?view=products");
  assert.equal(products.rows.length, 1);
  assert.equal(products.rows[0].providerProductId, "tokens_2");

  // ---- roles --------------------------------------------------------------------------------
  assert.equal((await superAdmin.read("")).version, "3", "Super Admin reads the same shop");
  assert.equal((await superAdmin.post({ op: "promo.deactivate", id: free.body.id })).status, 200);
  assert.equal((await admin.post({ op: "nonsense" })).body.error, "unknown_operation");
});
