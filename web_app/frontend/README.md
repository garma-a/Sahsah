# Sahsah frontend

Independent Next.js application. Use Node 24 LTS and pnpm 10.34.3.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` to configure the backend URL. Run `pnpm check` and `pnpm build`, then `pnpm start` to serve the production build.

This directory owns its dependencies, lockfile and build configuration. It can be installed and built outside the repository without any sibling application. Deploy to a separate Vercel project with this directory as the Root Directory and the Next.js preset.
