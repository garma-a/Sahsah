---
status: accepted
---

# Keep invitation rooms separate from individual games

A room is a reusable invitation space containing separate game occurrences; replay creates a new game while keeping the room and its guests. The user accepted this boundary during the database design interview on 2026-10-23 because the prototype resets a single session and overwrites its result history, making separate plays and token consumption ambiguous. This adds a room-to-games relationship but preserves each completed game's board, scores and result; room expiry, controller transfer and membership across games remain separate policy decisions.
