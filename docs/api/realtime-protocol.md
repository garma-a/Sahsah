# Gameplay realtime protocol

Design baseline 2026-11-06. Native Nest WsAdapter/`ws`, endpoint `/api/v1/realtime`, WSS in production. Business mutations use [REST](openapi.json); this protocol authenticates/subscribes and delivers transient permitted views. It does not stream pixels, audio bytes or a durable event log.

## Authentication and one stream per participant

Allowlisted browser origins and a bounded upgrade/authentication budget apply before resource allocation. Native clients still require valid proof; Origin alone is never identity. Authenticate in the first JSON frame within five seconds; do not put credentials into URL/query/subprotocol logs. Until authentication completes, accept no subscription or playback message and deliver no content. Asynchronous `handleConnection()` is not an authorization barrier.

First frame is `{event:"authenticate", data:{protocolVersion:1, roomId, language, authorization, controllerSecret?}}`. `authorization` is `Bearer <existing account token>` or `Bearer g.<membership UUID>.<saved anonymous secret>`. For a host stream, require the current room controller secret and verify the active game's corresponding fence. Account-only host tabs cannot replace the controller stream or receive host/audio capabilities; they use the explicit REST takeover flow first. Exact client/server shapes are in [the JSON Schema](realtime.schema.json), reusing the OpenAPI view definitions.

After successful checks, revalidate current membership/controller generation before installing an asynchronously authenticated connection, then atomically replace the mapping keyed by `(roomId, membershipId)` with a new connection epoch/stream ID and close the old socket. Its later close callback removes the mapping/presence **only if it is still the current epoch/socket**. Every post-auth client frame also checks that epoch/socket; a superseded stream cannot resync or reauthenticate during close overlap. A validated reconnect uses the existing seat and protected budget at capacity cutoff; an unauthenticated socket cannot claim that privilege.

Server sends `authenticated` then a complete `state` for the room's current focus. The stream automatically follows lobby → board → current question/reveal → result → replay lobby. One room subscription per stream. An invitation alone never subscribes; a former participant's historical-result proof cannot subscribe after live revocation.

Send a separate initial `presence` snapshot after authentication. Cached state/member schemas omit connection flags; only the current process-epoch presence channel updates those indicators.

## Envelope and ordering

Client frames use `{event, data}` with strict schemas and no unknown fields. Allowed controls: `authenticate`, `reauthenticate`, `resync`, `set_language`, and host-only `playback_status`. WebSocket ping/pong uses protocol control frames.

All server application frames carry `protocolVersion:1`, `streamId`, monotonic decimal-string `sequence` and `serverTime` inside data. State includes exact room/game revisions and a `view` discriminated by `phase` and `audience`. Initial/changed states are **complete current projections**, not patches requiring the client to replay every intermediate event. Coalesce superseded state for a slow consumer; never coalesce/reorder a required control revocation behind unauthorized content.

| Server event | Data and handling |
| --- | --- |
| `authenticated` | Stream ID, sequence/time, language and credential expiry where applicable. No credential echo. |
| `state` | Current permitted lobby/board/question/answer/result view and authoritative revisions/time. No signed URLs in durable storage; audio references only in host view. |
| `presence` | Current connection indicators and transient host playback status, with a process epoch. It never changes game revision, timer, exposure or inactivity. |
| `credential_expiring` | Account proof expiry notification; client refreshes through its existing auth integration and sends `reauthenticate`. No login API is introduced. |
| `control_revoked` | Stop host controls/audio immediately; clear private local playback state and close/re-authenticate as permitted. Old proof remains fenced in REST. |
| `membership_revoked` / `room_closed` | Stop live rendering/media renewal, close stream. Original compact result can still be fetched with retained participant proof. |
| `resync_required` | Discard partial/stale local state and obtain the current authorized snapshot; no event-log replay promise. |
| `protocol_error` | Safe stable code/request ID; malformed/rate-limited/unauthorized frames can close the stream. No stack/credential echo. |

Client compares stream ID first, then sequence and the source revision vector `(roomVersion, gameId, gameProjectionVersion)`. Discard old-stream/duplicate/stale frames; an older source cannot overwrite newer local state merely because its response arrived later. For a gap, the next complete state can replace local state; otherwise send bounded `resync` or GET the authorized snapshot. On reconnect/restart, discard sequence/presence from the prior process epoch and take a new snapshot. Reauthentication preserves the same room/member identity; account binding or a different principal starts a new authenticated stream.

Subscribe/register invalidations before the initial snapshot. Use one serialized/coalescing projection pipeline per room/audience/language, read a consistent DB snapshot and discard superseded builds before assigning delivery sequence. Buffer invalidations during a build and rebuild the newest state. REST/resync responses use the same source-version fencing client-side. Changing language/auth cannot let a late old build displace the current language/grant. `games.projection_version` tracks feedback/purge after terminal state version freezes; presence remains a separate process epoch.

Projection work reloads current state and eligible recipients, builds/validates shared safe content once per meaningful version/audience/language, then serializes it for delivery. Last-moment authority checks must not be replaced by a cache hit. Only the original frozen players receive active game content; a departed member is excluded from subsequent exposure/completion/delivery.

## Host audio and transient status

Only the controlling host may request/play permitted question audio or the configured post-reveal forward answer. Actual playback is local HTML/native audio using a direct authorized R2 GET URL. Browsers may require a user gesture; accepting a game command never proves that audio actually played.

If mirroring playback visuals, host sends `playback_status` on actual play/pause/seek/end events, containing current game/slot, typed clip role/variant, controller generation, a monotonically increasing per-stream playback sequence, `playing`, integer position milliseconds and relevant game revision. Do not emit progress every second. The server verifies current controller and clip/phase eligibility, stores a bounded disposable status and forwards safe visual status without the private audio reference/URL. Clients animate progress locally from the accepted timestamp/offset.

This is telemetry, not a gameplay command: no token charge, replay quota, PostgreSQL write, timer change, exposure, inactivity renewal or reliable replay history. Drop stale/out-of-order telemetry. Suppress/reset it when question focus changes, reveal stops the current clip, resolution/end, control loss or host stream loss; a newly authorized allowed clip may then start. The host client stops its local player on navigation/control/disconnect. Already downloaded bytes cannot be recalled, and issued URLs retain their accepted bounded lifetime.

Viewer frames/projections contain no audio reference, URL, storage key, transcript-before-reveal or playback capability. A modified viewer client cannot acquire one through REST. Visual duration/status is not audio authorization.

## Initial engineering budgets

These are tunable starting defaults to verify in the acceptance profile, not measured capacity results.

| Setting | Starting value |
| --- | --- |
| Inbound frame | 8 KiB; strict event/body schema |
| Authentication deadline | 5 seconds; bounded global/per-source unauthenticated sockets |
| Heartbeat | Ping every 25 seconds, terminate if no pong within 10 seconds |
| Superseded connection | Close promptly; force termination within 1 second |
| Outbound payload | 64 KiB maximum per state; reject unbounded authored payloads before publish/start |
| Pending outbound bytes | 256 KiB per socket; coalesce one latest state and disconnect persistently slow consumers |
| Reconnect | Full jitter, exponential delay 0.5–30 seconds; honor capacity Retry-After where applicable |
| Client controls | At most 10 frames/second burst 20; resync at most once/second; playback telemetry at most 4/second burst 8 |
| Compression | Disabled initially |

Keep work queues and projection caches bounded. Authoritative account token expiry/deactivation and membership/controller revocation must close or reauthorize affected streams. An expiry timer triggers reauthentication/revocation even if no gameplay event arrives; database heartbeats are unnecessary. Test slow receivers, incomplete auth frames, stale tokens, controller races, process restart, replay and old-close callbacks.
