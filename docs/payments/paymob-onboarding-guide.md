# Paymob account requirements for Sahsah

Sahsah will use Paymob to collect website payments in Egyptian pounds. Customers will purchase tokens for trivia games, including purchases sent as gifts. The tokens provide access to games and cannot be withdrawn as cash.

The usual account documents are:

- National ID of the owner or authorised signatory
- Commercial registration and tax card for a registered business
- Bank account details and IBAN
- An active website showing the service, prices and contact details

Paymob also describes an individual application route using a national ID and an active website when commercial registration and a tax card are unavailable. Confirmation from Paymob Egypt is still needed that this route covers Sahsah's game token sales, API payments and the proposed bank account. Any account limits or later document requirements should be included in that confirmation.

The website should explain how purchased tokens and gifts are delivered, with terms, a privacy policy and a refund policy appropriate to the service. Business registration, tax and invoicing requirements remain separate from Paymob's acceptance of the application.

The commercial agreement needs to cover the charge per transaction, any monthly or minimum fees, taxes on fees and the timing of bank transfers. Refund and dispute charges, transfer fees and any amounts held back also affect the amount Sahsah receives. These terms will depend on the offer agreed with Paymob.

For the website connection, the required configuration includes the secret and public keys, payment method integration IDs and the HMAC secret used to check payment notifications. An API key may also be needed for the selected endpoints. The account will need to support the agreed card and mobile wallet methods.

Test credentials allow the integration to be built and checked. Real payments require the contract, business and technical approvals and the correct live credentials. The backend will confirm payment before adding tokens, with protection against crediting the same payment twice.

Applications are available through [Paymob Egypt](https://egypt.paymob.com/portal/en/register). Support can be reached at support@paymob.com or 19079.

References: [Paymob account documents](https://www.paymob.com/support/faqs), [integration credentials](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials), [approval process](https://developers.paymob.com/paymob-docs/getting-started/integration-checklist) and [Egyptian Tax Authority guidance](https://portal.eta.gov.eg/en/node/277). Reviewed 6 November 2026.
