Historical guide for the expanded 61-table model. The [current guide](../table-guide.md) describes the consolidated model.

**Sahsah database: every table in simple words**

This guide explains all 61 tables in the current [DBML draft](sahsah-v0.9-expanded.dbml). It explains the proposed design; [design sign-off remains pending](../schema-status.md). Examples illustrate behavior and do not set additional prices, discounts or product rules.

One important distinction: a **room** is the reusable place people join; a **game** is one paid round of 36 questions inside that room. Replaying creates another game in the same room.

The question library and its media:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 1 | `categories` | Groups packs under names players can browse. | Football contains many football packs. |
| 2 | `question_packs` | Stores each pack's category, number and availability. | Football pack 7 is published and selectable. |
| 3 | `questions` | Stores each question's wording, answer and format under a stable identity. | A question asks who won the 2010 World Cup; its answer is Spain. |
| 4 | `pack_questions` | Assigns questions to the six current positions in a pack, allowing replacement while preserving old history. | Pack 7, position 2 now uses a newly authored question. |
| 5 | `media_assets` | Records where each image/audio file lives in Cloudflare and whether it is ready. | An uploaded player photo is ready for use. |
| 6 | `question_media` | Explains how a question uses a particular file. | One photo is the question image; another is shown with the answer. |
| 7 | `question_hint_stages` | Stores the three blur/zoom stages and their suggested points. | A 600-point image question offers stages worth 600, 400 and 200. |

Player accounts and phone verification:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 8 | `accounts` | Holds the player's permanent identity, display name, verified Egyptian phone and language. | Ali uses Arabic and has a verified WhatsApp number. |
| 9 | `firebase_identities` | Connects a Firebase login identity to the correct Sahsah account. | Ali signs in on another phone and reaches the same Sahsah account. |
| 10 | `phone_verification_challenges` | Tracks short-lived verification requests, expiry and allowed attempts. | Sara must enter her WhatsApp code before the request expires. |
| 11 | `account_phone_changes` | Records completed phone changes and the verification/support evidence behind them. | Ali changes his number while keeping his tokens and progress. |
| 12 | `account_deletion_requests` | Records deletion consent and the exact token balance the player agrees to forfeit. | Ali confirms deleting his account and forfeiting its remaining three tokens. |

Rooms, invitations and reconnecting:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 13 | `rooms` | Holds the reusable lobby, its owner and team names. | Ali opens a room for up to six people, including himself. |
| 14 | `room_invitations` | Records each issued invitation code, its expiry and any revocation. | Ali rotates code 012345; its old issuance becomes revoked. |
| 15 | `room_invitation_codes` | Maps each currently registered code to one room, preventing code collisions. | Entering 012345 finds the room currently assigned that code; admission also checks expiry. |
| 16 | `room_memberships` | Records who belongs to the room and their next-game team/readiness choices. | Sara joins Team A and presses Ready for the next game. |
| 17 | `room_member_credentials` | Stores a protected reconnect credential for an anonymous member's seat. | A guest refreshes the browser and returns to the same seat. |

The game board, question state and scoring:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 18 | `games` | Records one accepted game, its lifecycle and inactivity deadline. | Ali starts game 1; a replay later becomes game 2. |
| 19 | `game_packs` | Records the six packs selected for that particular game's board. | Board column 1 uses Football pack 7. |
| 20 | `game_question_slots` | Keeps the starting copy of each of the game's 36 questions, protecting play from later catalog edits. | Staff correct an answer during play; this game keeps its starting copy. |
| 21 | `game_question_media` | Keeps references to the exact files copied into a game, protecting them from premature deletion. | This game retains its original photo after staff upload a replacement. |
| 22 | `game_teams` | Stores the two teams and their current total scores for this game. | Team A has 800 points and Team B has 600. |
| 23 | `game_runtime` | Records which question is currently open, or whether the host is on the board. | Everyone's authorized view follows the host to Football's 400-point tile. |
| 24 | `game_question_states` | Saves each question's timer, hint stage, reveal and memory progress. | Returning to the board preserves the question's remaining 35 seconds. |
| 25 | `game_question_resolutions` | Records the host's final decision for each question exactly once. | Team B earns 400 points, or the host selects no winner. |
| 26 | `game_score_entries` | Keeps the history of awards and manual score changes so totals can be explained. | Correcting Team A from 800 to 600 records a -200 adjustment. |
| 27 | `game_host_control` | Identifies the authorized host device and rejects commands from an older controller. | Ali takes control on his laptop; his old phone loses control. |
| 28 | `game_host_command_receipts` | Remembers accepted commands so a network retry does not repeat their effects. | The same retried score correction returns its saved result. |

Participation and player progress:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 29 | `game_players` | Preserves the starting roster, names and teams for one game, including anonymous players. | Sara started on Team A; disconnecting does not remove her historical seat. |
| 30 | `active_account_games` | Ensures a signed-in account participates in only one active game. | Sara must leave her current game before entering another. |
| 31 | `account_question_exposures` | Remembers which question identities an account has seen, helping select fresh packs. | Sara has seen one question in pack 7, so the group is offered a wholly unseen pack first. |
| 32 | `account_pack_completions` | Records completion when all six questions in a pack are resolved within one game. | Resolving all six Football questions credits eligible signed-in players. |

The token bank and shop prices:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 33 | `token_wallets` | Holds each account's single available token balance. | Ali sees seven tokens from all sources together, with no expiry. |
| 34 | `token_ledger_entries` | Records every token addition or deduction so the balance can be checked. | Starting a game records -1; restoring an unopened ended game records +1. |
| 35 | `token_credit_grants` | Records the authorized reason for a positive credit and prevents crediting that source twice. | One completed five-token order authorizes one five-token grant. |
| 36 | `token_shop_settings` | Holds shared pricing settings, including the editable base token price. | Super Admin sets the base price to 100 EGP per token. |
| 37 | `token_bundles` | Defines the fixed bundle quantities shown as shortcuts and targeted by promos. | The shop offers the fixed 1-, 2- and 5-token choices. |
| 38 | `token_price_tiers` | Defines editable quantity discounts shared by preset and custom quantities. | If staff configure a 5+ tier, choosing five by either selector receives it. |

Orders, promotions and gifts:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 39 | `token_orders` | Saves what was ordered, its buyer/beneficiary and the agreed quantity and price. | Ali orders five tokens; a later price edit does not reprice his order. |
| 40 | `promotions` | Defines promo codes and automatic free campaigns, including bundle scope, end date and limits. | A welcome code gives 100% off the one-token bundle until its end date. |
| 41 | `promo_usages` | Tracks reserved, consumed or released campaign allowances to prevent overuse. | Ali's welcome allowance is consumed when his free order is accepted. |
| 42 | `gifts` | Records a gift order's recipient phone and claim details. | Ali buys tokens for Sara; if she has no account, the gift waits for her verified claim. |
| 43 | `gift_phone_corrections` | Preserves audited staff corrections to an unbound gift's recipient phone. | Super Admin fixes a mistyped number after verifying the buyer's request. |

Payments and checking payment problems:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 44 | `payment_merchant_accounts` | Identifies the payment-provider account and test/live environment behind a payment. | A test Paymob transaction remains separate from a live transaction with the same provider ID. |
| 45 | `payment_attempts` | Tracks each attempt to create a checkout for a positive-price order. | Ali opens Paymob checkout for his one-token order. |
| 46 | `payment_provider_references` | Connects Paymob's order/intention identifiers to the correct local checkout and order. | A Paymob order reference maps back to Sahsah order 50. |
| 47 | `payment_transactions` | Records actual provider money transactions and their verified financial state. | Paymob transaction TX123 collected 100 EGP. |
| 48 | `payment_receipts` | Saves verified incoming payment notifications for reliable processing and duplicate handling. | Paymob sends a success notification twice; the exact duplicate is recognized. |
| 49 | `payment_verification_events` | Records the trusted payment observations used as evidence for decisions. | An authenticated Paymob inquiry confirms TX123 succeeded for 100 EGP. |
| 50 | `token_order_settlements` | Records the one accepted funding result for an order, including valid free orders. | Order 50 is accepted as funded once, even if two separate payments arrive. |
| 51 | `payment_reconciliation_cases` | Gives Super Admin a persistent list of financial exceptions to investigate. | A second real payment for an already funded order opens a case. |

An ordinary successful purchase connects these records: order → verified payment → settlement → credit grant → token ledger entry → updated bank. Each step answers a different question: what was bought, what money arrived, what funding was accepted, why tokens were authorized, what balance movement occurred, and what is available now. A valid free order uses local settlement without a provider payment.

Staff access and accountability:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 52 | `staff_roles` | Defines which staff responsibilities are available. | Content Admin manages questions; Super Admin also manages prices and financial actions. |
| 53 | `staff_accounts` | Holds separate staff login identities for AdminJS. | Mona signs into AdminJS using her staff email and password. |
| 54 | `staff_audit_events` | Records who performed a privileged action and its relevant details. | The audit records who changed the token price and when. |
| 55 | `staff_sessions` | Keeps staff login sessions in PostgreSQL so application restarts do not erase them. | Mona's unexpired AdminJS session survives a NestJS restart. |

Feedback, support, public content and background work:

| # | Table | Why it exists / purpose | Short example |
| --- | --- | --- | --- |
| 56 | `question_feedback` | Keeps the host's current Like/Dislike for a particular question in a game. | Ali dislikes an unclear question; staff can inspect its retained game copy. |
| 57 | `contact_submissions` | Stores Support, Experience and Business/Influencer submissions in the admin inbox. | Sara submits a support message; Super Admin later marks it closed. |
| 58 | `public_pages` | Stores editable informational page content and publication status. | Content Admin updates the How to Play page. |
| 59 | `public_page_media` | Connects public page image slots to their files and alternative text. | The How to Play page uses a particular illustration. |
| 60 | `site_settings` | Holds shared branding and public contact/social settings. | Staff change the logo or Instagram link in one place. |
| 61 | `outbox_events` | Saves background work alongside the change that requires it, allowing retries after a restart. | A saved image upload schedules blur-image generation; unfinished work is retried. |

The tables most often used by gameplay are the catalog, room, game and progress tables. The other tables support checkout, staff operations, reliable retries and the public app. A single gameplay action uses the relevant subset.
