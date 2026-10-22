# Sahsah repository

- `sahsah_prototype/`: existing React/Vite presentation app. Its own `AGENTS.md` applies there. Keep its assets, behavior and independent lockfile intact.
- `web_app/frontend/`: Next.js 16 App Router, React, Tailwind CSS v4, shadcn/ui and Zustand.
- `web_app/backend/`: NestJS API.
- `web_app/adminJS/`: independent AdminJS/Express service, using ESM.
- `mobile_app/`: Flutter source and Android/iOS platform projects. Do not install Flutter or run local Flutter/mobile builds unless the user explicitly changes that preference.

The web services share a pnpm workspace at `web_app/`. The prototype stays outside that workspace so its Vercel install/build is independent. Root `dev`, `build`, `preview`, `start`, `check` and `test` commands delegate to the prototype. Root `vercel.json` continues deploying the prototype with the existing SPA fallback.

Use Node 24 LTS and pnpm 10.34.3. Run `npm run check`, `npm test`, `npm run build` for prototype changes and `npm run check:web`, `npm run build:web` for web scaffolding changes. Do not migrate prototype gameplay into the new starters unless asked.
