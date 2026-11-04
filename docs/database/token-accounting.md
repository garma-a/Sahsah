# Game-token accounting and restoration

Date: 2026-10-26. Product rules through Q48 and the latest no-customer-cashout clarification are recorded. Physical keys/types and ledger mechanisms remain proposals. Source-backed orders/gifts/staff grants, verified settlements and explicit deletion forfeiture are modeled; no runtime has been implemented.

## Accepted product rules

- The signed-in host pays exactly one token for the complete 36-question game, including all participants. Guests join free.
- Lobby creation, reconnect, resuming the same game and changing the host's controlling device cost no additional token.
- A start rejected before the server accepts it charges nothing. Accepting the game, freezing content/players, claiming active accounts and charging the host must be atomic.
- If a started game ends or expires without any question ever opening, automatically restore one token to its original payer.
- Once any question opens, ordinary host ending/departure or inactivity does not automatically restore the token.
- Recover an interrupted game first. For a verified unrecoverable platform failure, staff may restore one token once with a recorded reason and reference to the original charge. Client timeout alone is not proof of failure.
- All paid, gifted, promotional and complimentary tokens share one bank without expiry. Code validity can end without reclaiming previously granted credits. Unclaimed gifts also do not expire.
- Every purchased quantity is 1–20; preset 1/2/5 values are quantity shortcuts. Base price is 100 EGP/token, with quantity discounts followed by one winning gift/promo discount. The order freezes these amounts.
- Valid 100% discounts create accepted zero-cost orders without Paymob. Consume applicable promo allowance and grant once in the acceptance transaction; a free unbound gift waits for verified recipient claim.
- Each code targets an exact fixed 1/2/5 bundle and requires an end date. The same quantity through the custom counter qualifies; another quantity does not.
- There is no customer cash-refund/cash-out feature and no source-lot spending allocation, refund reservation or FIFO/free-first policy. Credits remain in the bank until spent; funding provenance remains for history and exceptional reconciliation.

## Decision table

| Event | Debit / restoration behavior |
| --- | --- |
| Lobby created | No debit |
| Accepted start transaction fails | No committed game charge; no positive restoration |
| Accepted start; response lost | Recover accepted game; do not debit or restore again |
| Same-game resume / host device takeover | No additional debit |
| Host ends/leaves or game expires; zero questions opened | Keep original -1 entry and append one +1 restoration |
| Host ends/leaves or game expires; any question opened | Keep original charge; no automatic restoration |
| Verified unrecoverable platform failure | Staff may append one +1 restoration if that debit has not already been restored |
| Expiry worker repeats / staff retries after automatic return | Return the stored result; no second +1 |

These are game-token movements, not cash refunds through Paymob.

## Proposed ledger structure

`accounts.token_balance` holds the single available whole-token bank, under the account row lock. `token_ledger_entries` is the append-only source of changes and contains each positive credit's authorization. The separate wallet/grant tables were consolidated by [ADR 0007](../adr/0007-consolidate-launch-schema.md). A CHECK cannot prove balance-to-ledger equality. In v1.2, ledger INSERTs are the sole write owner: the database trigger adds their signed amount to the locked account in the same transaction. Accounts begin at zero; direct balance edits and ledger UPDATE/DELETE are rejected. NestJS must not separately change the balance. Full-history reconciliation is a separate maintenance query, not work performed on each movement. See [ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md).

The current draft models four entry kinds:

- `credit`: positive funding with its own unique settled paid/free order source matching recipient/quantity/settlement kind, or a unique reasoned Admin audit source.
- `game_debit`: exactly -1, tied to one game and its signed-in host.
- `game_restoration`: exactly +1, tied to an existing same-host/same-game `game_debit` and a restoration reason.
- `deletion_forfeiture`: one negative entry for the explicitly confirmed remaining bank, linked to the same account/deletion request. A zero bank needs no entry; this is not expiry or cash refund.

Unique `(game_id, entry_kind)` permits one debit and one restoration per game while allowing nongame credits with null game IDs. A typed composite source reference includes account, game, original entry and debit kind, so a restoration cannot reference another account's debit, another game's charge or another restoration. The fixed source-kind discriminator adds a supporting unique key; it serves integrity rather than a new product concept.

An explicit idempotency key is server-namespaced and uniquely stored. A duplicate must match account, source and amount before returning the existing result. Idempotency keys do not authorize credit, and an arbitrary client-supplied amount is not trusted. Positive ledger source FKs bind settled order/recipient/quantity and staff audit directly; proof eligibility, current permission and atomic write paths remain implementation requirements. See [commerce design](commerce-design.md).

## Durable first opening

`games.first_question_opened_at` is set once in the accepted opening transaction, together with question state and exposure. Returning to the board, resetting a timer, changing controller, ending or replaying must never clear it. Replay is a new game with its own marker and debit.

The marker represents a committed server opening, not proof that a person read the response. If the network fails after commit, the same saved question can be recovered; compensation for a truly unrecoverable problem uses the staff path. Do not automatically credit merely because a browser reports a timeout.

## Transaction boundaries

1. **Accepted start:** authorize the host/controller setup, lock consistent resources, recheck claims/freshness/pack validity, copy the board, claim signed-in accounts, insert a unique -1 entry (whose trigger projects the nonnegative bank), and mark the game accepted. Roll back all effects on failure.
2. **Automatic unopened return:** lock/recheck the game and current deadline, finalize its terminal state, release only this game's claims, verify the original host debit and null first-opening marker, insert the unique restoration, letting the same ledger trigger project the bank in that transaction.
3. **Staff restoration:** authenticate permitted staff, verify unrecoverable state and reason, recover first when possible, and finalize/retain a nonresumable failed game together with a matching staff-audit record and unique restoration; its ledger trigger updates the bank. This is a proposed enforcement mechanism for the accepted unrecoverable-failure policy.
4. **Repeated request:** look up the authoritative accepted effect, validate its scope/payload and return it; do not reapply amounts. An existing restoration prevents both automatic and staff paths from creating another.

Never delete the original debit or overwrite a balance to make a restoration invisible. Keep actual provider reversals for internal Admin reconciliation; any exceptional adjustment needs its own authorized/audited integration rule. Do not add ordinary cash-refund APIs, source-credit spending allocation or reserved wallet balances. See [the current bank scope](../adr/0006-one-bank-without-customer-cashout.md).

## Reads and indexes

- Bank balance: `accounts` primary key; lock that account for token mutations.
- Account movement history: `(account_id, created_at, id)` for deterministic cursor pages.
- One debit/restoration per game: unique `(game_id, entry_kind)`.
- Restoration provenance: supporting typed-source unique key and its composite FK.
- Expired games: partial `(idle_expires_at, id) WHERE status='active'`, followed by fresh-clock checks under the game lock.

These indexes protect named invariants or read paths; performance and wallet/ledger reconciliation still require implementation tests and realistic data. See [lifecycle transactions](lifecycle-transactions.md) and [query planning](query-plan.md).

Native extension: a positive order credit may also reference a `native_store` settlement verified against Apple/Google evidence. `accounts.token_balance` and the same ledger remain authoritative. Native completion means delivery to that bank and is retried after credit; it does not wait until game tokens are spent. Game debit/restoration rules do not change. See [native billing](native-store-billing.md).

## v1.2 executed checks

The [local suite](validation/README.md) tests source-backed credit, direct-edit rejection, append-only history, duplicate credit, settlement/delivery atomicity, concurrent last-token starts, eligible deletion forfeiture and confirmation invalidation. Companion source guards check audited grants, original game debit, terminal/unopened restoration eligibility and exact confirmed forfeiture. This is reference SQL validation; API authorization and full game-start correctness still require backend tests.
