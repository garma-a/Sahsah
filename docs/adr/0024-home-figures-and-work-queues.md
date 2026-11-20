---
status: accepted
---

# Home figures are cached in the admin process; work queues link to the list they count

The admin Home page shows today's figures, a seven-day trend, the top categories and six **needs attention** queues. "Today" and each trend day are Cairo calendar days; the boundaries come from the database (`Africa/Cairo`), so daylight saving is right.

The figures are computed on request and cached in the admin process for 120 seconds (`HomeStats`). Refresh now bypasses the cache. Every committed transaction of the admin service calls `invalidate()` through `DatabaseConnection.onCommit`, so any change recorded with an audit event drops the cache after it is visible. Each invalidation also bumps a version: a computation that started before it finishes without filling the cache, so a stale result is returned to its own caller only. Changes made by the gameplay API are not seen until the 120 seconds pass or someone refreshes; the page shows how old the figures are.

Every query uses an index. Four were added: `games_started_at`, `accounts_positive_bank` (the sum of all banks reads only accounts that hold tokens), `question_packs_open_drafts` and `game_questions_feedback_by_question`. Everything else already had one. Plans were checked on a seeded database of 6,000 accounts, 4,000 games and 24,000 voted questions.

Each queue count is a count of exactly the rows of a list page that the card links to through a URL query, and both read the same definition:

- Open messages: `contact_submissions.state = open` → Messages `?state=open`.
- Payment reviews: reconciliation cases `open` → Shop `?view=reviews&state=open`.
- Deletion requests: `requested` or `confirmed` → Players `?view=deletions`.
- Flagged accounts: accounts with at least one open flag → Players `?flagged=yes`.
- Unfinished drafts: a draft, not archived pack of an active category with fewer than six current questions → Content `?view=drafts`. A full draft that still fails publish validation is not counted: checking that needs the whole pack and is not cheap. Its pack page lists the problems.
- Disliked questions: a current question with at least 20 votes of which at least 40% are dislikes → Content `?view=disliked`. The thresholds live in `QUEUE_RULES` (`src/admin/home/queues.ts`).

Sales today sums `total_minor` of orders created today whose payment state is `paid` (web checkout, EGP). Native store purchases carry no price and are not summed. With no order of any kind the page says checkout is not live. A live room is a room that is not closed; an active game is a game with status `active`.
