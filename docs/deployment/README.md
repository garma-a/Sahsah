# Production deployment

How `web_app/` reaches production, and what lives outside the repository. Read this before you change hosting, DNS, deploy settings, environment variables or the database. Secrets are never written here: each one is named with the place it is stored.

## Topology

| Piece | Runs on | Address | Deploys when |
| --- | --- | --- | --- |
| Next.js frontend (`web_app/frontend`) | Cloudflare Worker `sahsah-frontend` | https://sa7sa7.cc, https://www.sa7sa7.cc | GitHub Actions `deploy-frontend` job, on a push to `main` touching the frontend |
| NestJS API (`web_app/backend`) | Railway service `api` | https://api.sa7sa7.cc/api | Railway's GitHub integration, on a push to `main` touching the backend, after GitHub checks pass |
| PostgreSQL 18.6 | Railway service `Postgres` (image `ghcr.io/railwayapp-templates/postgres-ssl:18`, volume `postgres-volume`) | private only: `postgres.railway.internal:5432` | never auto-deployed |
| Question media | Cloudflare R2 buckets `sahsah-gameplay` (private) and `sahsah-public` (public `r2.dev` address) | signed links / `GAMEPLAY_PUBLIC_MEDIA_BASE_URL` | `pnpm content:upload` from a developer machine |
| Prototype (`sahsah_prototype`) | Vercel, from the root `vercel.json` | separate | Vercel's own Git integration; unrelated to `web_app/` |

Both Railway services run one replica in **EU West, Amsterdam** (`europe-west4-drams3a`), the closest Railway region to Egypt. Keep the API and Postgres in the same region: the API makes several queries per request.

## Accounts and identifiers

- **GitHub:** `garma-a/Sahsah`. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` feed `deploy-frontend`.
- **Cloudflare:** the client's account (free plan), zone `sa7sa7.cc`. `npx wrangler whoami` shows the account ID; it is also the `CLOUDFLARE_ACCOUNT_ID` secret. Its account API tokens:
  - `sahsah-github-deploy`: Edit Cloudflare Workers template, the token in the GitHub secret.
  - `sahsah-api-read`: R2 object read on `sahsah-gameplay`, used by the API.
  - `sahsah-content-import`: R2 object write, used by `content:upload` only.
- **Railway:** project `endearing-clarity`, environment `production`, services `api` and `Postgres`. `npx @railway/cli status --json` in a linked directory prints their IDs.

  The workspace is not Pro, which has two consequences: project tokens cannot be created, so GitHub Actions cannot deploy to Railway, and built-in backups are unavailable.

## Frontend: Cloudflare Workers

- **Build:** OpenNext for Cloudflare (`@opennextjs/cloudflare`, a dev dependency) turns the Next.js build into `.open-next/worker.js` plus static assets. The configuration is in `web_app/frontend/wrangler.jsonc` and `open-next.config.ts`.
  - Prerendered pages are served from the Worker's assets (`static-assets-incremental-cache`), because nothing revalidates. If a page starts using ISR or `revalidate`, switch to an R2 incremental cache first.
  - `next/image` uses the `IMAGES` binding.
- **API address:** `NEXT_PUBLIC_API_URL` is inlined at build time. The deploy job sets it to `https://api.sa7sa7.cc/api`, and a production build without it fails on purpose.
- **Domains:** `sa7sa7.cc` and `www.sa7sa7.cc` are Worker custom domains declared in `routes`. Wrangler creates and owns their DNS records and certificates, so don't add A or CNAME records for them.
- **CI** (`.github/workflows/web-app.yml`):
  - The `changes` job decides which application a push touched.
  - `frontend` runs `check`, `build` and `pnpm audit --prod --audit-level high`.
  - On `main`, `deploy-frontend` then runs `pnpm run deploy` and curls the site.
  - Build-only packages belong in `devDependencies`: a production dependency with a high advisory fails the audit and blocks every deploy.
- **Locally:**
  - `pnpm preview` runs the production Worker in `workerd`.
  - A manual deploy is `NEXT_PUBLIC_API_URL=https://api.sa7sa7.cc/api pnpm run deploy` after `npx wrangler login` to the client account.
  - `npx wrangler deployments list` and `npx wrangler rollback` revert a bad release.

## Backend: Railway

- **Source:**
  - The `api` service follows `main` of `garma-a/Sahsah`, with root directory `/web_app/backend` and watch pattern `/web_app/backend/**`.
  - "Wait for CI" (`checkSuites`) is on, so a red `backend` job stops the deploy.
  - Railpack builds with Node 24 and pnpm, taken from `package.json`. The start command is `node dist/main.js`.
- **Settings live on the service, not in a file:**
  - Values: one replica, `overlapSeconds: 0`, `drainingSeconds: 30`, restart `ON_FAILURE` ×10.
  - Change them with `railway api` (GraphQL `serviceInstanceUpdate`) or the dashboard.
  - Railway's `railway.json` config-as-code is deprecated and stops working on 2026-12-01; don't add one.
- **Single process:**
  - The gameplay lease (`claimGameplayProcess`) admits one API process.
  - That is why there is no deployment overlap and no healthcheck path: a healthcheck-gated deploy would start the new container while the old one holds the lease, and the new one would never become healthy.
  - Each deploy therefore stops the old container first, costing a few seconds of downtime.
- **Variables on `api`:** the meaning of each is in `web_app/backend/.env.example`. Production-specific choices:
  - `NODE_ENV=production`, `PORT=8080`, `LOG_LEVEL=info`
  - `CORS_ORIGINS=https://sa7sa7.cc,https://www.sa7sa7.cc`
  - `TRUSTED_PROXY_HOPS=1`: Railway's edge is one proxy.
  - `DATABASE_URL` is the `sahsah_app` runtime role over the private network, and `DATABASE_RUNTIME_ROLE=sahsah_app`.
  - `GAMEPLAY_ENABLED=true`, in **preview mode** (ADR 0017):
    - Hosts type `GAMEPLAY_PREVIEW_PASSCODE` (the "الكود السري" dialog) once per device.
    - `GAMEPLAY_PREVIEW_SECRET` signs preview credentials.
    - Real identity (`GAMEPLAY_IDENTITY_*`) replaces this later; the two never coexist.
  - `GAMEPLAY_JOIN_BASE_URL=https://sa7sa7.cc/join`
  - `R2_*` holds the read-only key. `GAMEPLAY_PUBLIC_MEDIA_BASE_URL` is the public bucket address.
  - `ADMIN_ENABLED=false`: AdminJS sessions are in memory and need a persistent store before production use.
  - Capacity follows the container's CPU and memory (ADR 0020), so no capacity variables are set.
- **Health:** `/api/health` is liveness. `/api/health/ready` returns 503 while the database is unreachable, and the frontend then shows "السيرفر مش متاح دلوقتي".

## Database

- The schema lives in a dedicated database, **`sahsah`**, not in Railway's default `railway` database. The dashboard's Database → Data tab only browses `railway`, so it shows "no tables". That is expected.
- **Roles** (created by `web_app/backend/scripts/database/provision.sql`):
  - `sahsah_owner` owns the schema and runs migrations. Its URL is stored as `SAHSAH_MIGRATION_DATABASE_URL` on the **Postgres** service, never on `api`.
  - `sahsah_app` is the restricted runtime role. API startup rejects the owner role.
- **No public access.** For any operator task, open a temporary TCP proxy, do the work, and delete the proxy:
  1. Run `npx @railway/cli tcp-proxy create --service Postgres --port 5432`.
  2. Connect through `<proxy host>:<port>`, using the stored URL with its host swapped and `?sslmode=no-verify` appended. Never print the password.
  3. Run `npx @railway/cli tcp-proxy delete <id> --service Postgres`.
- **Migrations are manual.** Startup refuses a database with unapplied migrations, and the API holds no owner credential. Apply a new migration before merging the PR that adds it. From `web_app/backend`, through the proxy:
  1. `MIGRATION_DATABASE_URL=… DATABASE_RUNTIME_ROLE=sahsah_app pnpm db:migrate`
  2. `pnpm db:grant-runtime`
  3. `pnpm db:status`
- **Content:**
  - `pnpm content:seed`, run with `MIGRATION_DATABASE_URL` through the proxy, loads `content/packs.json` and checks that every file in `content/assets.json` is in R2. It is safe to rerun. Production holds 19 categories and 912 questions.
  - Uploading new media is `pnpm content:upload` with the import key.
- **Backups:** dump through the proxy with `pg_dump -Fc -d sahsah`, and `pg_dumpall --roles-only` for the roles. Keep dumps outside the repository: the role dump contains password hashes.

## DNS on `sa7sa7.cc` (Cloudflare)

| Record | Value | Owner |
| --- | --- | --- |
| `sa7sa7.cc`, `www.sa7sa7.cc` | Worker custom domains | Wrangler (`wrangler.jsonc` routes) |
| `api` CNAME, DNS only | the target `npx @railway/cli domain status` prints for `api.sa7sa7.cc` | Railway custom domain; keep it unproxied so Railway issues the certificate |
| `_railway-verify.api` TXT | Railway ownership token | Railway |
| MX, SPF, DKIM, DMARC, `zoho-verification` | Zoho Mail | The client's email; leave them alone |

## Gotchas

- `railway scale <region>=1` **adds** a region rather than replacing the current one. Moving Postgres that way briefly configured two replicas. Change regions with `serviceInstanceUpdate` and a full `multiRegionConfig` (`{"europe-west4-drams3a":{"numReplicas":1}}`), then redeploy. A Postgres move migrates its volume, with about 1–2 minutes of downtime.
- The Railway CLI's OAuth login cannot create project tokens ("Not Authorized"). Use the dashboard, and only on a Pro workspace.
- `railway link` is per directory: run Railway commands from `web_app/backend`, or pass `--project`, `--environment` and `--service`.
- A stale `.next/dev/types` left by an old `next dev` breaks the OpenNext build's type check. Delete `.next` before building.
- Disabling page zoom and overscroll (`app/layout.tsx` viewport and `globals.css`) is deliberate: the game fills one landscape screen.
