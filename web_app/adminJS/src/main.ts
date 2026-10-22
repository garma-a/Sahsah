import "dotenv/config";
import AdminJS, { Router as AdminJSRouter } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import express from "express";
import path from "node:path";

async function bootstrap() {
  // Add a database adapter and authentication when game resources are introduced.
  const admin = new AdminJS({
    rootPath: "/admin",
    resources: [],
    branding: { companyName: "Sahsah", withMadeWithLove: false },
  });
  await admin.initialize();

  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "sahsah-admin" });
  });
  // Express 5 blocks absolute paths inside pnpm's hidden .pnpm directory.
  // Allow only the public asset files explicitly listed by AdminJS.
  const router = express.Router();
  for (const asset of AdminJSRouter.assets) {
    router.get(asset.path, (_request, response, next) => {
      response.sendFile(path.resolve(asset.src), { dotfiles: "allow" }, (error) => {
        if (error) next(error);
      });
    });
  }
  app.use(admin.options.rootPath, AdminJSExpress.buildRouter(admin, router));
  app.get("/", (_request, response) => response.redirect(admin.options.rootPath));

  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3002);
  const server = app.listen(port, host, () => console.log(`Sahsah AdminJS: http://${host}:${port}/admin`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
