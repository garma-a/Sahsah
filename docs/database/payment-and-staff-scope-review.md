# Web/mobile payments and regular-admin scope

Reviewed 2026-11-02 following the user's compatibility and permission questions. Q88/Q89 were answered: native store purchases are required, and regular Admin manages all operations except staff management. The latest Q90/Q91 correction selects fixed native 1/2/5 bundles and personal purchases, keeping gifts/promos on the website; Q92 aims to match web EGP prices. Q93/Q94 settle separate store-offer limits and first verified unmatched claim. The role change and two-table native extension are now represented in v1.1 (39 tables); runtime integration/store validation remain implementation work.

## Current payment coverage

The current model covers website Paymob checkout and account-based access from mobile. This follows the [quotation](../../../sahsah_designs/quotation_sources/final-quotation.md), which explicitly excludes native store billing and mobile purchase links at lines 56/64/144. Those delivery-scope exclusions are evidence for the existing design, not a restriction on a new user decision.

| Payment route | Current schema assessment |
| --- | --- |
| Website Paymob checkout | Modeled: frozen quote, attempt/reference mapping, verified events/transactions, one settlement and once-only bank credit. No runtime integration has been implemented/tested. |
| Apple Pay or Google Pay as a wallet through Paymob | A wallet can still be a Paymob-processed payment. Actual method availability, merchant activation and signed/inquired financial facts must be checked; a wallet label is not native store billing. |
| Apple In-App Purchase / Google Play Billing | The original 37-table model lacked these. V1.1 now has SKU mappings, native purchase identities/completion, shared typed proofs and native order constraints; implementation/testing remain. |

Paymob documents Apple Pay support including Egypt, with merchant integration setup and live integration IDs. This establishes technical payment-method availability, not permission to use that route for any category of App Store purchase. Google Pay availability for this specific Egyptian merchant was not verified and is not assumed. [Paymob Apple Pay](https://developers.paymob.com/paymob-docs/payments-and-features/payment-methods/apple-pay-all-regions).

Apple Pay and Google Pay are card-wallet checkout mechanisms. Apple In-App Purchase and Google Play Billing govern native digital-product purchases. Google's wallet API hands a payment token to a payment processor; it is not Play Billing. [Google Pay flow](https://developers.google.com/pay/api/android/overview), [Apple Pay overview](https://developer.apple.com/apple-pay/).

Apple's standard rules require IAP for in-app functionality/currency; its multiplatform-game rule permits access to externally bought consumables when those items are also available through IAP. Google Play's standard rule requires Play Billing for in-app digital goods, including virtual currency/playtime. Regional programs/exceptions require eligibility review. **Inference for Sahsah:** plan native store billing for in-app game-token purchases, rather than assuming a wallet integration satisfies store requirements. [Apple 3.1.1/3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

## Native extension represented in v1.1

Reuse the account bank, ledger, games and common once-only fulfillment. Review:

- Store/app/product identity mapped to server-authoritative token quantities; unique purchase identities and stable beneficiary binding.
- Native financial evidence and notifications, rather than fabricated Paymob attempts/integration IDs or HMAC proof methods.
- Native amount/currency/offer snapshots. Current order checks assume EGP and AdminJS-computed web discounts; they must not reject or misprice legitimate store purchases.
- Verification and recoverable completion work. Apple supplies signed JWS transaction data; Google requires checking the purchase token/state before granting, followed by appropriate consumption/acknowledgement. [Apple server API](https://developer.apple.com/documentation/appstoreserverapi), [Google verification](https://developer.android.com/google/play/billing/security), [Google one-time lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time).
- Store product/offer pricing versus web presets/custom quantities/promos/gifts, pending purchases, duplicate delivery, purchase recovery and provider-initiated refunds/revocations. A customer's lack of a Sahsah cash-out button does not remove external store refund events.

Do not promise a final table count or mobile purchase feature parity until those choices are settled. Separate platform wallets are not required by the proposed shared-account model; store eligibility and attribution still need verification.

## Why the current admin is content-only

In Q40 the assistant recommended Super Admin for staff, prices, promotions and financial operations, and Content Admin for content/media. The user selected the recommended answer; [the interview record](design-session.md) and [requirements](requirements.md) preserve it. The intent was to limit an editor's financial authority. This was an assistant-proposed product policy, not a PostgreSQL or AdminJS requirement and not a consequence of consolidating to 37 tables.

The quotation lists dashboard functions and staff roles without an explicit per-role matrix. The inspected prototype/starter does not establish the claimed earlier “all operations except staff” matrix. That earlier intention should therefore be treated as the user's clarification, not falsely attributed to an existing source.

The user's stated alternative is straightforward: two fixed roles, `admin` and `super_admin`. Admin can manage content, pricing, promotions, complimentary credits, support and financial cases through validated audited actions; Super Admin additionally manages staff accounts/roles. Both retain payment-proof checks and append-only financial history. This needs a role-name/policy revision, not more staff tables or a dynamic permission framework.

Q89 accepted that policy, superseding Q40; the current DBML now uses `admin`. Q88 selected native store billing. See [ADR 0008](../adr/0008-regular-admin-operational-access.md) and [ADR 0009](../adr/0009-native-store-purchases.md).

Current scope is [native-store-billing.md](native-store-billing.md): fixed 1/2/5 personal native purchases, website gifts/promos and counter 1–20. The user explicitly replaced the earlier Q90/Q91 expanded choices with these simpler options.
