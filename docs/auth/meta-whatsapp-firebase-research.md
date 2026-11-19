# Meta WhatsApp and Firebase setup research

Checked 7 November 2026 against official Meta and Firebase documentation. Scope is Sahsah using its own business account to send login codes to Egyptian players, with NestJS verifying the code and Flutter signing in to Firebase. This records setup requirements and implementation boundaries. No accounts, paid services or application code were changed.

The founder's short version is in [the setup checklist](meta-whatsapp-firebase-setup.md).

## Firebase login model

Firebase's built-in phone authentication sends an SMS. The chosen Sahsah flow instead applies Firebase custom authentication to a backend that verifies a WhatsApp-delivered code. This is an integration built by the developer, rather than a WhatsApp switch in Firebase's Phone provider. [Firebase Flutter phone authentication](https://firebase.google.com/docs/auth/flutter/phone-auth), [Flutter custom authentication](https://firebase.google.com/docs/auth/flutter/custom-auth).

After checking the code, NestJS creates a Firebase custom token for the stable local account UID. Flutter exchanges it through `signInWithCustomToken`. Later API requests carry Firebase ID tokens, which NestJS verifies. A custom token and an ID token have different uses; the API must not accept a custom token as the client's session credential. The existing [identity design](../database/identity-invitations.md) already selects this arrangement. [Custom token creation](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

Implementation recommendation: validate Egyptian phone numbers, bind each challenge to its phone/purpose, use short expiry and send/attempt limits, consume the code once and retain a stable account UID. Delivery notifications do not prove that the player knows the code. These are Sahsah backend responsibilities from the identity design, not services supplied by Firebase's custom-token endpoint.

## Firebase ownership and developer access

The founder should create or use a Firebase project under an account the business controls and retain owner access. Firebase IAM accepts a developer's Google account as a project member. Its Firebase console access screen is Project settings > Users and permissions. Product-specific roles can be assigned through Google Cloud IAM for the same project. These are separate from invitations to Meta. [Firebase project access](https://firebase.google.com/docs/projects/iam/overview).

For Authentication work, the product-level role is **Firebase Authentication Admin**, `roles/firebaseauth.admin`. It covers auth configuration and user management. It does not by itself permit registering Android/iOS apps or granting service-account access. The owner can register the mobile apps with package/bundle identifiers supplied by the developer and approve the server identity setup. [Authentication role](https://firebase.google.com/docs/projects/iam/roles-predefined-product), [app registration permission](https://firebase.google.com/docs/projects/iam/permissions).

If the developer must perform the initial app registration independently, Firebase Admin (`roles/firebase.admin`) includes those management permissions but is broader and includes project deletion. It is an optional setup grant, not the minimum auth role. Firebase Develop Admin is also broad and does not include `firebase.clients.create` in the current listed permissions. Do not describe either as a narrow auth-only role. [Firebase-level roles](https://firebase.google.com/docs/projects/iam/roles-predefined-all-products), [category roles](https://firebase.google.com/docs/projects/iam/roles-predefined-category).

## Backend credentials

The deployed backend needs an authenticated Firebase Admin SDK identity capable of signing custom tokens. With Google-managed signing, the calling identity requires `iam.serviceAccounts.signBlob` on the signing service account; Service Account Token Creator supplies that permission. A human's console role and the deployed service account's permissions are different things. In environments where managed credentials/federation are unavailable, the Admin SDK can sign with a service-account private key. Store any such key only in backend secrets, never in Flutter or source control. A project ID or mobile SDK configuration file alone is not a server signing credential. [Custom token signing methods](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [Admin SDK setup](https://firebase.google.com/docs/admin/setup).

## Firebase charges and mobile setup

Firebase documents custom authentication as available on the Spark plan, subject to applicable limits. Enabling Firebase SMS phone authentication requires billing, but the selected flow sends messages through Meta instead. Do not make Blaze, SMS quotas, APNs phone-auth setup or Facebook Login prerequisites for this custom-auth design. Other Firebase/Google services or an Identity Platform upgrade can introduce their own billing and limits. [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Authentication limits](https://firebase.google.com/docs/auth/limits).

The developer registers/configures the intended Android and iOS apps in the same Firebase project and integrates the Firebase Auth client SDK. Package and bundle identifiers must match the actual applications. This research does not install Flutter, run a mobile build or prescribe new platform versions. [Firebase Flutter setup](https://firebase.google.com/docs/flutter/setup).

## Accounts and founder ownership

Meta's current guide starts with a Facebook account or managed Meta account and developer registration. Create an app using Connect with customers through WhatsApp, select/create the founder's business portfolio, then connect the messaging account and test resources. [Get started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started).

The founder signs into Business Suite, opens the portfolio dropdown, selects Create a business portfolio, enters the business name/contact details and confirms their email. The creator gets full control. Managed Meta accounts are an alternative subject to organization permissions. [Create portfolio](https://www.facebook.com/business/help/1710077379203657).

Adding/connecting an app requires full portfolio control. Safe bootstrap: founder, guided by developer, uses Settings → Accounts → Apps → Add → Create a new app ID and creates Sahsah's app under the founder's portfolio. Do not promise a Basic-only invite permits app creation/ownership setup. [Add an app](https://www.facebook.com/business/help/2199735813629697).

Developer registration confirms email and phone access; this guide does not establish a universal government-ID requirement. [Registration](https://developers.facebook.com/documentation/development/register).

## Invite the backend developer

The founder opens Business Suite → Settings → People → Invite people, enters the email used by the developer's Facebook account, continues, selects portfolio permissions, continues, assigns assets/permissions, and sends the invitation. The developer accepts. The founder needs full portfolio control; restricted accounts or an unconfirmed business email can block invitations. Meta recommends only necessary access and two-factor authentication. [Official invitation steps](https://www.facebook.com/business/help/2169003770027706).

Current portfolio Partial access includes Basic, working on assigned assets, and Apps and integrations, formerly developer, which can edit apps and create access tokens. Full asset access does not require full portfolio access. Recommendation: give Apps and integrations access plus the relevant assets while founder retains ownership and billing control. [Access options](https://www.facebook.com/business/help/442345745885606).

Assign the Sahsah app, WhatsApp account and Messaging account explicitly. Existing people can receive later-created assets through Settings → People → name → Assign assets. [Asset assignment](https://www.facebook.com/business/help/325571851329683).

App Developer role permits technical settings without Administrator powers to delete the app, reset its secret or assign roles. Developer/Administrator roles need a Meta Developer Account. For portfolio-linked apps, app roles are managed through Business Manager. Portfolio membership alone does not replace app/asset permissions. [App roles](https://developers.facebook.com/documentation/development/build-and-test/app-roles).

## Business verification and documents

Personal account identity, sender-number ownership, business verification and template approval are separate. Business verification establishes a locally registered business and authority to represent it. Not all businesses need or can start verification, but WhatsApp features may require it. It is separate from the paid Meta Verified subscription and grants no badge. Do not promise an Egyptian national-ID-only route to full production OTP access. [Verification overview](https://www.facebook.com/business/help/1095661473946872).

If requested, the full-control founder uses Security Center, supplies exact legal name/address/phone/HTTPS website and confirms their connection via an offered business contact or domain verification. Meta may request documents when official records do not match. [Verification process](https://www.facebook.com/business/help/2058515294227817).

Accepted categories include business registration/licence, incorporation documents, government-issued business tax documents and business bank statements. Utility bills prove address/phone but not legal business name. Arabic is supported. Prepare appropriate Egyptian registration/tax/address documents, but do not state every applicant must upload every category or that personal ID substitutes for registered-business proof. [Accepted documents](https://www.facebook.com/business/help/159334372093366).

## Sender number

The founder must control the sender number, including its country/area code, and receive SMS or voice verification. Adding/verifying the number in the UI is distinct from registering it through the Cloud API. A new dedicated business number is the simplest recommendation. Standard direct registration cannot blindly reuse an existing ordinary WhatsApp number. [Phone requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers/).

Coexistence can keep an existing WhatsApp Business app number alongside Cloud API, but the reviewed official route is for Solution Partners/Tech Providers using Embedded Signup. Check that route or migration before deleting any existing account. [Coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/).

A display name is required; the current guide ties review to higher messaging limits rather than making approved display name a universal first-test prerequisite. [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names/).

## Authentication templates and launch gates

Mobile verification/login codes must use an Authentication template, with preset wording and optional security/expiry notices. Users must clearly select/consent to WhatsApp delivery. [Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates/), [consent and authentication practices](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-best-practices/).

Start with an approved Copy code template. Its current official creation page states no universal account-age, verification or historical-message threshold. A real approved-template delivery test is necessary; test hello-world messaging alone proves neither production access nor OTP eligibility. [Copy code](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/copy-code-button-authentication-templates/).

One-tap and zero-tap add Android integration and device/message eligibility checks, with copy-code fallback. These are not additional founder paperwork for ordinary copy-code setup. [One-tap](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/autofill-button-authentication-templates/), [zero-tap](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/zero-tap-authentication-templates/).

General messaging limits do not establish authentication-template eligibility. Check the actual account's available limits rather than treating a volume tier as proof that OTP sending is enabled. [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits/).

The reviewed current Meta authentication sources do not establish a universal verification, account-age or prior-message threshold for the ordinary copy-code template. They also do not guarantee unverified live OTP availability. Check the actual account's template creation and delivery early, and complete requested verification.

## Billing and server credentials

The use-case setup instructs adding a payment method for business-initiated messages. Test resources without payment details do not prove paid-production readiness. [WhatsApp app setup](https://developers.facebook.com/documentation/development/create-an-app/whatsapp-use-case/). Authentication pricing depends on recipient market/category; use current Egypt rates rather than old conversation pricing. [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/).

For direct own-business integration, use a System User token instead of the dashboard's temporary user token. An employee system user can be sufficient for a few own accounts. Assign the app and both WhatsApp and Messaging accounts explicitly in Business Suite; its UI does not cascade account permissions. Founder assistance can handle initial privileged setup without granting the contractor full portfolio control. [Tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/).

Use whatsapp_business_messaging for messages/status webhooks and whatsapp_business_management for templates/metadata management. business_management is only needed for programmatic portfolio access. Direct developers using only their own business data need neither App Review nor Advanced Access; accessing other merchants' data is a separate partner route. [Permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/).

## Terminology and links

Meta's 2026 model separates WhatsApp accounts holding phone/business presence from Messaging accounts holding templates/billing. Existing WABA IDs become Messaging account IDs for compatibility. Keep founder wording simple but assign both assets. [Account model](https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution/).

- Business console: https://business.facebook.com/
- Settings/invitations: https://business.facebook.com/latest/settings
- Verification: https://business.facebook.com/settings/security
- Developer signup: https://developers.facebook.com/async/registration
- App dashboard: https://developers.facebook.com/apps
- WhatsApp Manager: https://business.facebook.com/wa/manage/

## Source retrieval

Some Meta pages returned login-only content or rate limits to the web reader. Their public HTML was retrieved without credentials. For Meta Help articles, the article body was decoded from the HTML embedded in the page's public JSON data. Citations above point to the original official pages. UI names and availability can vary by account; the checklist preserves account-specific verification and live-template checks.
