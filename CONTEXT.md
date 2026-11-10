# Sahsah

Sahsah is a social trivia game played by two teams under a host's control. This glossary records vocabulary shared by the prototype and the project scope documents.

## Language

**Host**:
The participant who controls the board, question reveal, timer and scoring for a game.
_Avoid_: Admin, moderator, when referring to the person running a game.

**Controlling device**:
The host's current device authorized to run the game; taking over on another device removes the previous device's control.
_Avoid_: Host account, which remains the same when changing devices.

**Guest**:
A participant who joins a host's game without needing to sign in.
_Avoid_: User, when an account is not implied.

**Player**:
One of the people participating in a game, including its host; a game has at most six players in total.
_Avoid_: Guest, when the host is included in the count.

**Viewer**:
A participant other than the host who watches the shared gameplay without operating game controls or playing question audio. A viewer may join anonymously or with an account and counts toward the six-player limit.
_Avoid_: Guest, when describing viewing permissions rather than sign-in status.

**Lobby**:
The room's preparation stage before its next game, where participants choose teams and confirm readiness while the host prepares the board.

**Lobby setup**:
The host's selected categories/question packs and team setup prepared for the room's next game.
_Avoid_: Game board, before a game has started.

**Ready confirmation**:
A non-host participant's agreement to join the room's next game with its current meaningful setup. Changes to selected content, the roster or team assignments require everyone to confirm again.

**Team**:
One of the two competing sides in a game, with its own name and score, whether or not a player has connected to that side.

**Neutral host**:
A host who controls the game without belonging to either competing team.

**Game**:
One play through a trivia board, ending with a result or an early finish.
_Avoid_: Session, when it could mean an invitation room or a signed-in session.

**Room**:
The invitation space in which a host and guests can stay together across multiple separate games; a host has at most one open room.
_Avoid_: Game, when referring to the shared invitation space.

**Board**:
The game's six selected categories and their six question tiles each, for 36 tiles in total.

**Category**:
A selectable grouping of question packs, such as Football.

**Question format**:
The presentation and interaction of an individual question, such as text, image or audio. A pack may mix formats.
_Avoid_: Category, when describing how a question is presented.

**Question pack**:
An authored set of exactly six questions within one category.
_Avoid_: Package, when it could mean a token shop offering.

**Draft pack**:
A pack staff are still preparing, which may be incomplete and is unavailable for new games.

**Published pack**:
A playable pack whose six questions and required content/media are valid and ready. Staff may edit it after the public-edit warning.

**Archived category or pack**:
Content hidden from selection in new games while existing games and progress are preserved. Archiving a category hides its packs without changing their own publication status.

**Hint stage**:
One of three progressively clearer blur/zoom views with positive decreasing suggested points, beginning at the tile's original value.

**Invitation code**:
A six-digit code for entering a room, valid for 24 hours from issue unless rotated earlier. Its expiry does not end an existing game.
_Avoid_: Reconnect credential, which proves an existing guest's identity.

**Guest reconnect credential**:
A private credential retained by an anonymous player's browser or app to restore their existing seat after refresh or restart.

**Completed pack**:
A pack whose six questions have all been resolved for progress credit, including questions resolved with no winning team.

**Question resolution**:
The host's final decision to award a question to one team or to neither team.

**Exposed question**:
A question opened for an account in a game it participates in, including while its device is temporarily disconnected.
_Avoid_: Completed question, when only previous exposure is meant.

**Group-fresh pack**:
A pack whose current questions have not been exposed to any of the game's tracked signed-in players.
_Avoid_: Uncompleted pack, which may already have partially encountered questions.

**Question edit**:
A correction or change that preserves the logical question and its existing seen history.

**Question replacement**:
A new logical question put into an existing pack slot, with its own seen history.
_Avoid_: Typo correction, when the content is meant to be a new question.

**Updated pack**:
A previously completed pack containing replacement questions that are not automatically credited by the earlier completion.

**Explicit departure**:
A player's deliberate action to end participation, preserving earlier progress while stopping future exposure and completion credit.
_Avoid_: Disconnect, which may be temporary and preserves participation.

**Expired game**:
A game whose 24-hour window since the last meaningful host gameplay action has elapsed, ending its opportunity to resume.

**Game token**:
A unit of access that pays for starting one complete game; continuing that game does not spend another token.
_Avoid_: Coin, currency, points.

**Token product**:
A shop offering for purchasing a quantity of game tokens.
_Avoid_: Question pack.

**Token restoration**:
The return of one previously spent game token to its original host account, either because no question was opened before ending or for an approved unrecoverable platform failure.
_Avoid_: Cash refund, which returns money for a purchase.

**Gift**:
A paid or valid zero-cost token order for a recipient identified by verified phone, credited to the bound recipient account rather than the purchaser. Unclaimed gifts do not expire.

**Complimentary credit**:
Nonexpiring game tokens granted by authorized staff with a recorded reason.
_Avoid_: Game restoration, which compensates a particular original game charge.

**Order**:
A buyer's purchase of a priced quantity of game tokens, for themselves or an eligible gift recipient.

**Buyer**:
The signed-in account purchasing an order, including when its tokens are intended for someone else.
_Avoid_: Recipient, when referring to who pays or uses a promo code.

**Beneficiary**:
The account entitled to receive an order's or staff grant's tokens.
_Avoid_: Buyer, when a gift belongs to another account.

**Quantity discount**:
A discount determined by the number of tokens purchased, applied equally through presets and the custom counter.

**Additional discount**:
The single winning eligible gift or promo discount applied after the quantity discount.

**Promo redemption**:
A successful use of the actually applied promo code on a buyer's accepted paid or zero-cost order, including when its tokens are a gift.

**Zero-cost order**:
An order reduced to zero by valid configured discounts, issuing its tokens without a Paymob payment.

**Free campaign**:
A dated allowance for an exact fixed token bundle, limited per buyer and optionally across all buyers, applied automatically or through a code. Recreating an account with the same phone does not reset that campaign’s free allowance.

**Deletion forfeiture**:
The deliberate loss of the exact remaining token bank confirmed by its owner after pending funding has been settled or reviewed, when deleting the account.
_Avoid_: Token expiry, cash refund.

**Retained game content**:
The game's original copied question text and media, available for 12 months after ending before compact results and progress remain. Existing votes remain, while new votes and edits close when that copied content is purged.

**Token bank**:
The account's single combined token balance, containing paid, gifted, promotional and complimentary tokens without expiry.
_Avoid_: Separate expiring balances, when describing the player's bank.

**Payment reversal**:
A confirmed change to a provider payment recorded for internal reconciliation; it is separate from the player's token bank and the game-token restoration flow.

**Token grant**:
Purchased, gifted or complimentary game tokens awarded to an account from an authorized source.
_Avoid_: Game restoration, which returns a particular original game charge.

**Staff account**:
A separate identity authorized to use the staff dashboard under an assigned staff role.
_Avoid_: Player account, even when the same person also plays Sahsah.

**Admin**:
A staff role authorized to manage content, prices, promotions, complimentary credits, support and financial operations.
_Avoid_: Content Admin, which described an earlier, superseded restriction.

**Super Admin**:
An Admin who can also manage staff accounts and staff roles.

**Points**:
The units used to compare team scores during a game.
_Avoid_: Tokens, balance, when referring to the competition score.

**Question award**:
The points granted to one team when the host resolves a question, defaulting to its current hint-stage value and bounded by the original tile value.

**Score adjustment**:
The recorded difference between a team's previous total and a new nonnegative total entered by the host while the game is active. It changes the overall total while preserving question awards and category results.
_Avoid_: Question award, when correcting an overall score.

**Finished game**:
A game with locked scores, reached automatically after its 36th question resolution or by deliberate early ending.

**Answering timer**:
The question's 60-second answering clock, controlled by the host; a memory question starts it when its picture is first hidden.

**Memory revisit**:
Showing a previously hidden memory picture again without starting a new answering period.

**Franco-Arabic**:
Egyptian Arabic written with Latin letters and numerals, used as the game's left-to-right language format.
_Avoid_: English, when referring to Franco-Arabic content.
