# Group-aware pack selection and progress

Date: 2026-10-24. Status: Q7/Q10/Q11 and Q13–Q20 product policies accepted; storage/query mechanisms remain a draft. Mathematical examples below are constructed scenarios, not observed player behavior.

## Accepted boundaries

- AdminJS authors fixed packs of six question records inside a category.
- A 36-question game chooses one pack from each of six categories. Game tokens include published pack access.
- Staff review semantic duplicates manually; automatic duplicate detection/warnings are explicitly outside the current scope.
- A game has at most six people total, including the host. Guests can participate without accounts.
- All six question resolutions in the same game, including no-winner outcomes, are required for completion; attempts from different games do not combine.
- Track signed-in starting players even during network loss; explicit guest departure stops future credit. Anonymous sign-in mid-game begins account progress next game.
- Prefer group-fresh packs, with an explicit host choice before repeats if fresh inventory is unavailable. Freeze the playing roster at start; original players may reconnect.
- Public packs remain editable after warning/confirmation, and games retain their starting content. Edits keep question identity; replacements use new question identities in the same pack. Old completions remain visible with an Updated flag on changed current packs.

## Compare the two ideas

| Idea | What it accomplishes | Limitation |
| --- | --- | --- |
| Choose a pack unseen by any signed-in player | Can avoid previously encountered stored questions for the tracked group | Requires histories, precise exposure/membership rules and an exhaustion policy; anonymous people have no persistent account history |
| Give each account different pack numbers/order | Changes presentation and may distribute casual choices | Number changes alone do not establish unseen content; two differently numbered packs may contain the same questions |
| Rebuild pack contents independently per account | Produces different personal bundles | Changes the accepted fixed authored-pack model; a shared game still chooses one actual set and needs group history checks |
| Recommended combination: stable authored content plus group-aware choice among eligible packs | Preserves the editorial model and can randomize/tie-break between fresh packs | Must disclose lack of fresh inventory rather than silently claim a repeated pack is new |

Use stable internal pack and question identities. A visible pack number is presentation, not proof of novelty. Showing a different number must not reset progress or make stored content “unseen.” Ordinary edits do not produce a new logical question; explicit replacement does. Public packs are editable, while each accepted game preserves its starting snapshot.

Under manual duplicate review, even perfect identity-based history cannot recognize that staff created equivalent text/image clues as a new question record. Do not promise semantic novelty that this agreed scope cannot enforce.

## Exposure and completion are different

A player can see four questions and leave without completing the pack. Checking completed packs alone would permit those four questions again. The accepted model therefore distinguishes:

- **Exposed question:** question opened for an eligible signed-in starting participant, even if temporarily disconnected.
- **Completed pack:** all six questions resolved within one game while the player remains eligible for completion credit.
- **Wholly unseen pack:** none of its questions appear in the relevant exposure history.
- **Group-eligible pack:** wholly unseen for every tracked member, and not excluded by an applicable active allocation.

For example, 16 packs, two completed and three partially encountered means 14 not completed but only 11 wholly unseen. “Remaining” should not conflate those counts. Account progress and group eligibility are separate views.

The server records opening/release, rather than trying to prove a human looked at a screen. Temporary disconnection preserves credit; explicit departure ends future credit. Anonymous exposure is not backfilled on mid-game sign-in.

## Accepted eligibility policy

For pack `p`, let `Q(p)` be its six question identities. For each tracked account `u`, let `E(u)` be its exposed question identities. The basic rule is:

```text
fresh_for_group(p, G) = Q(p) has no intersection with the union of E(u) for u in G
```

Do not randomly mix questions from different packs to repair a conflict unless the user deliberately changes the authored-pack model. If the host selected a conflicting pack, select or propose another eligible pack according to the final user-facing policy before accepting game start.

The user selected the following policies for the checked group and time:

1. Freeze the roster at start; new players join the next game while original players can reconnect.
2. Opened questions create exposure for eligible signed-in starting players, and all-six resolution creates completion in that same game.
3. Resume preserves the same game; a new game uses a full pack and repeat acceptance when required. Partial resolutions across games do not combine.
4. Use one active game per signed-in account. Explicit guest withdrawal ends future exposure/credit before releasing the account's active-game claim, preventing old-game/new-game freshness races.
5. Account binding freezes at start; signing in mid-game does not backfill history. Ordinary edits preserve identity; replacement creates a new ID while saved games keep starting content.

These are accepted product policies, not implemented database guarantees. Q21–Q28 subsequently finalized host end/leave, 24-hour gameplay inactivity expiry and token restoration; deletion and media retention still need decisions. Expiry/terminal cleanup releases claims while preserving existing exposure/completion; it does not mark unplayed questions seen. An unopened game may return its token while its packs remain group-fresh.

## Inventory math and exhaustion

The latest example, 20 categories with 100 questions each, contains 2,000 questions. The earlier launch estimate was approximately 4,000. Treat the former as illustrative unless the user changes the launch target.

| Uniform inventory | Complete packs per category | Total complete packs | Questions in complete packs | Loose questions |
| --- | --- | --- | --- | --- |
| 20 categories × 100 questions | 16 | 320 | 1,920 | 80 |
| 20 categories × 200 questions | 33 | 660 | 3,960 | 40 |

Loose questions cannot form a published six-question pack on their own. Actual usable variety is determined per category, not by total site-wide question count.

Concrete exhaustion example: a category has 16 packs. The host previously encountered packs 1–8; one signed-in guest encountered packs 9–16. Each person has eight unseen packs, but **the group has zero wholly unseen packs**. Six people with diverse histories can exhaust a category even sooner than an individual does.

As a separate illustrative model, if a category has `P` packs and each of `n` accounts independently encountered fraction `f`, expected wholly unseen packs are:

```text
expected eligible packs = P × (1 − f)^n
```

For 16 packs and six accounts, a 25% encountered fraction gives approximately 2.85 group-fresh packs; 50% gives 0.25. These are expectations under independent histories, not guaranteed availability. Friends who previously played together have correlated histories; disjoint histories can be worse.

Q7 accepted fresh-first selection, with an explicit host choice to change category or accept repeated content when none is fresh. Recheck that acceptance against the actual selected content and fixed roster at game start rather than silently applying it to a different pack/group.

## Proposed persistence and queries

The current structural draft evaluates:

- Stable questions with a current owning pack, separate current slot membership, and historical game snapshots.
- An account/question exposure summary keyed by `(account_id, question_id)`; record first exposure once and retain detailed per-game evidence only where needed.
- Game membership fixed at start, with nullable account identity and an explicit departure marker.
- Historical account/game/pack completions plus a later rebuildable display projection, preserving Updated status after replacements.
- One durable active-game claim per signed-in account.

For at most six tracked accounts, a category's current packs can be checked with a set-based anti-join over their current question identities and indexed exposures. Avoid fetching every account's full history into Node or issuing one query per pack. The exact SQL and final indexes still need representative plans; see [query planning](query-plan.md).

Per-user random pack-number mappings and a semantic duplicate-detector table are not required. Exposure, historical completion, roster and active-account-claim tables are now in [the structural DBML](sahsah.dbml). Outcome/runtime and retained-media references are now represented; Q83 preserves compact progress/identities after 12-month copied-content purge.
