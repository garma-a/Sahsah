---
status: accepted
---

# Check group freshness against question exposure and a fixed game roster

Prefer an authored pack unseen by every tracked signed-in player; when no group-fresh pack exists, require a host choice to change category or explicitly accept repeated content. Record exposure when a question opens, separately from completion after all six questions are resolved; anonymous participants have no persistent account progress. The user accepted freezing the roster at game start, allowing original players to reconnect, crediting the signed-in starting roster despite temporary disconnects, and limiting an account to one active game.

This preserves authored packs while avoiding the misleading assumption that an incomplete pack is wholly unseen. It requires account/question history, durable game participation and an atomic per-account active-game claim. Q18 explicitly releases a guest's claim and stops future credit on deliberate departure, while Q19 keeps mid-game sign-ins as guests until the next game. Q20 requires completion within one game. [ADR 0004](0004-game-expiry-and-token-restoration.md) subsequently defines host end/leave, game expiry and restoration; record retention remains to be decided.
