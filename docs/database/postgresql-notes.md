# PostgreSQL and DBML research for Sahsah

Researched: 2026-10-23. Status: technical reference for the design interview; recommendations below are conditional, not accepted product decisions. PostgreSQL links are pinned to version 18, with version 17 checked for UUID compatibility. The deployed version and production workload remain unconfirmed. Current design validation uses pinned DBML CLI 10.3.1 and disposable PostgreSQL 18.6; no application migration or deployed benchmark was performed. Older checkpoints below describe their validation at the time.

## Integrity before indexes

- `PRIMARY KEY` and `UNIQUE` create their supporting unique indexes. Foreign keys do **not** automatically index their referencing columns; evaluate these against joins, parent deletion and update paths before adding them.
- Use a composite foreign key when two IDs must belong together. For example, if a score references a team within a game, `(game_id, team_id)` can reference a unique `(game_id, id)` on teams; separate references to a game and team would not establish membership.
- Ordinary uniqueness permits multiple nulls. Use non-null keys or deliberately choose `NULLS NOT DISTINCT`/partial uniqueness when optional identity or provider-reference fields require different semantics.
- `CHECK` constraints cover the current row; they cannot enforce another row's balance or count. Checks evaluating to null pass, so required values also need `NOT NULL`.

These are documented PostgreSQL behaviors; the team/game example is a possible application, not a settled schema. [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Indexes must answer named queries

The following are candidate query shapes, not final index definitions:

| Possible access path | Candidate key shape | Decision needed first |
| --- | --- | --- |
| Host's game history, newest first | `(host_user_id, created_at, id)` | Who owns a game; history retention |
| Eligible question pool | Equality filters followed by selection key | Category, locale, difficulty, mode and repeat rules |
| Exclude previously exposed questions | `(subject_id, question_id)` | Identity of the subject; meaning and lifetime of exposure |
| Ordered accepted actions within a game, if retained | `(game_id, sequence_number)` | Command history and recovery requirements; the current game has no automatic turn model |
| Provider event deduplication | Unique stable provider event key | Provider's actual identifier and retry contract |

B-tree indexes are generally most effective with leading equality filters and then the first range filter. PostgreSQL 18 can use skip scans in some cases; this does not justify ignoring leading columns. [Multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html).

An index matching ordering can avoid sorting and stop early for `LIMIT`. An ascending index can also be read backward; create mixed-direction definitions only when the query needs them. These behaviors motivate history pagination with a deterministic `(created_at, id)` tie-breaker, subject to the final query. [Indexes and ordering](https://www.postgresql.org/docs/18/indexes-ordering.html).

Partial indexes may help small, stable subsets such as published questions or unfinished games. The planner must establish that the query implies the predicate; generic parameterized predicates may prevent that. Test the actual prepared query, and avoid predicates based on a moving clock. [Partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html).

Use `INCLUDE` only when a frequent query benefits from an index-only scan. Visibility-map state still determines whether heap reads are avoided, and wide payloads increase index size. Frequently updated game rows are a less promising starting point than slowly changing catalog rows. [Covering indexes](https://www.postgresql.org/docs/18/indexes-index-only-scans.html).

## Concurrency and retries

Row locks last until transaction end. `SELECT ... FOR UPDATE` can serialize mutations to a shared balance or game state; acquiring multiple locks in a consistent order reduces deadlock risk. Transactions must remain short and applications must handle aborted transactions. [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

`INSERT ... ON CONFLICT DO UPDATE` provides an atomic insert-or-update result. Application inference: a unique provider event/operation key plus transactional state changes can prevent a repeated delivery from granting credit twice. UPSERT alone does not make external side effects idempotent; the duplicate path must not repeat the grant. [INSERT and ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html).

For review after product rules are settled: define transaction boundaries for game creation plus entitlement consumption, answer adjudication plus scoring, and successful payment plus credit issuance. Consider a conditional state/version update for stale commands. These are proposed application mechanisms, not measured implementation claims.

## JSONB boundaries

`jsonb` supports indexing and querying, but PostgreSQL recommends predictable document structures. An update locks the entire row, including when changing a small part of a large JSON document. Conditional recommendation: use ordinary columns/relations for identity, ownership, lifecycle, money and frequently filtered attributes; reserve bounded JSONB for mode-specific payloads or immutable snapshots where appropriate. A GIN index should follow an actual containment/existence query, rather than being added to every JSONB field. [JSON types and indexing](https://www.postgresql.org/docs/18/datatype-json.html).

## Question randomization

`random()` is volatile and can be evaluated for each candidate row. A fresh random ordering should not be treated as a pre-indexed sort order. This is an inference from PostgreSQL's volatility and ordering behavior; its cost for Sahsah must be measured against the filtered pool. [Function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html), [indexes and ordering](https://www.postgresql.org/docs/18/indexes-ordering.html).

`TABLESAMPLE` runs before `WHERE`; it does not promise enough eligible questions after filtering. `SYSTEM` samples blocks and can reflect physical clustering; `BERNOULLI` scans the table. Neither is automatically a fair, exact-size replacement for selecting unseen questions by category/difficulty. Choose a selection strategy after repeat policy, pool sizes and fairness requirements are known. [SELECT: TABLESAMPLE](https://www.postgresql.org/docs/18/sql-select.html).

## IDs and partitioning

PostgreSQL 18 supplies random UUIDv4 and time-ordered UUIDv7 generation. PostgreSQL 17's built-in generator is `gen_random_uuid()` for UUIDv4; do not assume native `uuidv7()` is available on an older target. Decide public IDs, generation location and storage trade-offs explicitly; time ordering is not a benchmark of improved Sahsah performance. [UUID functions: 18](https://www.postgresql.org/docs/18/functions-uuid.html), [UUID functions: 17](https://www.postgresql.org/docs/17/functions-uuid.html).

`bigint GENERATED ... AS IDENTITY` uses an implicit sequence. Identity alone does not enforce uniqueness; pair it with a primary key or unique constraint. [Identity columns](https://www.postgresql.org/docs/18/ddl-identity-columns.html).

Partitioning can support pruning and retention by detaching old data, but brings operational and integrity constraints. A partitioned table's primary/unique constraint must include every partition-key column. This matters for globally unique event IDs and idempotency keys: adding a timestamp to the key may weaken the intended global deduplication rule. Defer partitioning until data volume, retention and query patterns justify it; preserve an explicit global deduplication strategy if later partitioning a payment/event history. [Table partitioning](https://www.postgresql.org/docs/18/ddl-partitioning.html).

## What DBML can express

The current official syntax supports PostgreSQL project declaration, column types, defaults, enums, single/composite primary and unique keys, expression indexes, checks, composite foreign keys and explicit referential actions. Its documented index settings list `btree` and `hash` as supported types. The reference does not document native index predicates, `INCLUDE`, PostgreSQL operator classes or `NULLS NOT DISTINCT` settings. Treat these as capabilities requiring separate SQL specifications and exporter verification, rather than encoding an unconditional unique index that changes the intended rule. Notes describe intent but do not enforce SQL behavior. [DBML syntax](https://dbml.dbdiagram.io/docs/).

The schema deliverable should therefore distinguish DBML-enforced structure from additional PostgreSQL DDL and transaction invariants. Validate with the selected DBML parser/exporter version before claiming the diagram produces executable production DDL.

The first structural draft was parsed/exported on 2026-10-24 using pinned `@dbml/cli@10.3.1` under Node 24. It contains six tables, five foreign keys, three named checks, six primary keys and four unique indexes. This exporter emits foreign keys as `DEFERRABLE INITIALLY IMMEDIATE` and omits the draft label on its composite primary key; production DDL must deliberately specify the intended behavior. Exported SQL was not executed. [Official CLI usage](https://dbml.dbdiagram.io/cli/).

The updated v0.2 draft also exports successfully: thirteen tables, eighteen foreign keys, eleven named checks, thirteen primary keys, six additional unique indexes and three additional nonunique indexes. Its nullable roster-account key supports multiple anonymous people while preventing duplicate signed-in accounts in the same game. Active-game claims and historical completions reference that signed-in membership. Optional exposure provenance uses a nullable game ID with a separate required account FK. These are checked structural definitions; application transaction invariants have not been exercised against PostgreSQL.

Version 0.3, exported/inspected on 2026-10-26, adds lifecycle, controller and ledger structure: sixteen tables, four enums, twenty-three FKs, twenty-eight named checks, sixteen PKs, nine additional unique indexes, five additional nonunique indexes and one inline unique constraint. All FK targets have matching keys/types. Explicit presence checks avoid NULL acceptance for required terminal fields and restoration discriminators; nullable nongame credit references intentionally skip the game-host pair while retaining the wallet FK. No SQL was executed or timing/security/financial invariants tested. [Lifecycle clock/locking research](lifecycle-transactions.md) supplements the structural check.

Version 0.4 adds source-backed commerce: twenty-six tables, eight enums, thirty-six FKs, sixty-four named checks, twenty-six PKs, fourteen additional unique indexes, twelve additional nonunique indexes and ten inline unique constraints. All thirty-six referenced keys/types match. Required grant/source fields prevent NULL bypass of positive-credit provenance; paid grant/order and ledger/grant recipient/quantity membership are explicit. Exact numeric casts and monetary rounding expressions export intact. This remains parser/export plus structural inspection, not executed financial/permission/concurrency validation. [Commerce design](commerce-design.md) records the remaining provider/transaction gaps.

Version 0.5 exports twenty-seven tables, eight enums, thirty-seven FKs, sixty-nine named checks, twenty-seven PKs, fourteen additional unique indexes, twelve additional nonunique indexes and ten inline unique constraints. All referenced types/keys match. Zero-cost acceptance is distinct from positive paid settlement; reviewed marker/amount checks have no NULL bypass. A released promo use cannot retain a consumption timestamp. The latest [single-bank scope](../adr/0006-one-bank-without-customer-cashout.md) excludes source-lot balances, spend allocations and refund-reserved wallet amounts; none remain in this draft. Existing credit provenance and once-only game restoration remain. Export/structural validation is not a database execution or concurrency test.

Version 0.6 exports thirty-two tables, ten enums, forty-seven FKs, ninety-four named checks, thirty-two PKs, eighteen additional unique indexes, twelve additional nonunique indexes and ten inline unique constraints: seventy-two expected index structures. All referenced keys have exact matching arity/types and full PK/UNIQUE support. Current-question and award-source optional position pairs are guarded, and reviewed timer running/deadline and elapsed/zero checks have no NULL bypass. Source-lot allocation/reserved-wallet identifiers remain absent. [Gameplay design](gameplay-design.md) separates row constraints from exact tile caps, one running current question, matching award values and score conservation under game-serialized transactions. No SQL execution or runtime/performance validation was performed. Exporter caveats remain unchanged.

## Required validation after the interview

Checkpoint v0.9 (2026-10-27) exports 61 tables, 34 enums, 109 FKs, 229 named checks, 61 PKs, 37 additional UNIQUE indexes, 41 nonunique indexes and 29 inline UNIQUE constraints: 168 DBML index structures, plus three proposed partial indexes in [supplementary SQL](postgresql-supplement.sql). All referenced key types/arity/uniqueness match. Typed payment/capture funding excludes refund/void sources; positive grants additionally require settlement. Reviewed free-campaign, source, optional-proof and purge-marker checks have no combined NULL bypass. Generic audit targets use canonical text keys to cover UUID/singleton/composite resources. Closure proof eligibility, exact monetary truth, cross-row counts/conservation and authorized transitions are processing invariants, not FK claims. No SQL was executed.

Checkpoint v0.8 (2026-10-27) exports 43 tables, 18 enums, 71 FKs, 145 named checks, 43 PKs, 24 additional unique indexes, 22 nonunique indexes and 16 inline UNIQUE constraints: 105 expected index structures. All FK arities/types/target keys match. Phone and invitation regex escaping exports correctly. Media readiness has explicit required-value checks, and composite room references prevent cross-room membership/pointer mismatches. The active-account room-membership partial unique index remains supplementary DDL. This is a static parser/export inspection, not executed PostgreSQL or a performance test.

Build a query inventory with predicates, ordering, result sizes and frequency. Test realistic published/draft ratios, category skew, accumulated exposure history and concurrent game/payment commands. Inspect `EXPLAIN (ANALYZE, BUFFERS)` for representative reads; `ANALYZE` executes the statement, so write experiments belong in disposable data or suitable rolled-back transactions. Plans depend on statistics, data and environment. No index list can establish production performance without these measurements. [Using EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html).

## Executed v1.2 checkpoint, 2026-11-03

The current DBML export plus [partial indexes](postgresql-supplement.sql) and [guards](postgresql-guards.sql) load on disposable PostgreSQL 18.6. Catalog inspection finds 39 tables, 37 enums, 87 FKs, 304 CHECKs and 148 indexes including 19 partial indexes. Exact FK types/arity/unique targets also pass structural inspection. [The reproducible suite](validation/README.md) records positive/rejected source and transition checks, separate-connection races and synthetic EXPLAIN/footprint comparisons.

[ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md) assigns bank writes to the ledger INSERT trigger. Financial/current-history invariants use focused immediate/deferred guards rather than invalid cross-row CHECK expressions. Verification facts are immutable observations, not globally unique states: an identical state can recur after a reversal. Transport identities and order/ledger sources control duplicate effects. Old static-only checkpoints above do not describe the current validation status. Deployed game capacity and real provider integration remain unmeasured.
