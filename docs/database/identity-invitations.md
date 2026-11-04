# Player identity, invitation and replay design

Status: Q68–Q75 accepted. Egypt-only launch phones override the proposed international scope. These are proposed schema/transaction mechanisms, not an implemented authentication service.

## Stable player identity

The profile contains display name, verified Egypt WhatsApp number and Arabic/Franco preference. No player email, date of birth, gender or avatar is required. `accounts.id` remains stable across phone/device changes; staff identities are separate. Canonical phone uniqueness prevents two current accounts owning one number. Syntax/+20 checks are only a broad database bound; number metadata validation plus successful OTP verifies actual eligibility/ownership.

`accounts.firebase_project_id` and `accounts.firebase_uid` map the configured Firebase project/UID to the local account, with composite uniqueness. The backend verifies Meta-delivered WhatsApp OTP and issues a Firebase custom token; the client exchanges it for Firebase-managed sessions, then sends Firebase **ID tokens** to NestJS. This applies Firebase's documented custom-auth flow to the selected external OTP mechanism; Firebase does not deliver the WhatsApp code in this design. [Custom authentication](https://firebase.google.com/docs/auth/web/custom-auth), [creating custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

Reuse a stable UID, such as the local UUID, across logins/phone changes. Do not mirror all Firebase refresh/ID sessions into PostgreSQL. Provider revocation and local account-state checks remain necessary; ordinary token verification does not check revocation by default, and checking revocation adds a provider round trip. Host-controller generations and anonymous reconnect credentials are distinct from Firebase sessions. [Firebase users](https://firebase.google.com/docs/auth/users), [session management](https://firebase.google.com/docs/auth/admin/manage-sessions).

## OTP and phone change

`phone_verification_challenges` records purpose, optional existing account, keyed OTP MAC/key version, attempts, expiry and one-use proof timestamps. Keep the MAC secret outside PostgreSQL. Never persist plain codes or accept a delivery receipt as verification. A proposed five-attempt default is operational configuration; expiry is stored per issuance.

Verify under a challenge lock using fresh time. Reject expired/invalidated/consumed/exhausted proofs. Serialize canonical-phone admission, enforce send limits and current ownership, then consume a valid proof with the corresponding local identity transition. External Meta/Firebase calls require a persisted retry/reconciliation strategy rather than being assumed atomic with SQL.

Self-service phone change consumes two purpose/account-bound proofs, validates the exact current old phone and unused target, updates the same account and records `account_phone_changes`. Never merge accounts or redirect bound gifts. Lost-old-number recovery is an audited support process, not another unchecked phone-login path. External revocation work is scheduled after the local transition; account-local state remains authoritative during failures.

Q75 permits deletion with unused tokens only after leaving/ending active play and explicit forfeiture confirmation. Deletion requests, typed forfeiture ledger entries and cleanup work are now represented; Q86 now requires fresh funding clearance/review and exact balance confirmation; new mapped funding invalidates that consent. No cash-refund/source-lot accounting is implied. Tombstoned account IDs can preserve retained references while phone/name are cleared.

## Invitation and member identities

`rooms` holds its current unique six-digit invitation code and issue/expiry/revocation fields. Store codes as text, preserving leading zeros. The window is exactly 24 elapsed hours. Consolidation removes dedicated issuance-history/registry tables; the accepted admission/rotation/reconnect behavior stays the same.

A code works only when the locked room still has that exact code, permits admission, is unrevoked and fresh time precedes expiry. Rotation atomically replaces its code/window. Expired-code cleanup clears a code in its own transaction; another room can then claim it under uniqueness. Random collisions can instead choose another code. Expiry/revocation stops admission, while original-player recovery and game life remain independent. QR/share links encode the locator, not member credentials.

`room_memberships` owns lobby identity/name/team preferences, Ready generation and the optional reconnect credential hash/issue/revocation fields. `game_players` is its frozen per-game snapshot. Composite FKs prove the member and game belong to the same room, while account/name/team snapshots are deliberately not tied to later lobby edits.

Immediate join needs a valid invitation, name/team and a free place under the room lock. At most six current people including the host; disconnection does not free a place. Anonymous credentials restore an existing membership without creating another seat. Store only their high-entropy credential hash; possession of a code/name/device ID alone cannot reclaim an existing seat. Signed-in members can recover after authenticating the matching account. Lost anonymous credentials/new-device recovery waits for the next game.

Add a PostgreSQL partial unique `(room_id, account_id)` for nonnull accounts on memberships with neither departure nor removal; this extra DDL is not expressible in the current DBML. Host removal is pre-start only, revokes membership access and preserves historical game rows. Q84 blocks that known account in the room until the host records unblock. The old membership stays removed and its secret stays revoked; a valid new join creates a new membership.

## Readiness and lock ordering

Each non-host confirms Ready for the current room lobby generation before every successful game start. Preserve names/team choices across replays. A successful start snapshots the eligible confirmed roster and increments the room generation immediately; old Ready values are therefore already invalid for the next game. The current-game pointer may continue referencing the terminal last game, so ending need not lock the room just to reset readiness.

Lobby/start paths lock the room before validating current membership/readiness and constructing a new game. Ordinary game commands lock their game and never subsequently acquire the room row. A terminal game releases claims/stops timers without needing that room lock. If stale-game expiry must be finalized, do it in a separate transaction before retrying room admission/start. This avoids a room→game / game→room deadlock cycle.

For code reuse, finalize expired-code cleanup in a separate transaction before assigning that code to another room. Never lock its previous room while holding the new room. Assignment/rotation locks only its own room, validates fresh state and handles unique collisions by retrying another code. Account rows now hold both active-game claims and token balance; verify the complete room/game/account/order/promotion lock order in implementation.

State reads require the appropriate member/account authorization, not just a public session UUID. Return only permitted lobby metadata before admission and protect answers/unrevealed media in all snapshots. No guest OTP, host transfer or automatic attachment of a mid-game signed-in account has been added.

Q89 permits regular Admin to perform the operational support actions above; only staff-account/role management remains exclusive to Super Admin. See [ADR 0008](../adr/0008-regular-admin-operational-access.md).

## Accepted deletion and redaction boundary

Block new checkout and new gift/native binding while deletion is pending; already authorized funding can resolve, but resets funding clearance and exact bank consent. Staff review must postdate the newest known funding change. A positive forfeiture and completed deletion commit together. Preserve tombstone IDs, anonymize personal displays/contact data, revoke credentials and queue Firebase cleanup. Gifts validly purchased for other recipients remain valid. Campaign-local phone allowance markers remain only until campaign end under Q87; no forfeited bank is restored by signup. See [operations/retention](operations-and-retention.md) and [executed checks](validation/README.md).
