# Gameplay implementation review

The `code-review` skill ran independent Standards and Spec reviews against `752753d` (`main`) through implementation commit `de57c75`. Both reviewers rechecked the focused corrections in `77e68cf`.

## Standards

Three documented-standard findings were reported:

- Process lease released before old transactions drained, allowing overlapping admitted writers. Resolved with tracked drain, a shared transaction advisory barrier, replacement exclusive barrier and installed-backend identity checks. The restricted database regression covers graceful close and forced lease termination with rollback.
- A representative projection authorization failure disconnected valid teammates. Resolved with fresh per-recipient checks, selective revocation and survivor rebuild. The HTTP/WS workflow verifies that a viewer remains connected after host takeover.
- Anonymous joins consumed protected work before admission. Resolved by ordinary scheduling for unknown verification/new allocation, source lookup before refusal, bounded credential/source caches and caller/source rate limits. A regression holds unverified callers in their ordinary share while an admitted host finishes successfully.

The Standards reviewer confirmed all three resolved, with no remaining findings in the targeted recheck. Effective source-IP behavior, rate settings and real Railway capacity remain deployment validation inputs.

## Spec

Four specification findings were reported:

- New work could consume the protected scheduling share. Resolved by the allocation/recovery/verification separation described above.
- One stale representative could revoke the room. Resolved by selective fencing and rebuilding current projections.
- Invitation rotation did not renew meaningful lobby activity. Resolved while preserving the independent Ready generation.
- Equal hint-stage suggestions were accepted. Resolved by requiring strictly decreasing positive values.

The Spec reviewer confirmed all four resolved, including resource/operation/subject source-cache keys, cold recovery before capacity refusal, fixed verification-cache lifetime clamped to credential expiry, current database authority checks and reconnect slot handoff. No critical regression was found in the focused recheck.

## Executed evidence

Backend check/build and all eight API test cases pass. Database tests pass all fourteen Node cases, including the original 68 SQL integrity cases and six independent-connection races. Migration graph checks, all 27 route/status/schema comparisons and all 29 structural contract examples pass. Frontend check/build pass; frontend, prototype and mobile source remain unchanged.

The reviewed local 100-room/600-player smoke run accepted 700 commands without refusals, with p95 server command time 244.2 ms and p95 request-to-all-viewers visibility 779.6 ms. See [the exact local profile](reports/local-smoke-100.json), [query plans](reports/local-query-plans.json) and [release prerequisites](implementation-and-operations.md). Railway quotas, representative staging duration/mix, real R2 transfer and restart recovery percentages are not certified by this local evidence.

Standards: 3 findings, all resolved; worst original issue was lease handoff. Spec: 4 findings, all resolved; worst original issues were protected scheduling and selective revocation.
