# Paymob onboarding for Sahsah

**A practical guide for the founder, their lawyer and the backend developer**

**Checked:** 6 November 2026. **Assumption:** the merchant is based in Egypt and will charge website customers in EGP.

[Printable PDF](paymob-onboarding-guide.pdf)

## 1. Can an ordinary person apply?

**Yes: Paymob publicly describes services for individuals and freelancers as well as companies.** Its FAQ says online contracting can use a national ID and a ready, active website when commercial registration and a tax card are unavailable. Its usual document list is commercial registration, tax card, bank details or IBAN, and the owner's or authorized signatory's national ID. [Paymob merchant FAQ](https://www.paymob.com/support/faqs).

That makes an individual application worth discussing before paying to form a company solely for Paymob. However, the FAQ is shared across regional websites. Ask Paymob's Egypt team to confirm that this route covers **Sahsah's digital game-access sales, direct API integration, live payments and settlement into the founder's proposed bank account**. Ask about limits and any later requirement to provide registration documents. The public FAQ does not settle those details.

Paymob accepting an individual does not establish an exemption from Egyptian business registration, taxes or invoicing duties. Have the lawyer and accountant determine those separately. The Egyptian Tax Authority provides [e-commerce tax-registration guidance](https://portal.eta.gov.eg/en/node/277) and [current tax and invoicing FAQs](https://www.eta.gov.eg/ar/alasylt-alshayt).

Here, “subscribe to Paymob” means opening and activating a **merchant account**. Sahsah's planned website purchases are one-time purchases of game tokens. Automatic recurring customer subscriptions would be a separate product decision.

## 2. Who does what?

| Person | Responsibility |
| --- | --- |
| Founder | Own the merchant account, describe the business accurately, provide identity and banking information, approve prices and commercial terms, and sign when authorized. |
| Lawyer, with an accountant for tax matters | Determine the suitable legal form and registrations, prepare any representation authority, review the Paymob agreement, and approve website policies and invoicing arrangements. |
| Backend developer | Build and test the payment integration, protect credentials, verify payment notifications, and credit purchased game tokens correctly. |
| Paymob | Review the applicant and business, specify required documents and payment methods, agree commercial terms, and approve activation. [Go-live checklist](https://developers.paymob.com/paymob-docs/getting-started/integration-checklist). |

## 3. Paperwork to prepare

Choose the application route with Paymob and the lawyer before collecting a company-specific document pack.

| Route | Prepare | Confirm with Paymob |
| --- | --- | --- |
| Individual / freelancer | Owner's national ID, ready active website, contact details, and proposed settlement bank details. | Eligibility for this business and API product; accepted bank-account ownership/type; required bank proof; transaction or settlement limits; and any deadline for additional paperwork. |
| Registered business | Commercial registration (السجل التجاري), tax card (البطاقة الضريبية), bank details/IBAN, and owner's or authorized signatory's national ID (بطاقة الرقم القومي). | Document validity/recency, acceptable scans, exact legal-name matching and any additional entity-specific documents. |

The registered-business list and individual alternative above come from the [merchant FAQ](https://www.paymob.com/support/faqs); the questions are matters to resolve for this application.

For an existing company, also ask whether Paymob needs formation documents, ownership information or proof that the signer can represent it. If the lawyer will act for the founder, ask what authorization Paymob accepts. Obtain the exact checklist rather than assuming every applicant needs every document.

Have the bank provide the account-holder name, account number and IBAN; ask Paymob whether a bank letter or statement is needed. **Do not assume a personal account is acceptable for a company, or that a company account is compulsory for an approved individual.** Confirm the permitted arrangement before opening a new account.

The lawyer/accountant should answer these questions:

- Can the founder legally carry on this activity as an individual, or should it use a sole proprietorship or company?
- What registration, tax-file, VAT and invoicing obligations apply to this founder and activity?
- Who owns the Sahsah brand and website, signs the contract and receives settlement?
- What customer cancellation/refund rights and financial-record retention duties must the website support?

These are instructions for professional review, not a claim that VAT registration or a particular company type is mandatory for every applicant.

## 4. What the founder needs to do

### A. Give Paymob a clear business description

Use this description, adjusted to the actual launch offering:

> Sahsah is a social trivia game. Customers buy digital game-access tokens on our website. One token starts one game. The planned website also supports token gifts and promotions. Tokens have no cash-redemption feature.

This reflects the repository's [commerce scope](../database/commerce-design.md) and [token-bank decision](../adr/0006-one-bank-without-customer-cashout.md). Confirm whether there are any prizes or wagering before submitting an application, and disclose the actual model. Ask Paymob to approve its business category and any gaming-related review in writing. A general individual-onboarding option does not itself approve this activity.

Supply the website URL, expected monthly sales, typical order value, customer countries and requested payment methods. Start by asking for Egyptian online cards and mobile wallets; Paymob must confirm which methods the account can use. Method availability depends on account configuration. [Paymob overview](https://developers.paymob.com/paymob-docs/getting-started/overview).

### B. Prepare a website that can be reviewed

The individual route calls for a ready, active website. Prepare these items as a practical review pack, then ask Paymob for its exact website requirements:

- A working HTTPS website showing what the customer receives and prices in EGP.
- Seller identity and working customer-support contact details.
- Terms of use, privacy policy and a lawyer-approved cancellation/refund policy.
- A digital-delivery explanation: when tokens arrive, how gifts work, and how a customer reports a failed payment or missing credit.
- A demonstrable checkout and purchase-confirmation journey in test mode.

The existing presentation prototype is not evidence of a functioning payment integration. Payment workflows remain implementation work in the new applications. See the [repository overview](../../README.md).

Sahsah currently has no ordinary customer cash-refund feature. Have the lawyer reconcile that product policy with applicable duties and the merchant agreement; a missing refund button does not decide a customer's rights or prevent provider reversals.

### C. Obtain a written quote and agreement

Settlement means Paymob transferring collected customer money to the approved bank account. Ask for the following in the quote or contract:

| Topic | Questions to settle |
| --- | --- |
| Charges | Percentage and fixed charge per method; setup, monthly or minimum fees; taxes on Paymob fees; refund, dispute and chargeback charges. |
| Receiving money | Settlement currency, schedule and bank-transfer charges; minimum amounts; reserves, holds and circumstances that delay settlement. |
| Account scope | Individual/business eligibility, approved business category, enabled payment methods, domestic/international customer eligibility and limits. |
| Operations | Activation dependencies, support contact, dispute-response deadlines, refund handling, termination and changing the merchant's legal identity later. |

Use the accepted quote to calculate Sahsah's net revenue. This guide does not promise a commission rate, approval deadline or settlement schedule for this account.

### D. Apply, then complete approval

1. The founder creates the account through [Paymob Egypt registration](https://egypt.paymob.com/portal/en/register), using contact details they control. Record the application reference.
2. Supply the documents Paymob requests, agree the commercial terms and have the authorized person sign the agreement.
3. Complete Paymob's business/risk review, test integration, validation and technical approval.
4. Obtain production credentials and explicit go-live clearance before enabling real payments.

Paymob's published journey starts with account/test access and proceeds through paperwork, contract, risk review, integration, testing, technical approval and live credentials. Registration alone does not complete activation. [Official approval checklist](https://developers.paymob.com/paymob-docs/getting-started/integration-checklist).

## 5. What the founder hands to the backend developer

Provide a test configuration first and the approved live configuration when issued. Transfer secrets through a password manager or deployment secret store; keep identity documents and bank paperwork out of the source repository.

| Item | Purpose |
| --- | --- |
| Merchant/account identifier and Egypt region | Identify the approved merchant and account configuration. |
| Secret key | Backend authorization for creating payment intentions. |
| Public key | Launch the customer-facing Paymob checkout. |
| Integration ID for each enabled method | Select the merchant's approved cards/wallets integrations. |
| HMAC secret | Verify that payment notifications are authentic. |
| API key, if required by the chosen inquiry endpoints | Authenticate additional provider operations; confirm the exact API contract. |
| Approved methods, EGP currency and support contact | Avoid assuming all advertised methods are enabled. |

In the dashboard, look under **Settings → Developers → API Keys**, and **Settings → Payment Integrations**. Secret/public keys and integration IDs differ between test and live. Paymob documents the API key as shared across both modes, so it must remain protected even during development. [Credential guide](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials).

The developer supplies a public HTTPS backend notification URL and a website return URL. Configure the callbacks for the relevant integrations or intention request. The founder should give the developer appropriate dashboard access; Paymob says only the main user can retrieve the HMAC secret. [Credentials](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials), [HMAC access FAQ](https://developers.paymob.com/paymob-docs/need-help/faqs).

## 6. What the integration will do

Recommended starting point: **Paymob-hosted Unified Checkout** for the Next.js website and NestJS backend.

1. The backend creates a Sahsah order and calculates its price and beneficiary.
2. It creates a Paymob payment intention using the server secret and selected integration IDs.
3. The browser opens Paymob checkout using the public key and the returned, order-specific client secret.
4. Paymob sends the payment result to the backend; the backend verifies it before accepting payment and granting tokens.
5. The website displays the order's backend-confirmed status.

Paymob documents this intention → checkout → callback flow. The browser return is for the customer experience and must not independently authorize token credit. [API flow](https://developers.paymob.com/paymob-docs/integration-paths/apis), [intention request](https://developers.paymob.com/paymob-docs/intention-apis/create-intention), [Egypt checkout](https://developers.paymob.com/paymob-docs/developers/checkout-experiences/unified-checkout-redirection).

The developer must keep server secrets out of frontend code, verify the documented callback HMAC, check the order/amount/currency/integration and successful financial outcome, and ensure repeated notifications cannot grant tokens twice. Test failure, pending payment, browser closure, delayed/duplicate notifications and missing-callback reconciliation as well as success. These are implementation requirements for Sahsah. [Paymob HMAC contract](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback), [existing payment design](../database/payment-workflows.md).

The developer can work with the test environment before live activation is complete, following Paymob's onboarding instructions. Customer charging begins after the merchant and integration approvals and live configuration are complete. Coordinate a controlled first live payment and settlement check with the founder and Paymob. This paper concerns website payments; the repository's [native-store billing design](../database/native-store-billing.md) covers app-store purchases separately.

## 7. Message the founder can send to Paymob

Draft only; the founder should fill in the details and send it.

> Hello Paymob Egypt team,
>
> I am the founder of Sahsah, an Egypt-based social trivia website: [website URL]. We plan to sell digital game-access tokens in EGP, including gifts and promotions. One token starts one game; tokens cannot be redeemed for cash. Our expected monthly sales are [estimate] and typical purchase value is [estimate].
>
> I am currently [an individual without commercial registration/tax card / a registered business]. Your FAQ describes online contracting using national ID and an active website when these documents are unavailable. Please confirm which onboarding route applies to our business.
>
> We need direct API integration with our NestJS backend and Paymob-hosted checkout, initially for cards and Egyptian mobile wallets. Please confirm business-category acceptance, required documents and website policies, settlement-account requirements, any individual-account limits, and whether this route includes live API payments and settlement.
>
> Please send the full pricing and settlement terms, contract, approval steps, and instructions for obtaining test credentials and later live credentials. My lawyer can assist with the paperwork and my developer will implement the integration.

For a commercial quote, use the [Paymob sales/contact form](https://www.paymob.com/about/contact-us). Official support is **support@paymob.com**; Paymob's developer portal also lists **19079** for Egypt. Use support to reach the appropriate Egypt onboarding team. [Official contact details](https://developers.paymob.com/).

**Ready to launch when:** the applicant and business are approved, the agreement is signed, settlement details are accepted, website policies are reviewed, the integration passes testing/technical approval, and the correct live credentials and methods are enabled.
