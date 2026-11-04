# Game lifecycle, host control and transactional expiry

Researched 2026-10-26 against PostgreSQL 18 primary documentation. Product rules below come from the design interview; technical mechanisms are recommendations for the draft schema. The v1.2 review adds executed disposable SQL/reference tests and companion transition guards. No server implementation, application migration or deployed security/availability/throughput guarantee is claimed.

## Accepted product rules

- **Q21–24:** deliberate host departure ends the game for everyone; temporary disconnect/app closure preserves resume until expiry. End game is final. Expire after 24 hours without meaningful host gameplay activity. The same host account may explicitly take control from another device, with one controlling credential at a time and no extra token.
- **Q25–26:** the host pays one token and guests play free. Ending/expiry automatically returns one token only if no question was ever opened.
- **Q27–28 and later bank clarification:** recover the saved game first; staff can restore one token once for a verified unrecoverable platform failure with a reason. All token sources share one bank without expiry. The current product excludes customer cash-out/normal purchase refunds; provider reversal facts remain internal reconciliation work.

## Clock and deadline semantics

Store activity/deadline instants as `timestamptz`; PostgreSQL stores these as UTC instants and uses the session timezone for presentation. Display in `Africa/Cairo` without hard-coding an offset. [Date/time types](https://www.postgresql.org/docs/18/datatype-datetime.html).

Recommend `idle_expires_at = last_gameplay_at + interval '24 hours'` for 24 elapsed hours. `interval '1 day'` follows calendar-day arithmetic and can differ across daylight-saving changes. `now()`/`CURRENT_TIMESTAMP` use transaction-start time; `statement_timestamp()` uses command receipt; `clock_timestamp()` returns the current instant when evaluated. A transaction waiting for a game lock can therefore hold an outdated `now()`. Sample `clock_timestamp()` **after** acquiring the lock, preferably in a subsequent statement, and use that captured value for the decision and timestamps. Calling it somewhere in the locking query does not itself document evaluation after the wait. [Date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html).

Technical recommendation: initialize activity/deadline when the paid game is accepted, using a fresh clock after its required locks. Refresh activity only for an explicitly enumerated, successfully accepted host gameplay command. Heartbeats, polling, reconnects and controller takeover alone should not silently extend gameplay inactivity. The final command list still needs specification. A deadline already reached must be checked before any renewal; a late command must not revive an expired game.

## Serialize authoritative transitions on the game row

Use the same game-row lock discipline for activity renewal, question opening/resolution, deliberate host end, guest departure, controller takeover and expiry. Within a short transaction:

1. Authenticate the caller as appropriate, lock the game row, then obtain a fresh database clock value.
2. Recheck stored lifecycle, deadline, actor participation and current controller authority under that lock; do not trust a cached socket authorization or a pre-lock deadline check.
3. If already terminal, return its existing result. If its deadline has been reached, finalize expiry instead of applying new gameplay or takeover.
4. Otherwise apply the accepted action. A meaningful host action updates both activity and deadline from the same captured instant. Commit before publishing success/events.

Row locks prevent conflicting writers until transaction end. Under Read Committed, a waiting `SELECT ... FOR UPDATE` can return the newer committed row; inspect that returned state. Stronger isolation may produce retryable serialization failures. This is a proposed application discipline, not something a foreign key supplies. [Row locking](https://www.postgresql.org/docs/18/explicit-locking.html), [isolation behavior](https://www.postgresql.org/docs/18/transaction-iso.html).

For takeover, retain a durable, increasing `controller_generation` and only a hash of the current opaque, high-entropy controller credential. An authenticated same-host takeover rotates the credential and increments the generation under the game lock; subsequent mutations must match the stored generation and credential hash. A device ID or generation alone is not a secret. A command serialized before takeover may complete first; a later stale-controller command is rejected. Closing an old socket is a convenience, not the authority check. PostgreSQL documents strong random bytes and SHA-256 hashing in optional `pgcrypto`; generating/hashing in the application can avoid requiring that extension. [pgcrypto](https://www.postgresql.org/docs/18/pgcrypto.html).

## Finalization, account claims and token restoration

Question opening must durably set `first_question_opened_at` once, alongside the question transition and exposure writes. Never reset this marker when questions close, scores change, a controller changes or the game ends. Publish question content after commit. A failure between commit and client delivery must not silently erase this evidence; its compensation policy follows Q27: recover first, then controlled staff restoration for a verified unrecoverable failure.

On the first terminal transition, perform all applicable writes in **one transaction**:

- Record terminal status, reason and time, preserving historical roster, snapshots, exposure and completion.
- Clear only `accounts.active_game_id` pointers matching this game, together with their claim timestamp. A guest-only departure clears only that guest's matching pointer. The account row also owns its token balance.
- When `first_question_opened_at IS NULL`, create a once-only positive token reversal tied to the original host's game-start debit. Enforce one restoration per game with a same-account/same-game typed reference to its original debit, and update the stored balance projection in the same transaction. The restore recipient is the original payer; takeover/resume creates no second debit.

Returning an existing terminal result must not repeat the restoration. Conditional matching by game ID prevents old cleanup from deleting a claim now owned by a different game. PostgreSQL transactions commit their effects together, while unique keys provide the proposed duplicate-reversal guard. The ledger guards original debit/once-only restoration, while settled purchase/gift provenance and staff audit linkage now have explicit records. Paid token restoration preserves the no-expiry treatment. [Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), [uniqueness constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

An expired claim discovered during new-game preflight can be finalized in its **own short old-game transaction**, followed by a fresh new-start attempt. Do not acquire an old-game lock while already holding new-game/account locks in an ad hoc order. Recheck claims during start because preflight is advisory; if another valid game now owns a claim, reject/retry as appropriate without a debit. Define consistent resource ordering for remaining paths and handle deadlock/serialization retries.

An account primary key enforces at most one claim and a membership FK binds it to a roster entry. Neither proves that its game remains active or that every terminal game released its claims. PostgreSQL `CHECK` constraints cannot maintain cross-table conditions, and time passing does not trigger row checks; enforce these transitions through the shared transactional path. [Constraint limits](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Bounded background expiry and indexes

The v1.2 supplement selects partial `(idle_expires_at, id) WHERE status = 'active'` for active expiry and removes its full-history alternative. Worker SQL explicitly implies that predicate; generic parameterized status predicates may prevent its use. A local small-active-set plan may instead use active-room uniqueness and a small sort; see the recorded measurements. A partial predicate based on `now()` is invalid because index expressions/predicates require immutable functions. [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html), [partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html), [index restrictions](https://www.postgresql.org/docs/18/sql-createindex.html).

Sample a database clock cutoff for the candidate query and bind it as a parameter, rather than assuming a volatile per-row clock expression will form an efficient index range. Select a bounded, ordered batch with `FOR UPDATE SKIP LOCKED`, retain those locks through finalization/claim cleanup/restoration, and recheck each locked row against a freshly sampled clock and stored deadline. Keep transactions short and repeat batches; batch size and scheduling require measurement.

`SKIP LOCKED` omits busy rows and produces an inconsistent queue view. It is appropriate for competing maintenance consumers, not for deciding whether a specific game is live; it does not provide fairness or an exact expiry-time guarantee, and table-level lock waits can still occur. Retry skipped rows in later sweeps and monitor overdue backlog. [SELECT locking behavior](https://www.postgresql.org/docs/18/sql-select.html).

Every authoritative request must also enforce its game's deadline, so a delayed/stopped worker does not permit continued gameplay after expiry. Cleanup/restoration can still be delayed until a worker or request finalizes the row. Socket disconnect events and process-local timers alone cannot serve as durable lifecycle authority.

## Current enforcement boundary

The PostgreSQL guards make first opening, terminal results and question resolution sticky. Ledger source validation covers once-only eligible restorations; the ledger trigger projects bank changes. The full game engine still owns coherent 36-row start/resolution, score/progress updates, host/controller authority, deadlines and claim cleanup under the documented locks. [The SQL suite](validation/README.md) exercises selected histories and races; it is not an implementation of those endpoints.
