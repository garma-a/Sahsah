# Sahsah

```text
.
├── sahsah_prototype/        # Independent React/Vite presentation app
│   ├── package.json
│   └── pnpm-lock.yaml
├── web_app/                # Container only; no package or workspace
│   ├── frontend/           # Independent Next.js application
│   │   ├── package.json
│   │   └── pnpm-lock.yaml
│   └── backend/            # Independent NestJS application
│       ├── src/admin/      # AdminJS dashboard, served by the backend
│       ├── package.json
│       └── pnpm-lock.yaml
├── mobile_app/             # Independent Flutter application
└── vercel.json             # Compatibility entrypoint for the live prototype
```

The repository root and `web_app/` organize applications. Each application installs, builds, runs and deploys from its own directory, with its own dependencies and lockfile. There is no shared JavaScript workspace. Frontend/backend communication uses HTTP.

The playable game remains in `sahsah_prototype/`. The new frontend, API and empty AdminJS dashboard are starters; gameplay, accounts, payments, persistent storage and multiplayer have not been migrated into them.

## Tooling

Use Node **24 LTS** and pnpm **10.34.3**. The root `.mise.toml` pins these tools for local development. Where pnpm is unavailable, substitute `npx --yes pnpm@10.34.3` for `pnpm` in the commands below. Each application can be copied out of this repository and installed on its own.

## Prototype

```sh
cd sahsah_prototype
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm check`, `pnpm test` and `pnpm build` in that directory. `pnpm preview` serves the build; `pnpm test:deployment` checks the built static presentation in Chromium, including deep links, gameplay, refresh and the absence of API requests. To run the same check on a published deployment, set `SAHSAH_SMOKE_URL=https://sahsah.vercel.app pnpm test:deployment`. See [the prototype guide](sahsah_prototype/docs/RUNNING.md).

### Existing Vercel deployment

The live prototype is [sahsah.vercel.app](https://sahsah.vercel.app/). Keep its Vercel project's **Root Directory at the repository root** (`.` / blank). The root `vercel.json` builds the isolated prototype directly:

| Setting | Value |
| --- | --- |
| Framework preset | Other (`framework: null`); the command below runs Vite |
| Install command | `npx --yes pnpm@10.34.3 --dir sahsah_prototype install --frozen-lockfile` |
| Build command | `npm --prefix sahsah_prototype run build` |
| Output directory | `sahsah_prototype/dist` |
| SPA rewrite | Every route falls back to `/index.html` |

Use Node **24.x** in Vercel's project settings. Leave `VITE_DEMO_MODE` unset or `true`. This deployment installs only the prototype's dependencies. It needs no frontend, NestJS, AdminJS or Flutter installation. The static build does not require an API server.

For a separate deployment whose Root Directory is `sahsah_prototype`, use that directory's own `vercel.json`, Vite preset and local commands. Keep the existing prototype project separate from the new Next.js frontend. Repository changes take effect on the next deployment and do not alter an already published deployment.

The root `.figma/make/` scripts enter the prototype directory before running its commands, preserving the Figma preview/deploy entrypoints.

## Frontend

```sh
cd web_app/frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. This is Next.js 16 App Router with React, Tailwind v4, shadcn/ui and Zustand. Copy `.env.example` to `.env.local` to change the API URL. It defaults to the backend at http://localhost:3001/api. The frontend builds without a running backend.

Run `pnpm check` and `pnpm build`; run `pnpm start` after building. Deploy it as a **separate Vercel project**, with Root Directory `web_app/frontend` and the Next.js preset. Its lockfile and build are independent of every other application.

To add a shadcn component, run `pnpm exec shadcn add dialog` from this directory.

## Backend and AdminJS

```sh
cd web_app/backend
pnpm install --frozen-lockfile
pnpm dev
```

The NestJS API listens at http://localhost:3001/api/health. Copy `.env.example` to `.env` to change the bind address, port and allowed frontend origins. Run `pnpm check`, `pnpm test` and `pnpm build`; run `pnpm start` after building. Backend tests cover the API, admin disabled/misconfigured states, login, session cookies and AdminJS asset delivery.

AdminJS belongs to this backend at `src/admin/` and shares its server at **http://localhost:3001/admin**. It uses the supported Express integration directly with Nest's Express server; there is no separate admin package, process, port or dependency installation. Keeping it with the API also gives future database resources one owner.

The dashboard is disabled by default. To enable it in the backend's `.env`, set:

```dotenv
ADMIN_ENABLED=true
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-password-of-at-least-16-characters
ADMIN_SESSION_SECRET=your-random-secret-of-at-least-32-characters
```

Generate a session secret with `openssl rand -hex 32`, and restart the backend after editing `.env`. Enabling the dashboard without valid credentials fails startup. Login protects the dashboard; public assets remain available to render the login page. The cookie is HttpOnly, SameSite=Lax, scoped to `/admin`, and Secure in production. Production HTTPS behind a proxy requires configuring Express's trusted proxy for your deployment.

The dashboard currently has no database resources. It uses an in-memory session store for the starter; configure a persistent session store before production admin use. Add your database adapter and resources here when implementing the real backend. The prototype's simulated `/admin` editor remains a separate feature of the presentation app.

The backend alone pins AdminJS's TipTap core/PM/starter-kit to the same compatible v2 release. Frontend dependencies and versions do not inherit these overrides.

References: [AdminJS Express integration](https://docs.adminjs.co/installation/plugins/express), [Vercel build settings](https://vercel.com/docs/builds/configure-a-build).

## Mobile

See [mobile_app/README.md](mobile_app/README.md). Flutter remains separate from the JavaScript applications and is not installed or built as part of this change.
