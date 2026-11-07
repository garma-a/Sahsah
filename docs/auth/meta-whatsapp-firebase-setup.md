# WhatsApp login setup for Sahsah

WhatsApp will deliver the login code. Our backend checks it and signs the player into Firebase. Firebase does not send the WhatsApp code in this setup.

## What the founder needs

- A Facebook account and a Google account the founder controls
- Business name and address plus a website and privacy policy
- A business phone number that can receive an SMS or call for registration
- A payment method for paid WhatsApp messages
- Business registration and address documents if Meta asks for verification

A new business number is the simplest starting point. Ask the developer before using a number already on WhatsApp. Testing can start with Meta test resources. Business verification may require official registration documents rather than a personal ID alone.

## Set up Meta and invite the developer

1. Open [Meta Business Suite](https://business.facebook.com/) and create a business portfolio for Sahsah
2. Open the [Meta App Dashboard](https://developers.facebook.com/apps/) and register as a developer if prompted. With the developer guiding, create an app under that portfolio using Connect with customers through WhatsApp
3. Set up the WhatsApp accounts with the Sahsah display name and verify ownership of the business number
4. Open Settings then People then Invite people
5. Enter the email linked to the developer's Facebook account after they complete Meta developer registration
6. Give Partial access with Apps and integrations. Assign Developer access to the Sahsah app and management access to its WhatsApp account and Messaging account
7. The developer accepts the invitation

The founder keeps full business access and billing control. Use two factor authentication. Complete business verification in Security Center if Meta requests it. Assign new assets to the developer as they are created.

## Set up Firebase access

- Create a Sahsah project in the [Firebase console](https://console.firebase.google.com/)
- Open [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam) for that project and add the developer's Google email
- Choose Firebase Authentication Admin for the authentication work
- Register the Android and iOS apps together and approve the backend signing access during setup

The founder keeps project ownership. No Facebook or Google password needs to be shared.

## What the developer handles

- Complete Cloud API number registration and set up the token and message notifications
- Submit an authentication message template for approval starting with a copy code button
- Create the code checking and Firebase custom sign in flow
- Connect Flutter to the same Firebase project
- Keep server secrets on the backend and limit code attempts and resends

Before launch, test a real login on the target phones and confirm that the account can send the approved authentication template. A working test number alone is not production approval.

Meta charges for authentication messages. Firebase custom sign in can start on the free plan within its limits. Firebase SMS sign in is a separate service.

Official references checked 7 November 2026

[Meta setup](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started), [inviting people](https://www.facebook.com/business/help/2169003770027706), [access options](https://www.facebook.com/business/help/442345745885606), [Firebase roles](https://firebase.google.com/docs/projects/iam/roles-predefined-product), [custom sign in](https://firebase.google.com/docs/auth/flutter/custom-auth)
