# Shop, gift and staff-credit design

Date: 2026-10-26. Product rules Q29–Q48 and the latest no-customer-cashout clarification are recorded; concrete tables/keys and transaction mechanisms remain proposals in the working DBML (commerce introduced through v0.5). This is not a completed payment integration.

## Accepted commercial rules

- Presets select 1/2/5 tokens; custom quantities are whole numbers 1–20. The production base price is **100 EGP/token**, not the prototype's 10 EGP.
- AdminJS manages quantity tiers and their discounts. Presets are shortcuts; the same quantity receives the same price through the counter. Threshold/percentage launch data is still to be configured; 2+ and 5+ were examples.
- Apply the quantity discount first. Then apply only the better eligible gift or promo discount. Gift and promo do not stack with each other. Prices, reductions, quantity and final charged amount are frozen on each order.
- Promo codes have validity windows, optional global redemption caps and default one successful use per purchasing account. A gifted order uses the buyer's allowance, not the recipient's.
- Every code targets exactly one fixed 1/2/5 bundle and requires an end date. Its exact quantity qualifies through the matching preset or custom counter; other quantities do not.
- Gifts target a verified recipient phone and cannot target the buyer's own account or verified phone. If that phone already maps to an account at checkout, bind the account then. Otherwise bind once on a valid claim after verified registration. Payment retries cannot re-resolve the phone and redirect delivery.
- Staff accounts are separate from player identities. Launch roles are Admin (all operational actions) and Super Admin (the same actions plus staff-account/role management).
- Admin may issue nonexpiring complimentary credits with reason and audit. Paid and paid-gift credits are also nonexpiring. The wallet is not directly overwritten through an editable balance field.
- All token types, including promotional credits, enter one nonexpiring bank. There is no customer cash-out/purchase-refund feature, source-lot bank or ordinary refund allocation/reservation workflow.
- Valid configured/code discounts may reach 100%. A zero-cost order is accepted and granted once locally without Paymob; percentages cannot exceed 100% and totals cannot be negative.

## Pricing representation

The proposed settings row holds EGP base unit price as 10,000 minor units and an editable gift discount; the historical gift default is 10%. Tiers hold minimum quantity and percentage in basis points, where 10,000 bps is 100%. Choose the active highest threshold not exceeding the quantity, or no tier discount when none applies.

The order stores the accepted base, quantity, selected tier minimum/version, tier reduction, offer subtotal, winning additional reduction and total. Exact numeric arithmetic rounds each positive reduction to whole minor units before subtracting; this rounding convention is a technical proposal to review with final pricing tests. Do not use binary floating-point money or recompute an old order from current editable settings.

Illustration only: if configured quantity discount is 20% and the winning extra promo is 10%, five tokens price as `500 EGP -> 400 EGP -> 360 EGP`. Those percentages are not accepted launch tier data.

Only the actual winning promo is applied/held/consumed. An entered code that loses to the gift discount should not spend its use. Proposed equal-savings tie handling prefers the automatic gift benefit so the buyer keeps their code; this is a deterministic quote detail to include in final review. Zero-cost acceptance uses its own marker rather than a fabricated paid transaction; see [zero-cost fulfillment](zero-cost-orders.md).

## Consolidated table boundaries

| Record | Purpose |
| --- | --- |
| `shop_settings` | Unit/gift price, bounded tier array and fixed 1/2/5 bundle configuration; orders copy accepted values. |
| `promotions`, `promo_usages` | Code/automatic rules, holds, paid/free consumption and confirmed-unpaid release. |
| `token_orders` | Frozen purchase, optional gift fields/account binding and one accepted settlement field group. |
| `token_ledger_entries`, `accounts.token_balance` | Direct uniquely sourced order/staff credit and its available balance projection. |
| `staff_accounts`, `staff_sessions`, `staff_audit_events` | Separate email identity, fixed role, persistent login and privileged-action evidence. |

One purchase/recipient per order needs no basket/items. Source uniqueness now means one positive ledger credit per order. Grant is the business authorization, represented on that ledger entry; it is not another SQL table. Gift corrections are structured staff audit actions. [ADR 0007](../adr/0007-consolidate-launch-schema.md) records this simplification.

## Recipient and quantity integrity

A personal order's beneficiary must be its buyer. A gift may initially have no beneficiary, but a bound beneficiary must differ from its buyer; verified-phone self-gifting is additionally rejected in the creation/binding transaction.

Gift-only phone/note/binding columns live on `token_orders`, guarded by order kind. The sole authoritative recipient account is `beneficiary_account_id`; capture its binding time together. Once bound, phone changes do not reroute it. Existing-account delivery and registration claim converge on the same order and unique positive ledger credit.

The positive ledger entry directly references its order, bound beneficiary, exact quantity and nonnull accepted settlement kind. An unbound/unsettled order cannot satisfy that composite source. A unique source order prevents a second credit. A complimentary credit instead references one unique staff audit and requires a reason. Permission, correct audit action/target and financial proof eligibility remain transaction checks.

Do not create another grant because a second provider transaction paid the same order. Preserve both transactions and handle the extra money through accepted staff reconciliation records. Do not restore an order credit by using `game_restoration`, which has different original-debit semantics.

## Concurrency and price edits

Serialize relevant pricing/settings edits and accepted quote creation so an order does not mix before/after values. Validate current quantity, tier, promo eligibility, buyer identity and recipient binding on the server; changing a hidden form value cannot set the charge or beneficiary.

Reserve scarce promo allowance at checkout, consume on verified positive payment or accepted zero-cost settlement, and release only after confirming a payment path is closed unpaid. A browser/local timeout is not that evidence; unknown outcomes stay held for reconciliation. Consumed usage is never released because a game was unused or its token restored. Row checks require released usage to have no consumption timestamp; transaction paths must preserve consumption history. Late-payment exceptions and exact provider closure evidence remain integration work.

Accepted settlement/staff authorization, the directly sourced ledger insertion and `accounts.token_balance` update must commit together. Provider HTTP requests and inquiries occur outside long-held DB locks, followed by state revalidation. An idempotency-key match must also match its account, source and payload.

## Later accepted integration decisions

Q72–Q79 add Egypt phone proofs/change, nonexpiring unclaimed gifts with audited unbound-phone correction, limited automatic free campaigns and once-only distinct/late payment handling. Merchant namespaces, attempts/references, verified receipt/proof records, actual transaction kinds, one settlement per order, reconciliation, persistent staff sessions and durable work are now represented. See [payment workflows](payment-workflows.md) for the current model.

Q84–Q87 and operational/evidence retention remain policy review. No customer cash-out/source-lot allocation is added.

The current order/ledger/proof FKs are not a live-payment authorization mechanism. Provider evidence and these transaction paths must be completed before the positive credit flow is implemented. See [primary-source commerce research](commerce-research.md), [token accounting](token-accounting.md) and [query planning](query-plan.md).

Native scope update: the quote/discount/gift/local-zero paths above describe website purchases. Native personal 1/2/5 purchases use Apple/Google verified product/purchase evidence, shared channel-specific order settlement and the same bank; see [native-store-billing.md](native-store-billing.md). Website promo quotas do not govern store offers. Native historical money is nullable when the provider does not report it; never fabricate a web price or zero.

V1.2 enforcement: the ledger INSERT trigger owns every bank update; services do not separately edit balances. Orders freeze their original request digest and quote, typed financial guards check settlement eligibility/delivery, and campaign usage includes the accepted Q87 phone boundary. See [quality review](design-quality-review.md).
