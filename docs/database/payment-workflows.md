# Payment evidence, settlement and exceptional reconciliation

Status: Q76–Q79 accepted; concrete adapter/column choices are proposals. Paymob's actual enabled merchant configuration must be checked during implementation. No payment API has been called by this design work.

## Ownership and records

| Record | Responsibility |
| --- | --- |
| `payment_attempts` | Positive checkout creation, frozen merchant/environment/config identity, correlation, uncertainty and closure event. Credentials/configuration remain deployment-managed. |
| `payment_provider_references` | Actual provider intention/order identifiers mapped to exact attempt/order/namespace; no assumed one-reference cardinality. |
| `payment_transactions` | Distinct real payment/capture/refund/void facts and confirmed money state. |
| `payment_events` | Typed verified callback inbox/authenticated inquiry history; immutable sanitized facts plus processing/mapping state. |
| `token_orders` settlement fields | One accepted positive-payment or local-free funding source per order, with exact transaction/proof links. |
| `payment_reconciliation_cases` | Ordinary Admin exceptions with evidence links and an audited resolution. |

An order, attempt, transaction and delivery/proof remain different facts even when some fields share a row. Exact callback deliveries deduplicate by namespace/fingerprint; a transaction can have later changed observations, and an order can receive two actual payments. Only one sourced ledger credit fulfills its quantity. Typed event processing validates actual signed facts; the companion SQL additionally checks processed proof family/outcome, mapped attempt/transaction namespace, current source state, amount/currency/integration, and settlement/credit atomicity. Cryptographic verification and complete provider normalization remain adapter responsibilities.

Provider IDs retain merchant/environment scope. Actual references are stored only when returned by the enabled API; no unique provider event ID, callback ordering or native idempotency contract is invented. See [provider research](commerce-research.md) and [ADR 0007](../adr/0007-consolidate-launch-schema.md).

## Checkout and uncertainty

Freeze the server-calculated price, actual discount/campaign eligibility, quantity and recipient binding before checkout. Create a local attempt/correlation identity transactionally, then call the provider outside database locks. Store returned references and any encrypted resumable checkout credentials; never log secrets or use a secret-bearing URL as ordinary audit data.

Network timeout after creation is an unknown outcome. A worker must reload attempt state and inquire/reconcile rather than blindly repeat a possibly accepted external operation. A new client request identity is not proof that a previous attempt cannot collect payment. Keep the order's original price and recipient binding stable across attempts.

`provider_expires_at` is not sufficient evidence to release a promo hold. Final-unpaid closure requires supported authenticated evidence. The closure FK binds the proof to the same attempt; the processing transaction additionally checks `confirms_closed_unpaid`, proof method/facts, and all other payment paths before release. If the integration cannot establish that state, retain the hold and open reconciliation.

## Verified intake and fulfillment

1. Verify the documented HMAC for the actual notification type. Reject invalid authentication; card-token events do not grant game tokens.
2. Commit a sanitized verified receipt and durable processing work before acknowledging accepted intake. Exact duplicate delivery reuses its digest identity; changed facts for an existing transaction remain processable.
3. Resolve merchant and stored provider references to the exact local attempt/order. Unmatched authenticated evidence remains reviewable rather than being matched by phone/customer name.
4. Inquire when fields are unsigned, ambiguous, conflicting or missing. The normalized verification record states its proof method and source. Repeated identical inquiry facts need not append unlimited rows.
5. Under consistent locks, verify permitted integration, actual successful payment/capture, exact frozen amount and currency, recipient/account eligibility and existing settlement. A pending authorization/refund/void cannot fund the order. Typed settlement FKs exclude refund/void sources and bind the actual proof to the transaction/order; semantic eligibility remains a transaction check.
6. If unsettled, set the order's immutable settlement fields/paid-or-zero markers and promo usage, then insert its directly sourced ledger credit; its trigger updates the recipient bank atomically. An unbound paid gift waits for its verified recipient without expiring.
7. Commit before notifying clients. A duplicate returns the original accepted effects. If another transaction also paid, retain it and create an overpayment case instead of granting again.

Actual provider reversals update confirmed financial evidence and open reconciliation. They do not erase an earlier grant/settlement, automatically debit a spent bank, restrict an account or create a customer cash-out flow. Preserve any separately supplied reversal identity and original-parent relationship; never treat its successful status as another sale.

## Late payment and quota exceptions

Q79 honors a verified exact payment against the original frozen order even after local closure. If the order already settled, it remains a once-only grant and the extra payment is reconciled. Wrong amount/currency or a deleted beneficiary is review work; never redirect a gift or fabricate a successful credit.

If its earlier held promo use was released, atomically consume the use with fulfillment and create an exception case preserving the old release timestamp/reason/evidence. A quota may consequently be exceeded by this late already-paid obligation; do not revoke another customer's accepted use or hide the payment. New admission still observes the current cap. Consumed use is never released because a game is unused or its game token is restored.

## Free campaign admission

Entered codes and automatic free campaigns both target one fixed bundle, require an end date and use per-buyer/global controls. Automatic campaigns have no code and represent 100% authorization. A zero total caused by configured quantity/gift pricing requires an eligible automatic campaign unless the actual entered code already authorizes it.

Compute purchasable pricing with ineligible automatic-free offers omitted; exhausting a welcome allowance must leave ordinary paid purchase available. Do not consume a redundant entered code when another free offer already makes its effective savings zero. Freeze the actually applied campaign trigger/ID and arithmetic on the order.

Serialize admission on the promotion row and count held plus consumed use for global/buyer limits. For a valid zero order, admission, consumption, local settlement and any bound-recipient credit commit in one transaction, with no Paymob attempt. Q87 counts the buyer account OR its campaign-local keyed phone fingerprint for free allowance. Capture the marker for each usage, retain it until campaign end, and count each usage once even if both match.

## Gifts and corrections

Unclaimed paid/free gifts do not expire. Binding uses the account matched at checkout, or the first authorized verified claim if initially unbound. Later phone changes/payment retries never reroute that identity. Buyer self-gifting remains blocked.

Only Admin may apply the audited gift-phone correction action, after verifying the original buyer's request and locking an unbound/unclaimed order. Record old/new phone, reason, request and staff audit. Validate the new recipient against self-gifting and current verified ownership; bind a matching account once at correction or continue unbound claim behavior. Already-bound gifts cannot be edited through this action.

## Lock and permission discipline

Resolve relevant IDs without relying on unlocked state, then lock participating player accounts in deterministic order before order/gift, promotion and wallet changes; recheck associations after locks. New checkout also locks/rechecks pricing configuration. Never acquire a game lock while already holding account/order/wallet locks; stale-game cleanup runs separately. Game funding/restoration paths lock their game before account/wallet work. Keep all external I/O outside those locks and handle aborted transactions.

AdminJS exposes financial records as read-only data plus authorized audited actions. Do not register generic create/edit/delete actions for balances, ledgers, settlement/proof markers or frozen order prices. A Admin role is not permission to fabricate a paid flag or bypass the source-grant service.

These are design invariants, not executed concurrency/security tests. [Query/index planning](query-plan.md) and [the completion audit](schema-status.md) track remaining validation.

Native scope update: the quote/discount/gift/local-zero paths above describe website purchases. Native personal 1/2/5 purchases use Apple/Google verified product/purchase evidence, shared channel-specific order settlement and the same bank; see [native-store-billing.md](native-store-billing.md). Website promo quotas do not govern store offers. Native historical money is nullable when the provider does not report it; never fabricate a web price or zero.

## v1.2 financial write contract

`token_orders.request_digest` freezes the canonical original intent; order request-key retries compare it even after authorized PII redaction. A verified event is an immutable observation; its mappings may advance until processed. Accepted settlement source/beneficiary never changes. Paymob and native source projections must reference their latest matching processed proof/time and cannot rewind to an older verification. A financial state may recur, so `facts_hash` is not globally unique. Transport notification/fingerprint identity deduplicates deliveries; order/ledger source uniqueness deduplicates fulfillment.

For bound accepted funding, settlement plus one matching ledger credit must commit together. The ledger trigger alone updates the balance. Native completion is not scheduled before delivery. Original accepted proofs survive subsequent reversals. A processed inquiry closes an attempt only with an affirmative same-attempt/merchant unpaid result. New checkout/binding locks and rechecks account state; pending deletion blocks new admission, and incoming authorized evidence resets old deletion consent. See [quality review](design-quality-review.md) for the exact boundaries and local test evidence.
