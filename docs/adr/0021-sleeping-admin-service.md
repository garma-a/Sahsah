# Run AdminJS as a second sleeping service from the backend package

Accepted 2026-11-20. The staff dashboard runs on AdminJS as a separate Railway service, started from `web_app/backend` with its own start command, and sleeps when idle (Railway Serverless), following the operator's pupzy deployment. The first deploy has a small budget, and staff traffic is rare and can tolerate a cold start of a few seconds; gameplay cannot.

Running it from the backend package lets the dashboard reuse the Drizzle schema without sibling-source imports. Keeping it out of the API process keeps the single gameplay process (`claimGameplayProcess`) free of AdminJS memory and request load. Staff sign in through `staff_accounts` (Admin, Super Admin) with sessions in PostgreSQL, so sessions survive sleep. Dashboard statistics are computed on request and cached in process for a short time; the database is always the source of truth.

Every action that changes money, tokens, bans or published content goes through custom AdminJS actions that write a `staff_audit_events` row in the same transaction. AdminJS's generic create/edit/delete is limited to low-risk tables, because it would bypass the ledger and audit rules (ADR 0010).

## Considered Options

- Keep AdminJS mounted inside the API process: no extra service, but the admin's memory and work would share the gameplay process and its admission budget.
- A separate `web_app/admin` package: cleaner isolation, but it could not import the schema and would need a second copy.
