# Zero-cost fulfillment and the permanent token bank

Date: 2026-10-26. Q41 permits marketing discounts up to 100%; Q46/Q46a constrain codes to a fixed bundle; Q47 and the latest clarification keep all tokens in one nonexpiring bank without customer cash-out.

## Payment is not required at zero

The order still records buyer, quantity, beneficiary, currency and frozen price/discount amounts. Each percentage stays within 0–100%, each later discount applies to the remaining price, and the final amount is nonnegative. Do not add discount percentages together to calculate a negative total. Reject invalid configuration rather than quietly granting extra value.

For a valid zero-cost order, use `payment_state = not_required` and `zero_total_accepted_at`; leave `verified_paid_at` empty. No Paymob intention, checkout, transaction or callback is required or fabricated. Positive orders keep the normal verified-payment route. Row markers distinguish these cases, but the server must still validate the underlying campaign/configuration and identity.

## Proposed atomic acceptance

1. Authenticate the buyer and validate quantity 1–20, current base/tier settings and one winning gift/promo discount. Freeze the monetary quote.
2. Require the actual fixed 1/2/5 bundle/end date for the code or automatic free campaign; matching selectors are equivalent. Configured zero offers need an eligible automatic campaign when no applied code already authorizes them. Serialize global/per-buyer admission.
3. Apply normal gift rules: block buyer's phone/account, bind an existing verified recipient at checkout or leave the gift pending a valid claim.
4. Record zero-cost acceptance and consume the successful promo use in the same transaction. A hold may be created and consumed immediately; do not wait for a nonexistent payment callback.
5. For a known beneficiary, insert the order's directly sourced positive ledger credit; its database trigger updates `accounts.token_balance` in that transaction. For an unbound gift, keep its accepted settlement and insert that unique credit once on verified claim.
6. Commit before notifying the client. A lost response/repeated request returns the accepted order/grant rather than issuing again.

The success limit applies to zero-cost redemptions too. Ending an unused game can restore its spent token under the separate game rule, but never resets its already-consumed promo use. Code expiration does not expire or remove previously granted tokens.

## One bank, not purchase lots

Paid, received-gift, promotional and complimentary credits all increment the same bank. Game start spends one and an eligible game restoration returns one to that same bank. The customer sees no token-source wallets, expiry dates or source-spending priorities.

Keep the accepted settlement on the order and its direct ledger source reference to authorize incoming credits and retain history. The current product has no cash-out/customer purchase-refund feature, so do not add grant-balance lots, source consumption allocations or reserved wallet amounts for ordinary refunds. Q43/Q48's earlier ordinary cash-refund discussion is superseded by [ADR 0006](../adr/0006-one-bank-without-customer-cashout.md).

Actual external provider refunds/reversals are financial facts for internal Admin reconciliation, not customer features. Do not erase them or create a negative wallet automatically. The exact exceptional correction path belongs to the provider integration and must not be inferred from the removed ordinary refund policy.

## Later accepted scope

Q77 applies fixed-bundle/end-date/default-one-buyer/optional-global controls to automatic free campaigns too. Skip ineligible free offers when computing ordinary pricing; do not consume a redundant code without effective benefit. Q76 makes unclaimed gifts nonexpiring with correction only before binding. Phone proofs, payment evidence and durable work are now represented; Q87 still governs same-phone recreation. No runtime is implemented. See [current workflows](payment-workflows.md).

Native scope update: the quote/discount/gift/local-zero paths above describe website purchases. Native personal 1/2/5 purchases use Apple/Google verified product/purchase evidence, shared channel-specific order settlement and the same bank; see [native-store-billing.md](native-store-billing.md). Website promo quotas do not govern store offers. Native historical money is nullable when the provider does not report it; never fabricate a web price or zero.
