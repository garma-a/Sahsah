# Admin service deployment

The staff dashboard is a second Railway service built from `web_app/backend` (ADR 0021). It shares the repository and database with the gameplay API but never runs inside the API process.

## Service

- Root directory: `web_app/backend`. Config file: `railway.admin.json` (set it in the service's settings as the config-as-code path).
- Build: `pnpm install --frozen-lockfile && pnpm build:admin` compiles the code and bundles the dashboard screens once into `.adminjs/`. Start: `pnpm start:admin`. Health check: `/health` (returns 503 when the database is unreachable).
- Serverless: enable "Serverless" on the service (`sleepApplication`). The first request after idle takes a few seconds while the service wakes. Sessions live in PostgreSQL, so staff stay signed in across sleeps. The in-memory login lockout resets on sleep.
- Database: `DATABASE_URL` is the same restricted runtime role as the API. Run migrations first (`pnpm db:migrate` with `MIGRATION_DATABASE_URL`, then `pnpm db:grant-runtime`); the admin refuses to start on pending migrations. The admin pool is small (`ADMIN_DATABASE_POOL_MAX`, default 3).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime role connection string (required). |
| `ADMIN_SESSION_SECRET` | 32+ characters; signs the session cookie (required). |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | Create the first Super Admin on first boot only (password 12+ characters). Remove them from the service after the first sign-in; they are ignored once any staff account exists. |
| `TRUSTED_PROXY_HOPS` | `1` on Railway, so rate limits and cookies see the real client address. |
| `NODE_ENV` | `production`: Secure cookies, requires `DATABASE_URL`. |
| `ADMIN_DATABASE_POOL_MAX`, `ADMIN_LOGIN_ATTEMPTS_PER_MINUTE` | Optional tuning (defaults 3 and 10). |

Do not set `GAMEPLAY_*` or R2 variables on this service yet; later releases add what media upload needs.

## Staff accounts

Sign in at `/admin`. A Super Admin adds staff, deactivates or reactivates them, changes roles and resets passwords under Staff & audit. A temporary password is shown once on screen; share it privately. There is no email-based password recovery: a Super Admin resets it. The last active Super Admin cannot be demoted or deactivated, and nobody can deactivate or re-role themselves. Every change appears in the audit log.
