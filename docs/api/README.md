# Gameplay API design

Review baseline 2026-11-06. The user accepted all 19 interview decisions and invoked `$implement`. This package specifies category/pack selection → room/QR/team preparation → host-controlled gameplay and silent viewer mirroring → points/winner/results. Runtime code is on `feat/gameplay-api`; [implementation evidence and operations](implementation-and-operations.md) distinguish local checks from outstanding production certification.

| Document | Purpose |
| --- | --- |
| [Gameplay contract](gameplay-contract.md) | Scope, all 27 HTTP operations, authority/projection/durability rules and selected libraries |
| [OpenAPI 3.0.3](openapi.json) | Exact HTTP request/response schemas, operation IDs, limits, typed receipts/errors and examples |
| [Question lifecycle](question-lifecycle.md) | All 12 commands, ten formats, memory phases, reveal/timer/award guards |
| [Realtime protocol](realtime-protocol.md) and [JSON Schema](realtime.schema.json) | Authenticated native WS framing, one-stream handover, ordered current-state delivery, audio telemetry and recovery |
| [Schema/transactions](schema-and-transactions.md) | Two planned tables plus focused column/guard/grant changes, lock order, source-based retry recovery and deadline semantics |
| [Admission control](admission-control.md) | Accepted 85% protection, existing-game priority, missing-metric policy and unmeasured staging defaults |
| [Acceptance/handoff](acceptance-and-handoff.md) | Implementation order, 34 invariant/race scenarios and load/recovery evidence required |
| [Decision log](design-session.md) | All 19 questions/answers and the closed product frontier |
| [Examples](contract-examples.json) and [validation report](validation-results.json) | Accepted/rejected structural fixtures and executed design-artifact checks; not runtime test results |

The design uses REST mutations, PostgreSQL transactions/receipts/outbox, native NestJS 12 validation/serialization with compatible Zod and OpenAPI, native WsAdapter/`ws`, and private R2 presigned media. No Redis, replica, separate worker service, pixels/audio stream, auth/checkout/profile/staff API or history browser is added. Existing in-game host Like/Dislike and lobby-only binding to an already verified account preserve earlier product scope without implementing login.

Planning branch: `docs/gameplay-api-design`. Runtime implementation must use a **new branch and new PR**, with user review before merge. Prototype assets/behavior/deployment and independent lockfiles remain intact; no Flutter install/build.

The implementation adds two room tables (39→41), revisions/control/source/deadline fields and focused immutable-history protections, plus the gameplay/media/realtime/maintenance services. Migrations were exercised only on disposable databases. Existing-principal integration is consumed; login/payment remain excluded. Actual Railway quotas, representative safe load and monitoring delays remain to be measured in staging. A short 100-room/600-player localhost smoke report is included; it does not certify production capacity.

Validate the design artifacts with `python3 docs/api/validate_contracts.py`. The helper uses Python `jsonschema` already present in this tool environment and the official OpenAPI meta-schema; it does not install dependencies or run application/provider tests. Use `--oas-schema /path/to/cached-official-schema.json` for an offline repeat.
