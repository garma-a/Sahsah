**Sahsah database: all 39 tables in simple words**

Updated 2026-11-03. This guide follows the order of the [current DBML](sahsah.dbml). It explains the design; it does not mean the database/API has been implemented. The [decision summary](decisions-summary.md) records the agreed rules.

A **room** is the reusable lobby. A **game** is one 36-question round inside it. The account stores the available token balance; the ledger records how it changed.

Website checkout uses Paymob with quantities 1–20, gifts and promos. Native mobile checkout uses Apple In-App Purchase or Google Play Billing for personal 1/2/5 bundles. All credits join one account bank.

Player accounts and verification:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 1 | `accounts` | Stores the player profile, Firebase login mapping, active game and single token balance. | Ali prefers Arabic, has five tokens and one active game. |
| 2 | `phone_verification_challenges` | Tracks WhatsApp verification requests, expiry and remaining attempts. | Sara enters the code sent to her WhatsApp before it expires. |
| 3 | `account_phone_changes` | Records an authorized number change and its verification evidence. | Ali changes his number while keeping his account, tokens and progress. |
| 4 | `account_deletion_requests` | Records funding review and consent to forfeit the exact remaining bank. | Ali resolves a pending payment, then confirms forfeiting three tokens to delete his account. |

Question library and files:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 5 | `categories` | Groups packs into selectable topics. | Football contains many football packs. |
| 6 | `question_packs` | Stores each pack's category, number and availability. | Football pack 7 is published. |
| 7 | `questions` | Stores question text, answer, format and pack position; old identities can be retired. | Position 2 is replaced with a new question ID. |
| 8 | `media_assets` | Records Cloudflare image/audio objects and readiness. | A player photograph has finished processing. |
| 9 | `question_media` | Connects files to their question/answer roles, including numbered hint images and points. | One blurred picture has hint stages worth 600, 400 and 200 points. |

Rooms and joining:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 10 | `rooms` | Stores the reusable lobby, owner, team names and current invitation code. | Ali opens a room for six people including himself, using code 012345. |
| 11 | `room_memberships` | Stores room participants, readiness, reconnect credentials and host removal/unblock. | Sara chooses Team A, presses Ready and refreshes without losing her seat. |

Games, scores and progress:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 12 | `games` | Records one started round, its two teams/scores, current question, host control and lifecycle. | Replay creates game 2 while game 1 keeps its result. |
| 13 | `game_packs` | Records the six packs selected for a game's board. | Column 1 uses Football pack 7. |
| 14 | `game_questions` | Keeps each starting question copy together with its timer, hints, result and host feedback. | Staff edit the catalog answer; this game keeps its original copy and saved timer. |
| 15 | `game_question_media` | Keeps references to the exact files retained for a game question. | A running game keeps its original photo after staff upload a replacement. |
| 16 | `game_players` | Preserves the starting roster and teams for each game, plus explicit departures. | Sara started on Team A; a temporary disconnect preserves her participation. |
| 17 | `account_question_exposures` | Remembers which question identities each signed-in player has already seen. | The system prefers another pack because Sara has seen a question in pack 7. |
| 18 | `account_pack_completions` | Records packs whose six questions were resolved within one game for an eligible account. | Sara receives completion after all six Football questions are resolved in that game. |
| 19 | `game_actions` | Records accepted host commands, prevents repeated effects and retains score adjustments. | Correcting 800 to 600 records -200; retrying the command applies no extra change. |

Token bank, website shop and promotions:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 20 | `token_ledger_entries` | Records sourced token movements and automatically updates the account bank. | A purchase adds five tokens; starting a game deducts one. |
| 21 | `shop_settings` | Stores website base price, quantity tiers, gift discount and fixed bundle settings. | Admin edits a website quantity discount; existing orders retain their accepted price. |
| 22 | `promotions` | Defines website promo codes and automatic free campaigns, including bundle scope, dates and limits. | A welcome code gives 100% off the one-token website bundle until its end date. |
| 23 | `token_orders` | Records the purchase request: buyer, quantity, beneficiary, channel and accepted funding; website orders also hold quote/gift details. | Ali orders five tokens for Sara on the website; payment can fulfill that order once. |
| 24 | `promo_usages` | Tracks promotion reservations/uses and campaign-local phone allowance markers. | Ali's welcome allowance is reserved at checkout and consumed when his free order succeeds. |

Website and native mobile payments:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 25 | `store_products` | Maps Apple/Google app product IDs to the fixed native token quantities. | The mobile product tokens_5 represents five Sahsah tokens. |
| 26 | `store_purchases` | Records each actual native purchase, verified owner, credited quantity and completion progress. | Ali buys five tokens on Android; duplicate confirmation still credits only five. |
| 27 | `payment_attempts` | Tracks attempts to create Paymob website checkout and any uncertain outcome. | A checkout creation times out, so the server saves it for checking. |
| 28 | `payment_provider_references` | Links Paymob's order/intention IDs to Sahsah's internal checkout and order. | Paymob reference X points to Sahsah order 50. |
| 29 | `payment_transactions` | Records actual Paymob money transactions and their verified status. | Paymob transaction TX123 collected 100 EGP. |
| 30 | `payment_events` | Stores authenticated payment notices and server verification results across Paymob, Apple and Google. | Google sends a notice; a server check confirms the purchase before crediting tokens. |
| 31 | `payment_reconciliation_cases` | Keeps payment problems for Admin to investigate and resolve with an audit. | Two real payments arrive for one order; the extra payment opens a case. |

Staff administration:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 32 | `staff_accounts` | Stores separate staff logins and one of two roles: Admin or Super Admin. | Mona manages questions, prices and promotions; Super Admin can also manage staff. |
| 33 | `staff_sessions` | Keeps persistent, revocable AdminJS login sessions. | Mona's unexpired login survives an API restart. |
| 34 | `staff_audit_events` | Records who performed a privileged action, with relevant details and reasons. | The audit shows who granted complimentary tokens and why. |

Support, public pages and background work:

| # | Table | Purpose | Short example |
| --- | --- | --- | --- |
| 35 | `contact_submissions` | Stores Support, Experience and Business/Influencer messages with open/closed status. | Admin reads Sara's support message and marks it closed. |
| 36 | `public_pages` | Stores editable public page content and publication status. | Admin updates the How to Play page. |
| 37 | `public_page_media` | Connects public page image positions to files and alternative text. | How to Play displays a selected illustration. |
| 38 | `site_settings` | Stores shared branding and public contact/social settings. | Admin changes the logo or Instagram link. |
| 39 | `outbox_events` | Saves background tasks so unfinished work can be retried after a restart. | Blur-image generation fails temporarily, then resumes without losing the task. |

Admin manages all operational content/pricing/promotions/support/financial actions. Super Admin additionally manages staff accounts and roles. See [native billing](native-store-billing.md), [the admin policy](../adr/0008-regular-admin-operational-access.md) and [design and implementation status](schema-status.md).

The [quality review](design-quality-review.md) explains the v1.2 improvements. No tables were added: payment evidence, safe deletion, removed-player rules and smaller operational indexes refine the existing model. The [PostgreSQL companions](schema-status.md) are required alongside DBML export.
