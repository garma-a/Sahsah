# Native store billing and the shared token bank

Accepted scope, 2026-11-02: Q88–Q94, including the user's latest Q90/Q91 simplification. The [current DBML](sahsah.dbml) adds two native tables to the 37-table base, for **39 tables total**. This is a schema/transaction design, not an implemented or store-certified payment integration.

## Launch scope

| Channel | Purchase experience |
| --- | --- |
| Website | Paymob checkout, fixed selectors and custom quantities 1–20, gifts, website codes and automatic free campaigns. |
| iOS | Apple In-App Purchase, personal fixed 1/2/5 bundles. |
| Android | Google Play Billing, personal fixed 1/2/5 bundles. |
| Shared account | One nonexpiring bank and ledger. Received gifts and website credits are available in mobile; native credits are available through the same account. |

The earlier answers requesting every native quantity and native gift/offer authoring were explicitly replaced by the simpler options. Native gift checkout and promo authoring are deferred; website capabilities remain. Q93 keeps native store-offer limits separate if such offers are later introduced. A real verified store redemption still needs correct ingestion/recovery even when there is no native campaign dashboard.

Aim to match website EGP prices where available store price points permit. Apple/Google products and billing UI control native charges; AdminJS website pricing cannot directly override them. Product mappings and advisory EGP targets can be managed locally; store prices are configured in the respective stores. Changes require a deliberate price review rather than silently relabeling a store charge.

## Small schema extension

| Record | Purpose |
| --- | --- |
| `store_products` | Six initial mappings: 1/2/5 tokens per store. Provider/app/product/quantity identity is immutable once referenced; activation and advisory EGP target can change with audit. |
| `store_purchases` | Actual native purchase identity, optional known SKU/quantity, stable buyer/order attribution, verified price when available, current state and completion progress. |
| `payment_events` | Reused typed evidence inbox: Apple notification/JWS or Google RTDN/API observations alongside existing Paymob methods. |
| `token_orders` | Reused order. Channel-specific constraints distinguish frozen web money from native product/settlement evidence. Native orders are personal and reference an exact mapped SKU. |
| `token_ledger_entries`, `accounts` | Reused once-only source credit and combined available bank. |
| `outbox_events`, reconciliation | Reused completion/retry work and financial exceptions; no separate native wallet or staff subsystem. |

`provider_namespace` means the real Paymob merchant ID or native app bundle/package ID, with environment/configuration retained. Paymob attempts/transactions explicitly remain Paymob records; native verification does not create fake integration IDs, attempts or HMAC events.

Native order money fields are NULL rather than fabricated web arithmetic. When a trusted store result reports historical price, record the normalized amount/currency on the purchase. A proof can omit money fields: retain unknown values and verify the actual digital purchase by product/state/quantity/account, never substitute current product price or zero. Price target and verified historical charge have different meanings.

For example, Google's ProductPurchaseV2 provides product/state/quantity and acknowledgement information without historical money fields, and its order ID may be absent. The backend must not manufacture an amount or use that optional order ID as its purchase key. [Google purchase schema](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2).

Apple server responses contain signed JWS transaction information. Google requires server purchase verification and duplicate-token checks; consumables are consumed/acknowledged after entitlement delivery. [Apple server API](https://developer.apple.com/documentation/appstoreserverapi), [Google verification](https://developer.android.com/google/play/billing/security), [one-time purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time).

## Verification and once-only fulfillment

1. Require the correct authenticated Sahsah account and obtain an allowed native SKU through the billing SDK. A normal in-app flow creates a server-owned personal order first. Native launch selects one 1/2/5 SKU per purchase.
2. Treat client success as a claim. Verify Apple signatures/app/environment/product/quantity and account association, or query Google Play using the purchase token. Google pending purchases receive no bank credit. Authenticate Google notifications, then query purchase state; RTDN alone is not purchase proof.
3. Retain the actual native identity before acknowledgement. Apple transaction identity is namespaced by app/environment. Google purchase-token hash is unique, with its token encrypted under an external key for verification/consumption. Google order ID is optional and cannot replace the token key.
4. A Google notification may arrive before SKU/quantity are known. Persist its token safely with unknown fields, then verify through the API. Unknown products/unsupported quantities remain reviewable; never guess credited tokens.
5. Resolve existing account/order attribution first and never move it. Verify that a supplied order belongs to the payer and matches the verified app/product/quantity; a client-supplied order ID alone is insufficient proof. The accepted-source FK binds order, buyer, SKU, channel and exact credited quantity.
6. Under consistent account/order/purchase locks, recheck source state and eligibility. Commit native settlement, exact verification-event link, one order-sourced positive ledger entry, bank update and completion work together. Durable source uniqueness prevents another credit across retries, orders or accounts.
7. After bank delivery, complete the consumable through the platform: Google consumption also acknowledges; Apple transaction finishing follows the supported StoreKit/server contract. Persist/retry completion and keep clients able to recover. Delivery is the token-bank credit, not waiting until all tokens are played.
8. A later refund/revocation preserves the original accepted proof/credit and opens reconciliation. Do not automatically make the bank negative. Sahsah's absence of a cash-out button does not prevent store-originated reversals or acknowledgement deadlines.

Google requires acknowledgement within three days to avoid automatic refund/revocation; use recoverable completion work rather than a browser/device-only promise. [Google processing lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time).

The source FK proves identity/quantity association, not that a JWS is valid or a JSON state is true. Those checks belong to the provider adapters. Queries occur outside long-held SQL locks; after network I/O, recheck the locked records before accepting changes. A previously purchased proof must not resurrect a currently revoked purchase on first claim.

The backend must also enforce its configured test/live boundary. Sandbox/test evidence must not credit ordinary production accounts; isolated sandbox/reviewer handling needs an explicit deployment setup. Completion retries and alerts must account for the provider's original purchased time and deadline, not restart the allowance when the backend first sees a late notification.

## Unmatched recovery and ownership

Q94 permits first verified signed-in claim only when there is no previous account/order link. Verify the supported purchase with the store, account state and any server-recognized account metadata. Bind once and create the claimant's personal order/credit atomically. A proof already linked to another account, a deleted original owner, or conflicting known metadata is not an unmatched purchase and cannot be redirected. Reinstalling or changing devices never grants the same purchase again.

Received website gifts stay bound by the existing verified-phone/account rules. The unmatched native claim path cannot retroactively turn a personal purchase into a gift or redirect a previously captured gift order. Unknown proof/account conflicts are audited support cases.

## Required runtime scenarios

| Scenario | Required result |
| --- | --- |
| Same proof sent twice or from two devices | One accepted settlement/credit; same prior result. |
| Same proof submitted to another account/order | Existing ownership/source wins; no transfer or second credit. |
| Pending Google payment later becomes purchased | No early credit; one verified later credit and completion. |
| RTDN arrives with only token/app identity | Durable encrypted token, API verification, then exact SKU mapping. |
| Bank committed but completion call/device fails | Retry completion through retained work; keep the bank credit once. |
| Store evidence has no historical amount | No invented zero/current catalog charge; preserve verified entitlement and unknown finance fields. |
| Outside-app redemption lacks a prior link | First valid authenticated claim binds once to that account's bank. |
| App/environment/SKU/quantity mismatch | Retain evidence and reconcile; no fabricated mapped source. |
| Admin changes web prices or deactivates a SKU | Existing purchase retains its accepted source; new native pricing still comes from the store. |
| Store refund after tokens were spent | Preserve evidence and open a case without automatic negative balance. |

These scenarios have selected disposable SQL/reference-transaction coverage in v1.2, not executed store-billing integration tests. Products, merchant/app setup, credentials, SDK adapters and sandbox/live transactions remain implementation work. Q84–Q87 are accepted; fresh deletion funding review and website campaign markers are represented. See [validation](validation/README.md) and [current status](schema-status.md).

## Proof projection refinement, v1.2

A processed `apple_store_jws` or `google_play_api` observation records typed native state, product and units; notifications alone cannot fund. The source must currently be PURCHASED and match that latest proof/time. Keep owner/order attribution sticky and monotonic verification time. A later legitimate reinstatement can append a new observation even if its canonical business facts equal an earlier one: no global facts-hash uniqueness. Existing accepted settlements keep their original proof when later state changes. New receipt attribution to an already authorized order during deletion invalidates old clearance/consent; a new unrelated claim remains blocked.
