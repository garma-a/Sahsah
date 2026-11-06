# Preserve the next game's setup in its room

Accepted 2026-11-05 in API-Q9. Persist the room's draft category/pack selections and team setup so host refresh/device takeover recovers the same preparation and participant views stay synchronized. Give mutable lobby state its own revision rather than using the existing Ready generation as a general concurrency token.

Keeping selections only on the host device would avoid schema work but lose or diverge setup during recovery. A `games` row is an accepted, charged game with frozen content, so it cannot double as an unpaid draft. The focused room/lobby extension, retry semantics and final Start revalidation are specified before implementation. API-Q13/Q14 accepted clearing everyone's Ready after meaningful selection/roster/team changes and blocking Start until every current non-host is Ready or explicitly removed. Game snapshots and earlier results remain separate. See [the API design session](../api/design-session.md).
