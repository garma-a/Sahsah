# Commerce and payment evidence for schema design

Researched 2026-10-26. Sources are official Paymob documentation and PostgreSQL 18 documentation. Local `paymob_architecture_security.pdf` is design input, not a provider contract. This note recommends structures and transaction boundaries; it does not implement them or establish the merchant account's enabled capabilities. No payment API, credentials, deployment or paid action was used.

## Product rules supplied for this research

- **Q29:** 1/2/5-token presets and custom whole quantities 1–20; server-controlled prices frozen on the order.
- **Q30:** gifts belong to a verified recipient phone; an existing matching account receives credit after payment, otherwise the recipient claims after verified registration. The sender receives no gift credit.
- **Q31:** apply the better single eligible gift/promo discount; gift and promo do not stack with each other.
- **Q32:** designated privileged staff may issue nonexpiring complimentary tokens, with a reason and audit, using ledger credits.

Subsequent answers establish the 100 EGP base, shared quantity tiers, one winning extra discount, exact fixed-bundle codes with end dates, reserved promo allowance and valid zero-cost acceptance without Paymob. The latest bank clarification excludes customer cash-out/ordinary purchase-refund workflows and source-lot allocation. Provider refund/reversal capabilities below remain factual research for exceptional reconciliation, not authorization to build an app refund feature. Unclaimed gifts, exact provider closure evidence and integration details remain design work.

## Verified provider facts and version caveats

Paymob's current flow creates an intention on the backend, opens hosted Unified Checkout using its returned client secret, and receives payment results on backend callbacks. Browser redirects serve the customer experience; they are not the fulfillment authority. [API flow](https://developers.paymob.com/paymob-docs/integration-paths/apis).

The Create Intention page, updated 2026-10-15, documents server-secret `Token` authorization, `amount` expressed in cents, currency matching the selected integration, provider order/intention references, `special_reference`, and notification/redirect URLs. Its notification URL may receive transaction and saved-card-token callbacks. Keep integer monetary amounts plus an explicit currency; map currency minor units to the selected API contract rather than using floating-point prices or assuming every currency has two decimals. Gift-recipient ownership comes from Sahsah's verified identity records, not the payer's billing phone. [Create Intention](https://developers.paymob.com/paymob-docs/intention-apis/create-intention).

The current hosted-checkout page, updated 2026-07-22, lists Egypt's URL as `https://eg.checkout.paymob.com/?publicKey=...&clientSecret=...`. Older official examples/local research use `accept.paymob.com/unifiedcheckout`. Select the current merchant/region integration contract before implementation; do not silently combine generations of examples. [Unified Checkout](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/unified-checkout-redirection).

The inquiry-by-transaction-ID page uses a generated Bearer auth token, unlike intention creation's server-secret authorization. The reviewed order/reference inquiry explicitly returns the **last** transaction, so it is not proof that no earlier attempt succeeded. Exact API hosts/paths, authentication and available methods must be confirmed for the merchant. [Transaction inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id), [order/reference inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).

## Keep these concepts separate

| Concept | Proposed meaning in Sahsah |
| --- | --- |
| Order/item | Frozen commercial agreement: quantity, currency, price, selected discount, purchaser and intended recipient |
| Payment attempt | Local attempt to obtain/use a provider checkout, including uncertain results; separate from the order |
| Provider transaction | Identified financial transaction whose state may subsequently change; scoped to the configured merchant/environment |
| Notification receipt | One received callback payload and verification/processing evidence; several receipts may refer to one transaction |
| Fulfillment | Once-only issuance of the purchased quantity to the intended beneficiary; independent of how many notifications arrive |
| Cash refund | A financial return against a successful provider transaction, distinct from returning a gameplay token or issuing a complimentary credit |

These are proposed local model boundaries, not claims that Paymob gives each object an identically named resource or a universal event ID.

## Verification, duplicates and changing financial state

Paymob distinguishes server-to-server processed callbacks from browser response callbacks. Its callback reference identifies `obj.id` as the transaction ID and `order.id` as the correlation key; notifications also occur after subsequent payment actions. It exposes refund/void/capture state and cumulative amounts. Therefore a later refund update for a known transaction must not be discarded solely because its transaction ID was already seen. Preserve any separately supplied refund identity as well; do not assume every refund has a new callback event ID. [Transaction callbacks](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/transaction-callbacks).

Transaction HMAC uses SHA-512 over the documented ordered concatenation of selected field values, compared with the `hmac` query parameter. It does **not** authenticate every JSON field: cumulative refund/capture totals, `updated_at` and `is_live` are absent from the documented signed list. Reproduce the exact documented paths/value formatting and dispatch by callback type; transaction and saved-card-token callbacks have different contracts. A card-token callback does not authorize purchased game-token issuance. Do not deduplicate receipts by HMAC alone, since unsigned fields can differ. [Transaction HMAC contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback), [card-token HMAC contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-for-card-tokens).

Recommendations:

1. Persist verified receipts durably before acknowledging successful intake. A receipt fingerprint may collapse exact duplicates; local receipt IDs are not invented Paymob event IDs. Different payloads for the same transaction remain processable.
2. Resolve the stored merchant/environment → provider order/intention → local attempt/order mapping. Verify the expected currency, amount, integration and relevant financial outcome before fulfillment. A matching customer ID or a `success=true` value alone is insufficient; an authorization is not automatically the required sale/capture.
3. Use authenticated inquiry when needed to confirm unsigned financial fields, conflicting callbacks or missing outcomes. Do not let a stale receipt overwrite a newer reconciled refund. An unavailable inquiry leaves uncertain work pending; it must not fabricate success.
4. Two **distinct successful transactions** against one commercial order are financial evidence to retain and reconcile, even when fulfillment already occurred. They are not merely duplicate receipts. The overpayment/refund handling policy remains open.

Paymob documents full/partial refunds linked to an original successful transaction and method-specific restrictions. This does not prove that this merchant can invoke every action or that Sahsah has selected cash-refund eligibility. [Refund overview](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/refund).

## Relational integrity and fulfillment

PostgreSQL supports composite foreign keys to declared unique/primary keys. Proposed examples: a fulfillment's `(order_id, item_id)` references that order's item; `(order_id, transaction_id)` references a transaction mapped to that order; a ledger credit's beneficiary references its fulfillment's beneficiary. Independent single-column references would permit valid IDs combined across unrelated orders/accounts. Required reference components need `NOT NULL` or deliberate all-or-none checks so partially null keys cannot evade the intended relationship. Unique fulfillment-source keys can prevent issuing the same item twice. Cross-table “paid” status, recipient verification and sum-of-items conditions cannot be maintained by a row `CHECK`. [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

Commit the authoritative payment result, item fulfillment, recipient binding, token movement and any stored wallet projection together. Credit only when the fulfillment insert/state transition actually succeeds; `ON CONFLICT` is not permission to increment a wallet again on the duplicate path. A database transaction does not atomically include an external Paymob HTTP request. [Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), [ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html).

Both payment fulfillment and verified registration can race to claim a gift. Lock the same gift/fulfillment row, recheck payment and verified phone ownership, bind the beneficiary once, then issue its credit in that transaction. A unique gift-fulfillment source remains necessary. Do not accidentally enforce purchaser-account equality for gift credits: the recipient is deliberately different. Phone normalization, ownership changes and uniqueness belong to the identity design.

## Discounts, staff credits and the two-service launch

Freeze quantity, pricing inputs, subtotal, selected discount identity/amount and payable total before checkout. After the accepted quantity reduction, represent at most one additional gift/promo discount per order; re-evaluate eligibility on the server. Local row checks can validate arithmetic/nonnegative amounts, but aggregate promotion usage requires a transaction. If limited promotions are selected, serialize their reservation/counter update on a promotion row or use an equivalent conditional atomic update; counting earlier redemptions without coordination can oversubscribe the cap. Reservation expiry and payment-after-release rules remain unresolved. [PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html).

For complimentary credits, persist staff actor, required reason, recipient, quantity, operation identity and audit evidence with the nonexpiring ledger credit. A role FK records identity; current permission checks and once-only execution remain application rules. Do not overwrite balances or disguise this as a paid order.

A PostgreSQL receipt inbox plus bounded processing/reconciliation inside the existing NestJS service can preserve the two-service topology. Keep provider HTTP calls outside short locked transactions and persist uncertain attempts for reconciliation. The reviewed official pages do **not** establish a provider-native idempotency-key contract, unique notification event ID, retry schedule or delivery-order guarantee. `special_reference` is a correlation reference, not documented proof that replaying an intention request cannot create another charge/checkout. These details require merchant-specific integration validation; database uniqueness alone cannot establish exactly-once external payment behavior.

## Follow-up: cash-refund requests and checkout expiry

Added 2026-10-26 as provider capability research. Later user decisions accept zero-cost local fulfillment, reserve/consume/confirmed-unpaid-release promo handling, fixed bundle/end-date scope and one nonexpiring bank. The latest clarification excludes ordinary customer cash refunds and their allocation machinery. Preserve the source facts below for exceptional provider reconciliation; do not infer an outbound refund feature or reopen ordinary refund eligibility.

**Documented refund request:** Paymob's official post-payment collection specifies `POST {base_url}/api/acceptance/void_refund/refund`, with `Authorization: Token {secret_key}` and a JSON body containing integer `transaction_id` and `amount_cents`. The identifier is the payment transaction to refund, not an order/intention ID. The collection describes a full refund as the original transaction amount and a partial refund as a positive smaller amount; its EGP example maps 50 EGP to 5,000 cents. It provides no refund-response example establishing that HTTP acceptance alone is a completed refund. This is an acceptance-payment refund API, not a Payouts/disbursement operation. [Official refund/void/capture collection](https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Refund%20%26%20Void%20%26%20Capture%20APIs.postman_collection.json).

The overview permits cumulative partial refunds up to the successful payment amount and notes payment-method restrictions. The documented feature is **not evidence that Sahsah's merchant contract enables it**, nor a rule for valuing discounted or partly spent token grants. A later refund's remaining amount must account for earlier confirmed/pending operations; do not send the original full amount again merely because the example calls it a full refund. [Refund overview](https://developers.paymob.com/paymob-docs/payments-and-features/managing-payments/refund).

**Verification boundary:** the transaction inquiry schema includes `pending`, `success`, `is_refund`, `is_refunded`, `parent_transaction` and cumulative `refunded_amount_cents`. Callback documentation covers later payment actions. Technical inference: record request/outcome evidence separately, reconcile the specific transaction and any provider refund identity supplied, and confirm the financial state before recording a completed cash refund. A network timeout is an unknown outcome, not permission for a blind repeat. The reviewed sources do not establish an exactly-once refund-request contract or a fixed finality/delivery deadline. [Inquiry by transaction ID](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id), [transaction callbacks](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/transaction-callbacks).

**Documented intention lifetime:** the official Intention collection describes `expiration` as an integer number of seconds until the intention/payment link becomes invalid, with a documented default/maximum of 3,110,400 seconds (36 days). It also documents updating this field with `PUT /v1/intention/{client_secret}`. The public Create/Update pages list the field but give less detail. [Official Intention collection](https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Intention%20APIs.postman_collection.json), [Update Intention](https://developers.paymob.com/paymob-docs/developers/intention-apis/update-intention).

**Unsettled provider behavior:** these sources do not specify a cancellation/fencing guarantee for an already initiated card, wallet or kiosk payment, the race between intention expiry and a late successful transaction, or the exact effect of changing expiry during an in-progress payment. A local promotion reservation expiring is therefore not proof that its previously created checkout cannot collect money. Paymob separately documents cancellation for **V2 QuickLink**, which is a different product; do not transfer that contract to a hosted intention. [Collection overview and QuickLink distinction](https://github.com/PaymobAccept/API-Postman-Collections/blob/main/README.md).

The provider integration must account for late payments and record actual external reversals for staff reconciliation. Reviewed sources do not establish zero-amount Paymob checkout support; the accepted free-order route bypasses Paymob entirely. Current product scope excludes normal customer cash-out/refund workflows and source-lot spend allocation. No callback retry counts, universal event IDs or provider-native idempotency are established by this research.
