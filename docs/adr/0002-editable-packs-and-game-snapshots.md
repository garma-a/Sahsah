---
status: accepted
---

# Allow public pack edits while preserving each game's starting content

Staff can edit an existing published pack after a public-content warning and confirmation; editing is not gated on creating a new pack or a republishing/review workflow. The user accepted retaining each game's content as it existed at game start, so later catalog edits affect new games while existing games keep their copied questions, answers and media references. Ordinary edits retain question identity and seen history; an explicit replacement creates a new question identity within the same pack, keeping previous exposure and game history separate from the replacement.

The trade-off is storing historical game content and retaining the media versions it references, rather than making every game read the mutable catalog. Historical membership must not be enforced against the catalog's current category/slot assignments; validate those assignments transactionally when creating the game. Q17 additionally preserves old completion and flags the current pack Updated after replacement, without marking new questions seen/completed. Media retirement and record-retention rules remain separate decisions.
