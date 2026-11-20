# Sahsah frontend

Independent Next.js application. Use Node 24 LTS and pnpm 10.34.3.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` to configure the backend URL. `pnpm build` fails unless `NEXT_PUBLIC_API_URL` is set; on Vercel set it to the deployed API, including `/api`. Run `pnpm check` and `pnpm build`, then `pnpm start` to serve the production build.

This directory owns its dependencies, lockfile and build configuration. It can be installed and built outside the repository without any sibling application. Deploy to a separate Vercel project with this directory as the Root Directory and the Next.js preset.

## Deployment

Production runs on Cloudflare Workers as `sahsah-frontend` at https://sa7sa7.cc and https://www.sa7sa7.cc, built with OpenNext (`wrangler.jsonc`, `open-next.config.ts`). Every push to `main` that touches `web_app/frontend/` deploys after `check` and `build` pass (`deploy-frontend` in `.github/workflows/web-app.yml`, using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets). The workflow builds against `NEXT_PUBLIC_API_URL=https://api.sa7sa7.cc/api`.

`pnpm preview` runs the production build in the local Workers runtime. To deploy by hand, run `NEXT_PUBLIC_API_URL=https://api.sa7sa7.cc/api pnpm run deploy` after `npx wrangler login` to the client's Cloudflare account.
