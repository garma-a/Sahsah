# Question phases and command rules

Review baseline 2026-11-06. These rules refine the accepted gameplay into service guards and public projections. They do not add question formats, answer submission, buzzers or automatic judging. Request shapes are in [OpenAPI](openapi.json); transaction/time/receipt rules apply to every command.

## Host transitions

All commands require the verified original host, current controller generation/proof, stable operation UUID, expected game version, and effective active/unexpired lifecycle under the root game lock. A duplicate accepted operation returns its original receipt before stale-version rejection; a new invalid transition returns409. All listed question actions use the copied `(boardPosition,questionPosition)` and must match the current pointer where required.

| Command | Preconditions and result |
| --- | --- |
| `open_question` | From board to an unresolved copied slot. First ordinary opening sets the sticky first-open marker/exposure and running 60-second deadline. First memory opening remains ready. Reopen preserves hint/reveal/memory/clock; an already revealed unresolved slot returns to answer view. Resolved tiles never reopen. |
| `return_to_board` | Current unresolved question, including revealed. Checkpoint/pause a running clock with navigation-resume intent; clear pointer and preserve milestones. Reopening resumes only navigation-paused time. |
| `advance_hint` | Current unrevealed blur/zoom only, stage <2. Advance exactly one stage, no backward/new-attempt behavior; all suggestions remain positive and strictly decreasing. |
| `show_memory` | Current unrevealed memory question. First show records a sticky milestone; subsequent show is revisit. It never starts/resets the answer clock by itself. |
| `hide_memory` | Current unrevealed memory scene has been shown and is visible. First hide unlocks detail prompt and starts 60 seconds; later hide only changes visibility. |
| `pause_timer` | Current unresolved/unrevealed question with a running clock; memory first hide must exist. Store actual remainder as paused, or elapsed at zero. |
| `resume_timer` | Same eligibility; paused with positive remainder. Create deadline from that remainder. Elapsed zero needs explicit Reset. |
| `reset_timer` | Same eligibility; answering period has started. Run a fresh 60 seconds without erasing hints/exposure/memory. Never legal after reveal/resolution. |
| `reveal_answer` | Current unrevealed unresolved question; memory first hide completed. Stop the clock and current playback, clear navigation-resume intent, release only permitted answer fields after commit. No automatic award. |
| `resolve_question` | Current revealed unresolved question. Team 1/2 with optional award override `0..basePoints`, default current suggestion; no-winner uses null and omitted/zero points. Award 0 to a team remains a winning-team decision. Record once, update totals/progress and return board, or finish atomically on resolution 36. |
| `adjust_score` | Active game, any focus. Absolute target string 0..1,000,000, derive delta and preserve original question awards. Unchanged target is a no-op. Later awards may raise total further; full board contributes at most 14,400. |
| `end_game` | Active game, any focus including unopened. Stop timers/playback, lock scores/result, release matching claims and restore original debit once if never opened. Reason is `host_ended`; explicit room closure uses `host_left` unless effective expiry already won. |

Timeout alone never reveals, resolves or awards. Host disconnect does not pause: project the actual deadline/remainder on recovery. Viewer connection/media failures cannot change the clock. Reset/pause after reveal is an invalid transition even if a client still displays an old button.

No-op/new-invalid distinction: setting an already equal score/Ready/setup can return a no-op receipt without version/activity changes. A new operation that tries to resolve an already resolved question or reveal it twice returns a conflict; it cannot rewrite adjudication. Different payload under an existing operation UUID always conflicts.

## Ten public format projections

Arabic is required in the frozen source. Optional Franco fields fall back independently; selected response language does not change identity, freshness or game rules. Do not infer script validity or send both full locales unnecessarily.

| Format | Before reveal | Revealed additions |
| --- | --- | --- |
| `STANDARD` | Localized prompt and optional prompt image | Answer text and optional answer image |
| `IMAGE_BLUR` | Prompt, current generated stage image/index and point suggestions | Full answer image/text |
| `IMAGE_ZOOM` | Prompt, current generated crop/index and point suggestions | Full answer image/text |
| `AUDIO_GUESS` | Prompt; host audio reference, viewer duration/status only | Text answer; host may replay permitted current audio |
| `AUDIO_REVERSE` | Prompt; host generated reversed clip, no forward source | Transcript answer; optional host forward answer clip only when copied configuration allows |
| `IMAGE_PERSON` | Prompt and generated question crop | Identity answer and full portrait |
| `IMAGE_COLOR` | Prompt and generated grayscale rendition | Color answer/original and optional `colorHex` |
| `IMAGE_RIDDLE` | Prompt and illustration | Proverb answer; illustration may remain |
| `AUDIO_VOICE` | Prompt/optional localized hint; host clip, viewer visual metadata | Identity answer |
| `IMAGE_MEMORY` | Phase-specific scene/instruction/detail as below | Answer and scene |

Never deliver unopened prompts/answers, future hint references, private sources, original portraits/color images or color swatches before their permitted phase. Viewer schemas omit audio references/URLs/capabilities entirely. Server media authorization independently enforces those rules even for a modified client. A source reused physically as an answer must still have a permitted retained role/pin.

Blur/zoom have exactly stages 0/1/2, with suggested points beginning at tile cap. Defaults: 200→150→50,400→250→150,600→400→200; copied editable values remain authoritative. The award cap stays the original200/400/600 regardless of current suggestion.

## Memory matrix

| Phase | Scene | Actual detail prompt | Clock |
| --- | --- | --- | --- |
| Opened before first show | Absent | Absent; generic instruction only | Ready 60 seconds |
| First viewing | Visible | Absent | Ready |
| First hide/recall | Absent | Visible and now permanently unlocked | Starts60 seconds |
| Revisit | Visible | Visible | Same running/paused/elapsed clock |
| Hide after revisit | Absent | Visible | Unchanged |
| Revealed | Permitted answer scene | Detail and answer visible | Stopped |

Image hiding prevents new scene access, not recall of bytes already viewed/downloaded. Return/reopen preserves these milestones. Reveal/timer actions before first hide must be rejected even though the prototype demo service has a weaker first-show check.

## Semantic validation beyond structural schemas

Services/Zod refinements must check: unique team/member/selection positions, category/pack pairing and revisions, valid repeat basis, winner-null implies zero/omitted award, exact per-tile cap, matching question/answer format and slot/media references, image/audio MIME/role compatibility, only current hint variant, source pin readiness, first-hide timer prerequisites and the phase-specific controls list. Parse query booleans from literal true/false without truthiness coercion. JSON/OpenAPI shape validation cannot establish database authority or cross-row coherence.

Host Like/Dislike targets a revealed retained copied question and expected feedback version. Original-host account proof is sufficient for this independent feedback action; it never changes scores or terminal game state version. Identical vote is a no-op; edits increment feedback/projection version. New edits close after purge. No feedback reward or new history page is added.
