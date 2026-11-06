# Sahsah repository

After planning, implement each agreed change set on a new branch and open a new PR for the user's review before merging into `main`. Keep implementation changes off `main`; merge only after the user's approval.

- `sahsah_prototype/`: existing React/Vite presentation app. Its own `AGENTS.md` applies there. Keep its assets, behavior and independent lockfile intact.
- `web_app/frontend/`: Next.js 16 App Router, React, Tailwind CSS v4, shadcn/ui and Zustand.
- `web_app/backend/`: independent NestJS API, including the authenticated AdminJS dashboard under `src/admin/` at `/admin`.
- `mobile_app/`: Flutter source and Android/iOS platform projects. Do not install Flutter or run local Flutter/mobile builds unless the user explicitly changes that preference.

The repository root and `web_app/` are containers, not Node packages or pnpm workspaces. Each JavaScript application owns its `package.json`, `pnpm-lock.yaml`, dependencies, environment and commands. Install and run from the application's directory; preserve independent frozen installs. Applications communicate over HTTP, without sibling source imports or shared `node_modules`.

The root `vercel.json` builds only `sahsah_prototype/` using explicit install/build commands and preserves the SPA fallback. Keep the existing Vercel project's Root Directory at the repository root. The prototype also supports deploying directly from its own directory. The new frontend is a separate deployment.

Use Node 24 LTS and pnpm 10.34.3. Run `npm --prefix sahsah_prototype run check`, `npm --prefix sahsah_prototype test`, and `npm --prefix sahsah_prototype run build` for prototype changes; run its `test:deployment` for static deployment changes. For web changes, run frontend `check`/`build` and backend `check`/`test` from their respective directories. Backend tests build the API and exercise AdminJS authentication over HTTP.

AdminJS is disabled unless `ADMIN_ENABLED=true` and its email, password and session secret are configured. Keep its middleware before Nest's body parser. The starter dashboard has no database resources; its in-memory sessions need a persistent store before production admin use. Do not migrate prototype gameplay into the new starters unless asked.
