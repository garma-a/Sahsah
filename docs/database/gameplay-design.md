# Sahsah gameplay state and scoring

Status: accepted Q49–Q60 behavior; Q74 defines replay readiness. The [Drizzle/PostgreSQL foundation](implementation-status.md) is implemented, while the gameplay engine remains unimplemented. API-Q5 accepted the remaining reset/navigation interactions on 2026-11-05; [the API design session](../api/design-session.md) records the current contract work.

## Accepted behavior and prototype differences

| Subject | Accepted behavior | Evidence / decision |
| --- | --- | --- |
| Normal answering timer | Starts automatically with 60 seconds; host may pause/reset | Q49; [current automatic start](../../sahsah_prototype/src/pages/GamePage.tsx#L547) |
| Audio | Unlimited host-controlled replay, without extra game tokens | Q50; [current player](../../sahsah_prototype/src/components/QuestionAudio.tsx#L69) |
| Memory viewing | Host shows/hides/revisits manually; no viewing countdown | Q51; [memory presentation](../../sahsah_prototype/src/demo/party-modes.ts#L130) |
| Memory answering timer | Starts on the first hide; later revisits do not restart it | Q53; [memory actions](../../sahsah_prototype/src/demo/service.ts#L190) |
| Return before resolution | Preserve hints, reveal and memory progress; pause/preserve remaining time until reopening | Q54; deliberately changes [the engine's reset behavior](../../sahsah_prototype/src/lib/game-rules.ts#L558) and adds a production action absent from the current UI |
| Award | Default to current hint-stage points; host may select zero through original tile points | Q52; [current award bound](../../sahsah_prototype/src/lib/game-rules.ts#L523) |
| Total correction | Host enters a nonnegative absolute total; record its difference from the previous total without overwriting earlier awards | Q55; [current absolute-target UI](../../sahsah_prototype/src/pages/GamePage.tsx#L174) |

API-Q5 accepts distinguishing a timer paused by navigation from one deliberately paused by the host. Reopening resumes the former with its saved time; an intentional host pause remains paused. For an answering clock that has already started, Reset creates and immediately runs a fresh 60-second clock without erasing question progress. Memory's first-hide prerequisite remains unchanged.

Do not carry forward the archived three-play audio limit, timed memory viewing or 30-second memory answering period. Public pack edits still affect only new games: runtime always uses the game's starting content and rules snapshot.

## Consolidated records and relationships

Accepted physical simplification: [ADR 0007](../adr/0007-consolidate-launch-schema.md), 2026-11-02. Product behavior above remains unchanged.

| Record | Purpose and access path |
| --- | --- |
| `games` | Two explicit team name/score groups, lifecycle, host/controller and current-question pointer; lock/version this row for mutations. |
| `game_questions` | One row per copied question, keyed by game/board/question position. Separate snapshot, timer/hint/memory, optional resolution and optional feedback columns. |
| `game_actions` | Accepted command digest/outcome plus optional typed score effect. Game/command PK deduplicates; source uniqueness and partial score/version uniqueness protect awards/history. |
| `game_question_media` | Relational pins to the immutable media in the starting copy. |
| `game_players` and account progress | Frozen roster, explicit departures, durable exposure and same-game pack completion. |

Create all 36 question rows at accepted start. Field-specific write paths preserve snapshot/resolution immutability, isolate host feedback from scoring and maintain score totals with action effects. Overall corrections keep original question/category awards. The two teams are fixed game sides; no permanent club, individual answer, buzzer or turn-owner model is added.

## Timer representation

The timer uses `ready`, `running`, `paused` or `elapsed`, a `remaining_ms` checkpoint and an optional absolute `timer_deadline_at`. Ready means a full 60,000ms; elapsed means zero. Only running has a deadline. While running, the checkpoint describes the time allocated at the last start/resume, not the continuously changing amount left.

| Transition | Persisted change |
| --- | --- |
| First ordinary opening | Set sticky first-opening timestamp, running state and deadline at accepted server time +60 seconds |
| First memory opening | Set first opening; timer remains ready while viewing is untimed |
| First memory hide | Record first-hide milestone and start the answering deadline once |
| Pause | Calculate remaining milliseconds from the deadline, clamp to 0–60,000 and store paused or elapsed; clear deadline |
| Resume | Use the saved positive remainder to create a new deadline; never infer a reset from a zero remainder |
| Explicit reset | For an answering clock that has already started, save a fresh 60-second deadline and run immediately without removing hints/reveal/history; preserve memory's first-hide prerequisite |
| Return to board | Checkpoint/pause running time, mark whether navigation should resume it, and clear the active pointer |
| Reopen unresolved slot | Restore retained progress and saved time; resume a navigation-paused clock while preserving an intentional host pause; do not create a new question attempt or exposure identity |
| Reveal / resolve / end | Stop a running clock and clear navigation-resume intent in the same command transaction |
| Time passes | Clients render the countdown from the authoritative deadline; no per-second PostgreSQL writes |

For a running row, read `max(0, deadline - authoritative server time)`. A row can retain `running` after its deadline until a subsequent command normalizes it; its display is already zero. There is no timer worker or index required merely to display time. Q58 keeps reveal/adjudication with the host: timeout does not automatically reveal, resolve or award points.

Use the same fresh-clock-after-lock discipline as [game expiry](lifecycle-transactions.md). Client time does not decide scoring, game expiry or whether a question was opened before termination. A resume response includes server time and the persisted deadline so clients can compensate for local clock differences. On takeover, the new controller reads the existing state rather than creating another clock.

At most one unresolved question may be active and running in a game. The active pointer and that slot's timer change under the root game lock. No independent socket handler may start a second timer outside this transaction. Row checks alone do not establish this cross-row invariant.

## Opening and navigation transaction

1. Lock the root game and capture fresh server time. Finalize effective idle expiry instead of accepting a late command.
2. Verify account/session, host credential and controller generation, expected state version and request identity. Generic host-command receipts now bind digest/outcome/version; slot uniqueness alone is not complete command deduplication.
3. Validate the target belongs to the copied board, is unresolved and can be opened from the current state. Any prior current question must be paused/closed by an accepted transition.
4. On first opening, set the slot's first-opening timestamp, the game's durable `first_question_opened_at` if absent, and exposure records for eligible signed-in starting players whose explicit departure has not occurred. Temporary disconnects do not remove eligibility.
5. Set the active pointer and applicable timer transition; retain hint/reveal/memory progress. Update the game version and meaningful activity/idle deadline once.
6. Commit, then publish only the authorized state projection. Protected answers and unrevealed assets remain server data.

The shared game lock resolves opening versus end/expiry races: a terminal unopened game can restore its token, while a committed opening permanently removes ordinary unopened-game restoration eligibility. Timer reset, back navigation and content edits cannot reverse that marker.

## Resolution and score transaction

1. Apply the same game lock, fresh-clock, authority, expected-version and command-identity checks.
2. Validate opening/reveal prerequisites, absence of an earlier resolution, and the selected team or explicit no-winner decision. Derive suggested points from copied stage rules and validate an override against this slot's original 200/400/600 cap. The actual Drizzle schema also enforces `awarded_points <= base_points`.
3. Insert one resolution. A winner with zero points remains distinguishable from nobody winning. Insert one matching award score entry for a selected team, even at zero; no-winner resolution has no team score entry.
4. Update that team's score projection with the same entry. Score history stores before/after/difference and the resulting game version. A retry returns the original accepted result; a conflicting payload must not silently turn an earlier award into another outcome.
5. If all six questions in this copied pack now have resolutions, credit eligible signed-in starting players once. No-winner resolutions count; a player who explicitly left receives no new completion. Different games' partial resolutions never combine.
6. Q60: the 36th resolution automatically finishes and locks the game, stops timers and releases remaining active-account claims in this same transaction. There is no final-review phase. Earlier deliberate ending also locks scores.
7. Advance game version/activity as appropriate, commit and publish the authorized result.

For an overall correction, lock the same active game, validate an integer target >=0, calculate `delta = target - locked_current_score`, insert a manual entry and set the projection to that target in one transaction. An unchanged target is a no-op. Do not clamp an invalid negative request to zero. Q56 keeps original awards/category attribution intact; Q57 locks scores when the game ends. Corrections must precede the last resolution or an earlier ending.

For replay, Q74 returns to the room lobby with names/team choices retained. Reset non-host Ready confirmations for the next game; the host may remove absent members. A successful start freezes that game's newly confirmed roster, copies current selected content, claims accounts and spends one new token. It never reopens or changes the previous game.

API-Q19 accepted manual target input from zero through 1,000,000 on 2026-11-06; subsequent valid question awards may raise the resulting total beyond that input ceiling. The implemented bigint storage and exact decimal-string API representation preserve precision. Staff content permissions do not authorize host scoring, and player scoring authority does not authorize financial-token changes.

## Integrity and performance boundaries

- Snapshot/state/resolution composite keys keep each question inside one game. Winner and score-entry team FKs keep teams inside that same game. Actor FKs identify the original host account; the transaction separately proves current controller authority.
- Checks enforce nonnegative totals, exact before/after differences, timer pairing and each tile's award cap. Matching resolution/entry values, score projection equality and six-resolution completion require coherent transaction rules across rows.
- First-opening, reveal and memory milestones need old/new-state guards; a row check cannot prove immutability. The same applies to append-only score history and final adjudications.
- No index is added on timer state, hint stage, memory visibility, score or JSON snapshot fields: named access paths start with one game and read at most 36 slot rows and two teams.
- The root game row serializes commands within one active game, while other games proceed independently. Keep transactions short; media transfer and WebSocket fan-out occur outside locks.
- Host-command receipts and durable post-commit outbox work are represented; media/controller takeover must use the current credential generation. Unique question/score keys prevent repeated specific effects; they do not yet constitute a complete reliable-command protocol.

No live PostgreSQL constraint test, query plan, gameplay integration test or concurrency benchmark has been run. DBML parser validation is reported separately in [the design session](design-session.md#structural-dbml-validation).
