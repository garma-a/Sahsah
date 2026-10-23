# Sahsah backend

Independent NestJS API with an optional authenticated AdminJS dashboard. Use Node 24 LTS and pnpm 10.34.3.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The API defaults to http://localhost:3001/api/health. Run `pnpm check`, `pnpm test` and `pnpm build`; use `pnpm start` after building. This directory can be copied, installed and run without the frontend, prototype or parent repository.

## AdminJS

The dashboard runs in this server at `/admin`, with its implementation in `src/admin/`. To enable it, set `ADMIN_ENABLED=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16+ characters) and `ADMIN_SESSION_SECRET` (32+ characters) in `.env`. Generate the secret with `openssl rand -hex 32`. Restart after changing configuration. Missing credentials prevent startup when admin is enabled.

Authentication uses an HttpOnly, SameSite=Lax session cookie scoped to `/admin`; production cookies require HTTPS. Configure the Express trusted proxy when terminating HTTPS upstream. The starter has no database resources and uses in-memory sessions; add a persistent session store before production admin use.

Add database adapters and resources here alongside the backend's data model. No separate admin installation or server is needed.
