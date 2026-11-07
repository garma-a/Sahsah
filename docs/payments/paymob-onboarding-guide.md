# Paymob setup for Sahsah

We need a Paymob merchant account to accept website payments in EGP. Customers will buy tokens to start trivia games. These tokens cannot be exchanged for cash.

## What the founder needs

- A valid national ID
- A working website showing the game and token prices
- An email address and mobile number the founder controls
- Bank account details and IBAN to receive payments
- Commercial registration and a tax card if applying as a registered business

Paymob says online applicants without commercial registration or a tax card may be able to apply with their national ID and an active website. Ask Paymob Egypt to confirm this works for Sahsah API payments and which bank account they accept.

## What the lawyer handles

- Check which business registration and tax requirements apply
- Prepare any registration or signing documents needed
- Review the Paymob contract
- Review the website terms and privacy and refund policies

Paymob accepting an individual does not remove their tax obligations. The lawyer can work with an accountant on tax registration and invoices.

## What to ask Paymob

- Do you accept our business selling trivia game tokens and token gifts
- What documents and account limits apply to us
- Can we receive money in the proposed bank account
- What are the transaction fees and any monthly charges or taxes on fees
- When will the money reach our bank and can any amount be held back
- Can we enable card payments and Egyptian mobile wallets

Get these answers in writing before signing.

## What the backend developer needs

- Test secret key and public key
- Test integration IDs for the payment methods
- HMAC secret to verify payment notifications
- API key if the chosen integration needs it
- Live keys and integration IDs after approval

The developer provides the payment notification and website return URLs. Secret keys stay on the backend. The backend verifies a successful payment before adding tokens and makes sure the same payment cannot add tokens twice.

## Steps to get started

1. Create an account through [Paymob Egypt](https://egypt.paymob.com/portal/en/register)
2. Submit the requested documents and complete the contract and business approval
3. Let the developer test the integration and complete Paymob technical approval
4. Get live credentials and approval before accepting real payments

Paymob support is support@paymob.com or 19079 in Egypt.

References checked 6 November 2026

[Paymob requirements](https://www.paymob.com/support/faqs), [API credentials](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials), [approval steps](https://developers.paymob.com/paymob-docs/getting-started/integration-checklist), [support](https://developers.paymob.com/), [tax guidance](https://portal.eta.gov.eg/en/node/277)
