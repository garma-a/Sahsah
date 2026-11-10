# Run a passcode-gated preview before login exists

Accepted 2026-11-10 in the gameplay UI grilling session (Q10–Q12). The client plays the core game on a deployed site one week from now, before login, OTP and payment are built. A preview mode, off by default and enabled by setting its passcode variable, lets each browser that enters the shared passcode silently receive its own preview host account with a 10,000-token grant. Guests keep joining anonymously as designed.

One shared host account was rejected: a host owns one open room and one active game, so a second visitor would be blocked or would take control of a running game. Preview accounts use the existing schema unchanged: a reserved fake Egyptian phone number, and a staff-audited complimentary credit from one preview staff account. Tokens stay hidden in the preview UI.

Preview mode also relaxes two production guards. Identity comes from a preview credential issued and signed by the API rather than the external JWKS issuer (the two cannot be configured together), and admission uses API process pressure with a small fixed room ceiling because the preview host has no database pressure exporter. Private R2 signing stays as in [ADR 0013](0013-private-r2-gameplay-media.md).

This deliberately weakens fail-closed startup, so the mode must never be enabled alongside real accounts. Production launch starts from a fresh database; preview accounts, rooms and games are discarded, so fake phone numbers cannot collide with real ones.
