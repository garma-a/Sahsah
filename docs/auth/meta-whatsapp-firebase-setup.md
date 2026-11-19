# WhatsApp and Firebase account requirements for Sahsah

Sahsah's mobile login will use WhatsApp to deliver a verification code. The backend will check the code, then provide the token used to sign in to Firebase. Firebase will manage the login session through custom authentication.

The Meta setup belongs under a Sahsah business portfolio, with its app, WhatsApp account and Messaging account connected to that portfolio. The initial app setup requires someone with full business access. Technical access can then be provided separately, while ownership and billing remain with the business.

Registration will need the business name, address, contact details, website and privacy policy. It also needs a business phone number that can receive an SMS or voice call to confirm ownership, and a payment method for paid messages. A new number is easier to set up. An existing WhatsApp number needs a compatibility or migration check before use.

Meta may request business verification through Security Center. This can require official registration and address documents matching the business details. A personal ID alone does not establish eligibility for every production feature.

Access is provided through Meta Business Suite under Settings, People and Invite people, using the email linked to the technical contact's Facebook account. The required permissions are Apps and integrations, Developer access to the Sahsah app, and management access to both the WhatsApp and Messaging accounts. A Meta developer account is required for the app role. Portfolio membership by itself does not provide all of this access.

Firebase needs a Sahsah project with the Android and iOS apps registered. Authentication access can be granted to the technical contact's Google email through Google Cloud IAM using Firebase Authentication Admin. App registration and the backend's token signing credentials require separate setup permissions or approval from the project owner.

Login messages require an approved authentication template. A copy code button is a practical starting point. The live sender, template and billing setup need to be checked with a real login on the intended phones; success with Meta's test number does not confirm production access. The backend will control code expiry, resend limits and verification attempts.

WhatsApp authentication messages carry Meta's messaging charges. Firebase custom authentication can start on the free plan within its limits. It is separate from Firebase's SMS phone authentication service.

References: [Meta account setup](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), [business access](https://www.facebook.com/business/help/442345745885606), [Firebase permissions](https://firebase.google.com/docs/projects/iam/roles-predefined-product) and [custom authentication](https://firebase.google.com/docs/auth/flutter/custom-auth). Reviewed 7 November 2026.
