# Sahsah

```text
.
├── sahsah_prototype/     # Original React/Vite game and its independent lockfile
├── web_app/             # pnpm workspace for the three new web services
│   ├── frontend/        # Next.js 16 + Tailwind v4 + shadcn/ui + Zustand
│   ├── backend/         # NestJS API
│   └── adminJS/         # AdminJS + Express, independent service
└── mobile_app/          # Flutter app source with Android and iOS projects
```

The existing playable game stays in `sahsah_prototype/`. The new web and mobile applications are basic starters for its future production version: team-name forms, a backend health endpoint, and an empty AdminJS dashboard. Gameplay, accounts, payments, database storage and cross-device multiplayer have not been migrated.

## Requirements

Node **24 LTS** and pnpm **10.34.3**. The `.mise.toml` file pins these tools. If pnpm is unavailable, the install scripts use `npx` to run the pinned version. Flutter is independent of the JavaScript tooling.

## Existing prototype

From the repository root:

```sh
npm run install:prototype
npm run dev
npm run check
npm test
npm run build
npm run preview
```

Root commands delegate to the moved app, so Vite loads its original configuration, environment, assets and optional Node service from the correct working directory. `npm run test:demo` and `npm run test:browser` also remain available. See [the prototype guide](sahsah_prototype/docs/RUNNING.md).

### Vercel

Keep the existing Vercel project's **Root Directory at the repository root** (`.` / blank). The root `vercel.json` explicitly sets:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Install command | `npm run install:prototype` |
| Build command | `npm run build` |
| Output directory | `sahsah_prototype/dist` |
| SPA rewrite | Every route falls back to `/index.html` |

Leave `VITE_DEMO_MODE` unset or `true`, as before. Only prototype dependencies are installed for this deployment; web and mobile changes do not add build requirements to it. No Vercel project or domain change is required for the existing root-based project. The repository changes take effect on the next deployment; they do not modify the currently live deployment.

If you deliberately change the project's Root Directory to `sahsah_prototype`, its original `vercel.json` still supports that independent deployment too. Do not point the existing prototype project at `web_app/frontend`.

The small root `.figma/make/` scripts also delegate to the prototype to preserve the Figma Make preview/deploy entrypoints. All original Figma configuration remains inside the prototype.

## Web services

Install all three services and run them together:

```sh
npm run install:web
npm run dev:web
```

The services have useful local defaults. Copy their `.env.example` files to `.env` to customize ports, API URL or CORS origins. Each service loads environment variables from its own folder. Restart the service after changing them.

| Service | URL | Run individually |
| --- | --- | --- |
| Frontend | http://localhost:3000 | `npm run dev:frontend` |
| Backend | http://localhost:3001/api/health | `npm run dev:backend` |
| AdminJS | http://127.0.0.1:3002/admin | `npm run dev:admin` |

```sh
npm run check:web
npm run build:web
```

After building, use `npm --prefix web_app/frontend start`, `npm --prefix web_app/backend start`, or `npm --prefix web_app/adminJS start` to start a service. Deploy the frontend as a **separate Vercel project** with Root Directory `web_app/frontend` and the Next.js preset. The backend and AdminJS are separate Node services.

The frontend uses the App Router, TypeScript, Tailwind v4's PostCSS plugin, shadcn-compatible Button/Input components and `components.json`, and a Zustand store scoped to its React provider. Edit team names to try the store; click the connection button to call the NestJS health endpoint. No external font download or running API is required for a frontend build.

To add shadcn components using its installed CLI:

```sh
cd web_app/frontend
npx --yes pnpm@10.34.3 exec shadcn add dialog
```

NestJS uses ESM, environment configuration, a global `/api` prefix, configurable CORS and a validation pipe. Add feature modules under `web_app/backend/src/`.

AdminJS is a separate ESM service with **no database resources or login configured yet**, bound to loopback by default. Choose the database/adapter and add authentication/session storage before exposing this service or attaching game data.

The workspace pins the AdminJS editor's TipTap core/PM/starter-kit to the same compatible v2 release to resolve an upstream missing-export error. The admin router explicitly serves AdminJS's known public asset files so Express 5 can read them from pnpm's hidden package directory. ESLint stays on v9 to match the plugins shipped by the current Next.js ESLint configuration.

Versions were checked against the npm registry when scaffolding: Next.js **16.4.2**, React **19.3.1**, Tailwind CSS **4.3.3**, Zustand **5.0.16**, NestJS **12.2.0** and AdminJS **7.8.17**. The prototype retains its existing dependency versions. The prototype and web workspace each have their own lockfile.

References: [Next.js setup](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next), [NestJS setup](https://docs.nestjs.com/first-steps), [AdminJS with Express](https://docs.adminjs.co/installation/plugins/express), [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).

## Mobile

See [mobile_app/README.md](mobile_app/README.md) for the source structure and future development commands. Flutter is **not installed or built locally** as part of this setup. Mobile packages, platform compilation and signing are intentionally unverified until a Flutter-capable environment is used.
