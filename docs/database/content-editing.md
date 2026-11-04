# Editable public packs, game snapshots and history

Status: accepted product behavior from Q12–Q28, with proposed storage/transaction mechanisms. The DBML remains incomplete; no application code, database or migration is changed by this design.

## Editing and replacing content

Staff may save changes to a published pack after a warning and confirmation that the content is public. No new-pack requirement, publication freeze, reviewer approval or republishing gate is imposed. Required content validity still applies: a playable pack contains six valid question slots, and a public edit must save a valid set atomically.

An ordinary question edit keeps its logical ID and seen history. An explicit replacement creates a new ID in the same pack slot. Each question stores its pack and slot number. Current membership uses `retired_at IS NULL`, protected by partial unique `(pack_id, slot_number)`; retired identities keep their former slot for history. Replacement retires/inserts atomically under the pack lock, while publication still validates six complete active questions. Duplicate wording is manually reviewed by staff and is not constrained by text/hash uniqueness.

The public-edit warning is an admin interaction, not a requirement for a separate confirmation table. Any desired staff audit evidence can use the later general audit model.

## Game content is copied at accepted start

The user accepted that existing games keep their starting content, including when a staff member later corrects an answer, replaces an image/audio clip or replaces a whole question. New games use the edited catalog.

The proposed `game_questions` records preserve each selected question's logical identity, base points and bounded content snapshot. Snapshot payloads contain question text/answers/locales, format/stage settings and version-specific asset references. Category labels are also copied for the game board. Image/audio bytes and expiring signed URLs do not belong in the JSONB snapshot.

Retain the media objects/versions referenced by saved games. Updating a catalog image should point to a new retained asset/version rather than overwrite the object used by an existing game. Media assets/role links/game pins and delivery checks are now modeled; Q83 retains full copied game content for 12 months, then compact results/progress remain. See [content and media](content-and-media.md).

Snapshot answers and unrevealed assets are private server data. Public game responses need a phase/permission projection; serving a whole snapshot as the public payload would defeat reveal controls.

## Catalog membership versus historical membership

Current authoring slots use a composite reference so that the selected question belongs to its current pack. Game-start validation checks that each selected pack belongs to its selected category and copies the exact six current questions.

Historical game rows preserve that relationship as it was at start. They do not permanently reference the catalog's **current** `(category, pack)` pairing; otherwise a later reassignment could be blocked by old game history or mutate its meaning. In-game composite references still enforce that runtime/history records belong to the intended game/board position/player.

This is a deliberate boundary: verify the current catalog assignment in the start transaction, then treat the saved game snapshot as historical authority. The SQL/DBML alone does not prove that every copied question was in the selected catalog pack at that moment.

## Exposure, completion and updated packs

On opening a question, record exposure for the eligible signed-in starting roster, including accounts whose devices temporarily disconnected and excluding players after explicit departure. First-exposure summaries are keyed by account and logical question. An edit retains the key; a replacement has a different key.

After all six questions of a game's pack have been resolved, including no-winner results, record completion against that game's copied pack. Q17 accepted preserving this earlier completion and flagging the current pack as **Updated** after a replacement. New questions are not automatically seen or completed; group freshness considers all six current question IDs. One replacement does not make the other five questions unseen.

Detecting an update can use the retained source identities from the completed game's snapshot compared with the current six slot identities; a monotonic composition counter is another possible optimization. Typo edits should not produce a new-question notification. The exact summary/projection is still a physical-design choice.

Q18 distinguishes explicit departure from connection loss: deliberate guest departure sets an end-of-participation marker and releases the matching active-game claim, preserves earlier exposure/completion, and stops future credit. The historical seat remains; a replacement player cannot fill it in the current game. Network loss does not trigger departure.

Q19 fixes account identity at start: an anonymous player can sign in normally but keeps the game's guest identity; account progress starts next game and is not backfilled. Q20 requires all six resolutions in the same game; partial attempts from different games do not combine. Resuming the same game preserves its progress.

## Proposed transaction boundaries

1. **Edit public content:** validate confirmation and required fields; lock the pack consistently; save its six-slot change and any proposed audit evidence together. Upload/prepare media outside the short transaction.
2. **Start game:** authorize the host; freeze the six-or-fewer roster; acquire all signed-in accounts' active-game claims; lock/recheck selected catalog packs and group freshness; validate any repeat acceptance; copy 36 question snapshots; accept the game and debit one token once in the same transaction.
3. **Open question:** authorize an expected state/version command; transition to the saved question; insert first exposure for eligible starting accounts idempotently in the same transaction.
4. **Resolve question:** validate once-only scoring; persist its outcome; credit a pack only after six valid resolutions against the game's own slots. Keep host score corrections distinct from exposure/completion policy.
5. **End guest participation:** set the guest's departure marker and release its matching active-account claim together. Serialize this with question opening/resolution so no future exposure or completion is added after departure. A new game may acquire the account after that commit. Temporary network disconnect is not this transition.
6. **End/expire game:** host departure or End game finalizes for all; meaningful host gameplay inactivity expires the game after 24 elapsed hours. Finalize and release remaining matching claims together. Restore the original host token once if no question ever opened; otherwise ordinary ending/inactivity keeps the charge. Preserve historical content/roster/progress.
7. **Change controlling device:** authenticate the same host, recheck lifecycle/deadline under the game lock, rotate the controller credential and advance its generation. Reject later old-controller mutations. No token is charged and takeover alone does not renew gameplay inactivity.

Catalog edits and start must follow the same pack-lock discipline to avoid copying a mix of before/after content. Acquire multiple account/pack locks in a deterministic order and handle retryable transaction failures. The final command/idempotency and outbox design is still to be completed; listing boundaries does not implement their guarantees.
