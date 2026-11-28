import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DatabaseConnection, SahsahDatabase } from "../../database/connection.js";
import { accounts, paymentAttempts, paymentEvents, paymentReconciliationCases, promotions, shopSettings, staffAccounts, staffAuditEvents, storeProducts, storePurchases, tokenOrders } from "../../database/schema/index.js";
import type { JsonObject, QuantityTier, ShopBundle } from "../../database/schema/types.js";
import { applyOnce, recordAudit } from "../audit.js";
import { normalizePhone } from "../players/phones.js";
import { StaffError } from "../staff-service.js";

export class CommerceError extends StaffError {}

type Actor = { actorId: string; requestKey: string };
const UUID = /^[0-9a-f-]{36}$/;
export const PAGE_SIZE = 25;
export const MAX_TIERS = 20;
export const MAX_TOKEN_QUANTITY = 20;
const BUNDLE_QUANTITIES = [1, 2, 5] as const;
const MAX_PRICE_MINOR = 100_000_00; // 100,000 EGP per token is far beyond any sane price
const ORDER_STATES = ["pending", "paid", "not_required", "store_verified", "cancelled"] as const;
const SETTLEMENTS = ["payment", "zero_cost", "native_store", "none"] as const;
const PROMO_STATUSES = ["scheduled", "active", "ended", "inactive", "used_up"] as const;
const DEFAULT_BUNDLES: ShopBundle[] = [
  { quantity: 1, is_active: true, display_order: 0 },
  { quantity: 2, is_active: true, display_order: 1 },
  { quantity: 5, is_active: true, display_order: 2 },
];

const id = (value: unknown) => {
  if (typeof value !== "string" || !UUID.test(value)) throw new CommerceError("not_found", 404);
  return value;
};
const wholeNumber = (value: unknown) => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : undefined;
};
const noteOf = (value: unknown, code: string) => {
  const note = typeof value === "string" ? value.trim() : "";
  if (!note) throw new CommerceError(code);
  if (note.length > 1000) throw new CommerceError(`${code}_too_long`);
  return note;
};
const money = (value: bigint | null) => (value === null ? null : Number(value));

const CURSOR = /^(\d{4}-\d\d-\d\d[ T][0-9:.]+(?:Z|[+-]\d\d(?::?\d\d)?)?)\|([0-9a-f-]{36})$/;
/** Keyset cursor on (timestamp, id): the timestamp is the database's own text, never a Date. */
function cursorOf(value: unknown): [string, string] | undefined {
  if (value === undefined || value === "") return undefined;
  const match = typeof value === "string" ? CURSOR.exec(value) : null;
  if (!match) throw new CommerceError("invalid_cursor");
  return [match[1]!, match[2]!];
}
const nextCursor = <T extends { id: string }>(rows: T[], stamp: (row: T) => string) => {
  const last = rows[PAGE_SIZE - 1];
  return rows.length > PAGE_SIZE && last ? `${stamp(last)}|${last.id}` : null;
};

function errorSource(error: unknown) {
  return ((error as { cause?: unknown })?.cause ?? error) as { code?: string; constraint?: string };
}

// ---- pricing validation -------------------------------------------------------------------------

const normalizeTiers = (tiers: QuantityTier[]): QuantityTier[] => tiers.map((t) => ({ minimum_quantity: t.minimum_quantity, discount_bps: t.discount_bps, is_active: t.is_active }));
const normalizeBundles = (bundles: ShopBundle[]): ShopBundle[] => bundles.map((b) => ({ quantity: b.quantity, is_active: b.is_active, display_order: b.display_order }));

function parseTiers(input: unknown): QuantityTier[] {
  if (!Array.isArray(input)) throw new CommerceError("tiers_invalid");
  if (input.length > MAX_TIERS) throw new CommerceError("tiers_too_many");
  let previous = 0;
  return input.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const minimum = wholeNumber(row.minimum_quantity), bps = wholeNumber(row.discount_bps);
    if (minimum === undefined || minimum < 1 || minimum > MAX_TOKEN_QUANTITY) throw new CommerceError("tier_quantity_invalid");
    if (bps === undefined || bps < 0 || bps > 10000) throw new CommerceError("tier_discount_invalid");
    if (typeof row.is_active !== "boolean") throw new CommerceError("tiers_invalid");
    if (minimum <= previous) throw new CommerceError("tiers_not_ascending");
    previous = minimum;
    return { minimum_quantity: minimum, discount_bps: bps, is_active: row.is_active };
  });
}

function parseBundles(input: unknown): ShopBundle[] {
  if (!Array.isArray(input) || input.length !== BUNDLE_QUANTITIES.length) throw new CommerceError("bundles_invalid");
  const byQuantity = new Map<number, ShopBundle>();
  for (const raw of input) {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const quantity = wholeNumber(row.quantity), order = wholeNumber(row.display_order);
    if (quantity === undefined || !BUNDLE_QUANTITIES.includes(quantity as 1 | 2 | 5) || byQuantity.has(quantity) || typeof row.is_active !== "boolean") throw new CommerceError("bundles_invalid");
    if (order === undefined) throw new CommerceError("bundle_order_invalid");
    byQuantity.set(quantity, { quantity: quantity as 1 | 2 | 5, is_active: row.is_active, display_order: order });
  }
  const bundles = BUNDLE_QUANTITIES.map((q) => byQuantity.get(q)!);
  // The three display positions are exactly 0, 1 and 2, each used once.
  if (new Set(bundles.map((b) => b.display_order)).size !== 3 || bundles.some((b) => b.display_order < 0 || b.display_order > 2)) throw new CommerceError("bundle_order_invalid");
  return bundles;
}

// ---- promotion validation -------------------------------------------------------------------------

const CODE = /^[A-Z0-9_-]{3,32}$/;
export const normalizeCode = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase() : "");

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) throw new CommerceError("dates_invalid");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new CommerceError("dates_invalid");
  return date;
}
function parseWindow(startsAt: unknown, endsAt: unknown) {
  const starts = parseDate(startsAt), ends = parseDate(endsAt);
  if (ends <= starts) throw new CommerceError("window_invalid");
  return { starts, ends };
}
function parseLimit(value: unknown, code: string, { optional }: { optional: boolean }) {
  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    throw new CommerceError(code);
  }
  const n = wholeNumber(value);
  if (n === undefined || n < 1 || n > 1_000_000) throw new CommerceError(code);
  return n;
}
const parseBundle = (value: unknown) => {
  const n = wholeNumber(value);
  if (n === undefined || !BUNDLE_QUANTITIES.includes(n as 1 | 2 | 5)) throw new CommerceError("bundle_invalid");
  return n;
};
function parseDiscount(value: unknown) {
  const bps = wholeNumber(value);
  if (bps === undefined || bps < 100 || bps > 10000) throw new CommerceError("discount_invalid");
  return bps;
}

// Written out with names: Drizzle drops the table name from columns inside a single-table query.
const usedCount = sql`(SELECT count(*) FROM promo_usages u WHERE u.promotion_id = "promotions"."id" AND u.state IN ('held','consumed'))`;
const orderCount = sql`(SELECT count(*) FROM token_orders o WHERE o.applied_promotion_id = "promotions"."id")`;
const statusOf = sql`CASE
  WHEN NOT "promotions"."is_active" THEN 'inactive'
  WHEN "promotions"."ends_at" <= now() THEN 'ended'
  WHEN "promotions"."maximum_redemptions" IS NOT NULL AND ${usedCount} >= "promotions"."maximum_redemptions" THEN 'used_up'
  WHEN "promotions"."starts_at" > now() THEN 'scheduled'
  ELSE 'active' END`;

type PromoFields = { code: string | null; discountBps: number; bundle: number; startsAt: string; endsAt: string; maximumRedemptions: number | null; perBuyerLimit: number | null };
const promoDetails = (p: PromoFields & { trigger?: string; isActive?: boolean }): JsonObject => ({
  ...(p.trigger ? { trigger: p.trigger } : {}),
  code: p.code,
  discountBps: p.discountBps,
  bundle: p.bundle,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
  maximumRedemptions: p.maximumRedemptions,
  perBuyerLimit: p.perBuyerLimit,
  ...(p.isActive === undefined ? {} : { isActive: p.isActive }),
});
const iso = (stamp: string) => new Date(stamp.replace(" ", "T").replace(/\+00$/, "Z")).toISOString();

export class CommerceService {
  constructor(private readonly database: DatabaseConnection) {}

  private get db(): SahsahDatabase {
    return this.database.db;
  }

  // ---- pricing ------------------------------------------------------------------------------------

  async pricing() {
    const [row] = await this.db.select().from(shopSettings).where(eq(shopSettings.id, 1)).limit(1);
    if (!row) {
      // Nothing has been saved yet; the first save creates the row at version 1.
      return { configured: false, version: "0", baseUnitPriceMinor: 10000, giftDiscountBps: 1000, tiers: [] as QuantityTier[], bundles: DEFAULT_BUNDLES, updatedAt: null };
    }
    return { configured: true, version: String(row.pricingVersion), baseUnitPriceMinor: Number(row.baseUnitPriceMinor), giftDiscountBps: row.giftDiscountBps, tiers: normalizeTiers(row.quantityTiers), bundles: normalizeBundles(row.bundles), updatedAt: row.updatedAt };
  }

  /** One transaction: refuse a stale version, write the new settings, bump `pricing_version`, audit before/after. */
  async savePricing(input: Actor & { expectedVersion: unknown; baseUnitPriceMinor: unknown; giftDiscountBps: unknown; tiers: unknown; bundles: unknown }) {
    if (typeof input.expectedVersion !== "string" || !/^\d{1,15}$/.test(input.expectedVersion)) throw new CommerceError("stale_pricing", 409);
    const expected = BigInt(input.expectedVersion);
    const base = wholeNumber(input.baseUnitPriceMinor), gift = wholeNumber(input.giftDiscountBps);
    if (base === undefined || base < 1 || base > MAX_PRICE_MINOR) throw new CommerceError("price_invalid");
    if (gift === undefined || gift < 0 || gift > 10000) throw new CommerceError("gift_discount_invalid");
    const tiers = parseTiers(input.tiers), bundles = parseBundles(input.bundles);
    return applyOnce(this.database, async (tx) => {
      const [current] = await tx.select().from(shopSettings).where(eq(shopSettings.id, 1)).for("update");
      const version = current ? current.pricingVersion : 0n;
      const before: JsonObject | null = current
        ? { pricingVersion: String(version), baseUnitPriceMinor: Number(current.baseUnitPriceMinor), giftDiscountBps: current.giftDiscountBps, quantityTiers: normalizeTiers(current.quantityTiers) as unknown as JsonObject[], bundles: normalizeBundles(current.bundles) as unknown as JsonObject[] }
        : null;
      const after: JsonObject = { pricingVersion: String(version + 1n), baseUnitPriceMinor: base, giftDiscountBps: gift, quantityTiers: tiers as unknown as JsonObject[], bundles: bundles as unknown as JsonObject[] };
      // The audit row goes first, so a retry with the same request key replays instead of repeating.
      await recordAudit(tx, { staffId: input.actorId, action: "pricing.update", targetKind: "shop_settings", targetKey: "1", requestKey: input.requestKey, details: { before, after } });
      if (version !== expected) throw new CommerceError("stale_pricing", 409);
      if (before && JSON.stringify({ ...before, pricingVersion: 0 }) === JSON.stringify({ ...after, pricingVersion: 0 })) throw new CommerceError("no_change");
      if (current) {
        await tx.update(shopSettings).set({ baseUnitPriceMinor: BigInt(base), giftDiscountBps: gift, quantityTiers: tiers, bundles, pricingVersion: version + 1n, updatedAt: sql`now()` }).where(eq(shopSettings.id, 1));
      } else {
        await tx.insert(shopSettings).values({ id: 1, baseUnitPriceMinor: BigInt(base), giftDiscountBps: gift, quantityTiers: tiers, bundles, pricingVersion: 1n });
      }
      return { version: String(version + 1n) };
    });
  }

  // ---- promotions ---------------------------------------------------------------------------------

  async promotions(filter: { status?: string; cursor?: unknown }) {
    const conditions: (SQL | undefined)[] = [];
    if (filter.status) {
      if (!PROMO_STATUSES.includes(filter.status as (typeof PROMO_STATUSES)[number])) throw new CommerceError("invalid_filter");
      conditions.push(sql`${statusOf} = ${filter.status}`);
    }
    const cursor = cursorOf(filter.cursor);
    if (cursor) conditions.push(or(lt(promotions.startsAt, cursor[0]), and(eq(promotions.startsAt, cursor[0]), lt(promotions.id, cursor[1])))!);
    const rows = await this.db
      .select({
        id: promotions.id,
        trigger: promotions.trigger,
        code: promotions.code,
        discountBps: promotions.discountBps,
        bundle: promotions.eligibleBundleQuantity,
        startsAt: promotions.startsAt,
        endsAt: promotions.endsAt,
        maximumRedemptions: promotions.maximumRedemptions,
        perBuyerLimit: promotions.perBuyerLimit,
        isActive: promotions.isActive,
        status: sql<string>`${statusOf}`,
        used: sql<number>`${usedCount}::int`,
        orders: sql<number>`${orderCount}::int`,
      })
      .from(promotions)
      .where(and(...conditions))
      .orderBy(desc(promotions.startsAt), desc(promotions.id))
      .limit(PAGE_SIZE + 1);
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: nextCursor(rows, (row) => row.startsAt) };
  }

  /** A promo code ("code") or a free campaign ("automatic_free", always 100% off). */
  async createPromotion(input: Actor & { kind: unknown; code?: unknown; discountBps?: unknown; bundle: unknown; startsAt: unknown; endsAt: unknown; maximumRedemptions?: unknown; perBuyerLimit?: unknown }) {
    if (input.kind !== "code" && input.kind !== "automatic_free") throw new CommerceError("kind_invalid");
    const trigger = input.kind;
    let code: string | null = null;
    if (trigger === "code") {
      code = normalizeCode(input.code);
      if (!CODE.test(code)) throw new CommerceError("code_invalid");
    }
    const discountBps = trigger === "code" ? parseDiscount(input.discountBps) : 10000;
    const bundle = parseBundle(input.bundle);
    const { starts, ends } = parseWindow(input.startsAt, input.endsAt);
    if (ends <= new Date()) throw new CommerceError("ends_in_past");
    const maximumRedemptions = parseLimit(input.maximumRedemptions, "limit_invalid", { optional: true });
    // The accepted default is one use per buyer; a campaign always has a per-buyer limit.
    const perBuyerLimit = parseLimit(input.perBuyerLimit === "" || input.perBuyerLimit === undefined ? 1 : input.perBuyerLimit, "limit_invalid", { optional: false });
    const promotionId = randomUUID();
    const fields: PromoFields = { code, discountBps, bundle, startsAt: starts.toISOString(), endsAt: ends.toISOString(), maximumRedemptions, perBuyerLimit };
    try {
      return await applyOnce(this.database, async (tx) => {
        await recordAudit(tx, { staffId: input.actorId, action: "promo.create", targetKind: "promotion", targetKey: promotionId, requestKey: input.requestKey, details: promoDetails({ ...fields, trigger }) });
        await tx.insert(promotions).values({ id: promotionId, trigger, code, discountBps, eligibleBundleQuantity: bundle, startsAt: fields.startsAt, endsAt: fields.endsAt, maximumRedemptions, perBuyerLimit, isActive: true });
        return { id: promotionId };
      });
    } catch (error) {
      if (errorSource(error).code === "23505" && errorSource(error).constraint?.startsWith("promotions_code")) throw new CommerceError("code_taken", 409);
      throw error;
    }
  }

  /** Dates and limits can always change; code, discount and bundle only while nothing has used the promotion. */
  async updatePromotion(input: Actor & { promotionId: unknown; code?: unknown; discountBps?: unknown; bundle: unknown; startsAt: unknown; endsAt: unknown; maximumRedemptions?: unknown; perBuyerLimit?: unknown }) {
    const promotionId = id(input.promotionId);
    const bundle = parseBundle(input.bundle);
    const { starts, ends } = parseWindow(input.startsAt, input.endsAt);
    const maximumRedemptions = parseLimit(input.maximumRedemptions, "limit_invalid", { optional: true });
    const perBuyerLimit = parseLimit(input.perBuyerLimit, "limit_invalid", { optional: false });
    try {
      return await applyOnce(this.database, async (tx) => {
        const [current] = await tx.select().from(promotions).where(eq(promotions.id, promotionId)).for("update");
        if (!current) throw new CommerceError("not_found", 404);
        const code = current.trigger === "code" ? normalizeCode(input.code) : null;
        if (current.trigger === "code" && !CODE.test(code!)) throw new CommerceError("code_invalid");
        const discountBps = current.trigger === "code" ? parseDiscount(input.discountBps) : 10000;
        const after: PromoFields = { code, discountBps, bundle, startsAt: starts.toISOString(), endsAt: ends.toISOString(), maximumRedemptions, perBuyerLimit };
        const before: PromoFields = { code: current.code, discountBps: current.discountBps, bundle: current.eligibleBundleQuantity, startsAt: iso(current.startsAt), endsAt: iso(current.endsAt), maximumRedemptions: current.maximumRedemptions, perBuyerLimit: current.perBuyerLimit };
        await recordAudit(tx, { staffId: input.actorId, action: "promo.update", targetKind: "promotion", targetKey: promotionId, requestKey: input.requestKey, details: { before: promoDetails(before), after: promoDetails(after) } });
        if (JSON.stringify(promoDetails(before)) === JSON.stringify(promoDetails(after))) throw new CommerceError("no_change");
        const identityChanged = before.code !== after.code || before.discountBps !== after.discountBps || before.bundle !== after.bundle;
        if (identityChanged && (await this.referenced(tx, promotionId))) throw new CommerceError("promo_in_use", 409);
        await tx.update(promotions).set({ code, discountBps, eligibleBundleQuantity: bundle, startsAt: after.startsAt, endsAt: after.endsAt, maximumRedemptions, perBuyerLimit }).where(eq(promotions.id, promotionId));
        return { id: promotionId };
      });
    } catch (error) {
      throw this.promotionWriteError(error);
    }
  }

  async setPromotionActive(input: Actor & { promotionId: unknown; active: unknown }) {
    const promotionId = id(input.promotionId);
    if (typeof input.active !== "boolean") throw new CommerceError("invalid_request");
    const active = input.active;
    try {
      return await applyOnce(this.database, async (tx) => {
        const [current] = await tx.select({ isActive: promotions.isActive, code: promotions.code }).from(promotions).where(eq(promotions.id, promotionId)).for("update");
        if (!current) throw new CommerceError("not_found", 404);
        await recordAudit(tx, { staffId: input.actorId, action: active ? "promo.activate" : "promo.deactivate", targetKind: "promotion", targetKey: promotionId, requestKey: input.requestKey, details: { code: current.code } });
        if (current.isActive === active) throw new CommerceError("no_change", 409);
        await tx.update(promotions).set({ isActive: active }).where(eq(promotions.id, promotionId));
        return { id: promotionId };
      });
    } catch (error) {
      throw this.promotionWriteError(error);
    }
  }

  /** Removes a promotion nobody has used. Anything redeemed or ordered stays, deactivated instead. */
  async deletePromotion(input: Actor & { promotionId: unknown }) {
    const promotionId = id(input.promotionId);
    return applyOnce(this.database, async (tx) => {
      // The usage guard takes the same row lock, so a checkout cannot slip in between the check and the delete.
      const [current] = await tx.select().from(promotions).where(eq(promotions.id, promotionId)).for("update");
      if (!current) throw new CommerceError("not_found", 404);
      await recordAudit(tx, { staffId: input.actorId, action: "promo.delete", targetKind: "promotion", targetKey: promotionId, requestKey: input.requestKey, details: promoDetails({ trigger: current.trigger, code: current.code, discountBps: current.discountBps, bundle: current.eligibleBundleQuantity, startsAt: iso(current.startsAt), endsAt: iso(current.endsAt), maximumRedemptions: current.maximumRedemptions, perBuyerLimit: current.perBuyerLimit }) });
      if (await this.referenced(tx, promotionId)) throw new CommerceError("promo_used", 409);
      await tx.delete(promotions).where(eq(promotions.id, promotionId));
      return { id: promotionId };
    });
  }

  private async referenced(tx: SahsahDatabase, promotionId: string) {
    const [row] = await tx.execute<{ used: boolean }>(sql`SELECT (EXISTS (SELECT 1 FROM promo_usages WHERE promotion_id = ${promotionId}) OR EXISTS (SELECT 1 FROM token_orders WHERE applied_promotion_id = ${promotionId})) AS used`).then((r) => r.rows);
    return !!row?.used;
  }

  private promotionWriteError(error: unknown) {
    const source = errorSource(error);
    if (source.code === "23505" && source.constraint?.startsWith("promotions_code")) return new CommerceError("code_taken", 409);
    // The database refuses to reopen a campaign whose phone markers were already purged.
    if (source.code === "23514") return new CommerceError("campaign_closed", 409);
    return error;
  }

  // ---- orders (read only) ---------------------------------------------------------------------------

  async orders(filter: { status?: string; settlement?: string; channel?: string; promo?: string; from?: string; to?: string; phone?: string; cursor?: unknown }) {
    const buyer = alias(accounts, "buyer");
    const conditions: (SQL | undefined)[] = [];
    if (filter.status) {
      if (!ORDER_STATES.includes(filter.status as (typeof ORDER_STATES)[number])) throw new CommerceError("invalid_filter");
      conditions.push(eq(tokenOrders.paymentState, filter.status as (typeof ORDER_STATES)[number]));
    }
    if (filter.settlement) {
      if (!SETTLEMENTS.includes(filter.settlement as (typeof SETTLEMENTS)[number])) throw new CommerceError("invalid_filter");
      conditions.push(filter.settlement === "none" ? sql`${tokenOrders.settlementKind} IS NULL` : eq(tokenOrders.settlementKind, filter.settlement as "payment" | "zero_cost" | "native_store"));
    }
    if (filter.channel) {
      if (filter.channel !== "web" && filter.channel !== "native") throw new CommerceError("invalid_filter");
      conditions.push(filter.channel === "web" ? eq(tokenOrders.purchaseChannel, "paymob") : sql`${tokenOrders.purchaseChannel} <> 'paymob'`);
    }
    if (filter.promo) {
      if (!UUID.test(filter.promo)) throw new CommerceError("invalid_filter");
      conditions.push(eq(tokenOrders.appliedPromotionId, filter.promo));
    }
    const day = /^\d{4}-\d\d-\d\d$/;
    // Whole days in Cairo time, the way staff read them.
    if (filter.from) {
      if (!day.test(filter.from) || Number.isNaN(Date.parse(filter.from))) throw new CommerceError("invalid_filter");
      conditions.push(sql`${tokenOrders.createdAt} >= (${filter.from}::date::timestamp AT TIME ZONE 'Africa/Cairo')`);
    }
    if (filter.to) {
      if (!day.test(filter.to) || Number.isNaN(Date.parse(filter.to))) throw new CommerceError("invalid_filter");
      conditions.push(sql`${tokenOrders.createdAt} < ((${filter.to}::date + 1)::timestamp AT TIME ZONE 'Africa/Cairo')`);
    }
    if (filter.phone) {
      const full = normalizePhone(filter.phone);
      const digits = filter.phone.replace(/[\s\-()+.]/g, "");
      if (full) conditions.push(eq(buyer.phoneE164, full));
      else if (/^\d{4,}$/.test(digits)) conditions.push(sql`reverse(${buyer.phoneE164}) LIKE ${`${[...digits].reverse().join("")}%`}`);
      else throw new CommerceError("invalid_search");
    }
    const cursor = cursorOf(filter.cursor);
    if (cursor) conditions.push(or(lt(tokenOrders.createdAt, cursor[0]), and(eq(tokenOrders.createdAt, cursor[0]), lt(tokenOrders.id, cursor[1])))!);
    const rows = await this.db
      .select({
        id: tokenOrders.id,
        createdAt: tokenOrders.createdAt,
        buyerId: tokenOrders.buyerAccountId,
        buyerPhone: buyer.phoneE164,
        orderKind: tokenOrders.orderKind,
        tokenQuantity: tokenOrders.tokenQuantity,
        totalMinor: tokenOrders.totalMinor,
        paymentState: tokenOrders.paymentState,
        settlementKind: tokenOrders.settlementKind,
        purchaseChannel: tokenOrders.purchaseChannel,
        promoCode: promotions.code,
        promoTrigger: tokenOrders.appliedPromotionTrigger,
      })
      .from(tokenOrders)
      .innerJoin(buyer, eq(buyer.id, tokenOrders.buyerAccountId))
      .leftJoin(promotions, eq(promotions.id, tokenOrders.appliedPromotionId))
      .where(and(...conditions))
      .orderBy(desc(tokenOrders.createdAt), desc(tokenOrders.id))
      .limit(PAGE_SIZE + 1);
    return { rows: rows.slice(0, PAGE_SIZE).map((row) => ({ ...row, totalMinor: money(row.totalMinor) })), nextCursor: nextCursor(rows, (row) => row.createdAt) };
  }

  /** Whether any order exists at all, so an empty list can say checkout is not live rather than "no match". */
  async anyOrder() {
    const [row] = await this.db.select({ id: tokenOrders.id }).from(tokenOrders).limit(1);
    return !!row;
  }

  async order(orderId: unknown) {
    const orderKey = id(orderId);
    const [order] = await this.db.select().from(tokenOrders).where(eq(tokenOrders.id, orderKey)).limit(1);
    if (!order) throw new CommerceError("not_found", 404);
    const person = async (accountId: string | null) => {
      if (!accountId) return null;
      const [row] = await this.db.select({ id: accounts.id, phone: accounts.phoneE164, displayName: accounts.displayName, state: accounts.state }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
      return row ?? null;
    };
    const [buyerRow, beneficiary] = await Promise.all([person(order.buyerAccountId), person(order.beneficiaryAccountId)]);
    const [promo] = order.appliedPromotionId ? await this.db.select({ id: promotions.id, code: promotions.code, trigger: promotions.trigger }).from(promotions).where(eq(promotions.id, order.appliedPromotionId)) : [];
    const attempts = await this.db
      .select({ id: paymentAttempts.id, state: paymentAttempts.state, provider: paymentAttempts.provider, environment: paymentAttempts.environment, createdAt: paymentAttempts.createdAt, confirmedUnpaidAt: paymentAttempts.confirmedUnpaidAt, lastInquiredAt: paymentAttempts.lastInquiredAt })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.orderId, orderKey))
      .orderBy(desc(paymentAttempts.createdAt), desc(paymentAttempts.id))
      .limit(20);
    const eventFilters: (SQL | undefined)[] = [];
    if (attempts.length) eventFilters.push(inArray(paymentEvents.attemptId, attempts.map((a) => a.id)));
    if (order.settlementStorePurchaseId) eventFilters.push(eq(paymentEvents.nativePurchaseId, order.settlementStorePurchaseId));
    const events = eventFilters.length
      ? await this.db
          .select({ id: paymentEvents.id, attemptId: paymentEvents.attemptId, notificationType: paymentEvents.notificationType, outcome: paymentEvents.observedPaymentOutcome, nativeState: paymentEvents.observedNativeState, state: paymentEvents.state, receivedAt: paymentEvents.receivedAt, lastErrorCode: paymentEvents.lastErrorCode, confirmsClosedUnpaid: paymentEvents.confirmsClosedUnpaid })
          .from(paymentEvents)
          .where(or(...eventFilters))
          .orderBy(desc(paymentEvents.receivedAt), desc(paymentEvents.id))
          .limit(50)
      : [];
    const cases = await this.db
      .select({ id: paymentReconciliationCases.id, caseType: paymentReconciliationCases.caseType, state: paymentReconciliationCases.state, openedAt: paymentReconciliationCases.openedAt })
      .from(paymentReconciliationCases)
      .where(eq(paymentReconciliationCases.orderId, orderKey))
      .orderBy(desc(paymentReconciliationCases.openedAt))
      .limit(20);
    return {
      order: {
        id: order.id,
        createdAt: order.createdAt,
        kind: order.orderKind,
        channel: order.purchaseChannel,
        tokenQuantity: order.tokenQuantity,
        paymentState: order.paymentState,
        settlementKind: order.settlementKind,
        settledAt: order.settledAt,
        verifiedPaidAt: order.verifiedPaidAt,
        zeroTotalAcceptedAt: order.zeroTotalAcceptedAt,
        nativeVerifiedAt: order.nativeVerifiedAt,
        pricingVersion: order.pricingVersion === null ? null : String(order.pricingVersion),
        priceTierMinimumQuantity: order.priceTierMinimumQuantity,
        baseUnitPriceMinor: money(order.baseUnitPriceMinor),
        quantityDiscountBps: order.quantityDiscountBps,
        listSubtotalMinor: money(order.listSubtotalMinor),
        quantityDiscountMinor: money(order.quantityDiscountMinor),
        offerSubtotalMinor: money(order.offerSubtotalMinor),
        additionalDiscountKind: order.additionalDiscountKind,
        additionalDiscountBps: order.additionalDiscountBps,
        additionalDiscountMinor: money(order.additionalDiscountMinor),
        totalMinor: money(order.totalMinor),
        recipientPhone: order.recipientPhoneE164,
        recipientBoundAt: order.recipientBoundAt,
        hasGiftNote: !!order.giftNote,
      },
      buyer: buyerRow,
      beneficiary,
      promotion: promo ?? null,
      attempts,
      events,
      cases,
    };
  }

  // ---- payment reviews ------------------------------------------------------------------------------

  /** The open queue is oldest first, so the longest-waiting case is on top; resolved cases are newest first. */
  async reviews(filter: { state?: string; cursor?: unknown }) {
    const state = filter.state || "open";
    if (state !== "open" && state !== "resolved") throw new CommerceError("invalid_filter");
    const cursor = cursorOf(filter.cursor);
    const open = state === "open";
    const conditions: (SQL | undefined)[] = [eq(paymentReconciliationCases.state, state)];
    if (cursor) {
      const t = open ? gt : lt;
      conditions.push(or(t(paymentReconciliationCases.openedAt, cursor[0]), and(eq(paymentReconciliationCases.openedAt, cursor[0]), t(paymentReconciliationCases.id, cursor[1])))!);
    }
    const rows = await this.db
      .select({ id: paymentReconciliationCases.id, caseType: paymentReconciliationCases.caseType, state: paymentReconciliationCases.state, orderId: paymentReconciliationCases.orderId, openedAt: paymentReconciliationCases.openedAt, resolvedAt: paymentReconciliationCases.resolvedAt })
      .from(paymentReconciliationCases)
      .where(and(...conditions))
      .orderBy(open ? asc(paymentReconciliationCases.openedAt) : desc(paymentReconciliationCases.openedAt), open ? asc(paymentReconciliationCases.id) : desc(paymentReconciliationCases.id))
      .limit(PAGE_SIZE + 1);
    return { rows: rows.slice(0, PAGE_SIZE), nextCursor: nextCursor(rows, (row) => row.openedAt) };
  }

  async review(caseId: unknown) {
    const caseKey = id(caseId);
    const [row] = await this.db.select().from(paymentReconciliationCases).where(eq(paymentReconciliationCases.id, caseKey)).limit(1);
    if (!row) throw new CommerceError("not_found", 404);
    const [order] = row.orderId
      ? await this.db.select({ id: tokenOrders.id, createdAt: tokenOrders.createdAt, quantity: tokenOrders.tokenQuantity, totalMinor: tokenOrders.totalMinor, paymentState: tokenOrders.paymentState, buyerPhone: accounts.phoneE164 }).from(tokenOrders).innerJoin(accounts, eq(accounts.id, tokenOrders.buyerAccountId)).where(eq(tokenOrders.id, row.orderId))
      : [];
    const [event] = row.paymentEventId
      ? await this.db.select({ id: paymentEvents.id, notificationType: paymentEvents.notificationType, outcome: paymentEvents.observedPaymentOutcome, state: paymentEvents.state, receivedAt: paymentEvents.receivedAt, lastErrorCode: paymentEvents.lastErrorCode }).from(paymentEvents).where(eq(paymentEvents.id, row.paymentEventId))
      : [];
    const [purchase] = row.nativePurchaseId
      ? await this.db.select({ id: storePurchases.id, provider: storePurchases.provider, state: storePurchases.state, providerProductId: storePurchases.providerProductId, verifiedTokenQuantity: storePurchases.verifiedTokenQuantity }).from(storePurchases).where(eq(storePurchases.id, row.nativePurchaseId))
      : [];
    const [resolution] = row.resolutionAuditEventId
      ? await this.db.select({ staffEmail: staffAccounts.normalizedEmail, reason: staffAuditEvents.reason, createdAt: staffAuditEvents.createdAt }).from(staffAuditEvents).innerJoin(staffAccounts, eq(staffAccounts.id, staffAuditEvents.staffAccountId)).where(eq(staffAuditEvents.id, row.resolutionAuditEventId))
      : [];
    return {
      review: { id: row.id, caseType: row.caseType, state: row.state, openedAt: row.openedAt, resolvedAt: row.resolvedAt, attemptId: row.attemptId, transactionId: row.transactionId, details: row.details },
      order: order ? { ...order, totalMinor: money(order.totalMinor) } : null,
      event: event ?? null,
      purchase: purchase ?? null,
      resolution: resolution ?? null,
    };
  }

  /**
   * Records that staff looked at the case and settled it outside the system (refunds and chargebacks
   * happen in Paymob, Apple or Google). It moves no money and does not touch the order or the bank.
   */
  async markReviewed(input: Actor & { caseId: unknown; note: unknown }) {
    const caseKey = id(input.caseId), note = noteOf(input.note, "note_required");
    return applyOnce(this.database, async (tx) => {
      const [current] = await tx.select({ state: paymentReconciliationCases.state, caseType: paymentReconciliationCases.caseType, orderId: paymentReconciliationCases.orderId }).from(paymentReconciliationCases).where(eq(paymentReconciliationCases.id, caseKey)).for("update");
      if (!current) throw new CommerceError("not_found", 404);
      const auditId = await recordAudit(tx, { staffId: input.actorId, action: "payment_case.review", targetKind: "payment_reconciliation_case", targetKey: caseKey, requestKey: input.requestKey, reason: note, details: { caseType: current.caseType, orderId: current.orderId } });
      if (current.state !== "open") throw new CommerceError("already_resolved", 409);
      await tx.update(paymentReconciliationCases).set({ state: "resolved", resolvedAt: sql`now()`, resolutionAuditEventId: auditId }).where(eq(paymentReconciliationCases.id, caseKey));
      return { id: caseKey };
    });
  }

  // ---- store products (read only) -------------------------------------------------------------------

  async storeProducts() {
    const rows = await this.db
      .select({ id: storeProducts.id, provider: storeProducts.provider, applicationId: storeProducts.applicationId, providerProductId: storeProducts.providerProductId, tokenQuantity: storeProducts.tokenQuantity, targetEgpPriceMinor: storeProducts.targetEgpPriceMinor, isActive: storeProducts.isActive, updatedAt: storeProducts.updatedAt })
      .from(storeProducts)
      .orderBy(asc(storeProducts.provider), asc(storeProducts.tokenQuantity), asc(storeProducts.id))
      .limit(200);
    return { rows: rows.map((row) => ({ ...row, targetEgpPriceMinor: money(row.targetEgpPriceMinor) })) };
  }
}
