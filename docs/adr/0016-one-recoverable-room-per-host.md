# Keep one recoverable open room per host

Accepted 2026-11-06 in API-Q15/Q16. A host has one reusable nonclosed room; another creation requires explicitly closing it. Keep draft setup separate from charged games, preserve finished results, and close a lobby after 24 elapsed hours without meaningful preparation activity.

Invitation expiry remains an independent admission window. Never close a room through lobby inactivity while its game is active; after termination the next lobby window derives from the game's effective `ended_at`, not the time a cleanup worker happens to run. This bounds abandoned preparation without destroying game recovery or allowing delayed expiry work to extend room life. A partial unique owner index and room-first closure/creation paths enforce the policy. See [schema and transactions](../api/schema-and-transactions.md).
