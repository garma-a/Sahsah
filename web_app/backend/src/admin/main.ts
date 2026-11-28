import { existsSync } from "node:fs";
import { errorStack, log } from "../gameplay/platform/logging.js";
import { createAdminApplication } from "./app.js";

async function start() {
  // `pnpm build:admin` bundles the custom screens once; a wake from sleep must not repeat that work.
  if (existsSync(".adminjs/bundle.js")) process.env.ADMIN_JS_SKIP_BUNDLE = "true";
  const { app, close } = await createAdminApplication();
  const port = Number(process.env.ADMIN_PORT ?? process.env.PORT ?? 3002);
  const server = app.listen(port, process.env.HOST ?? "0.0.0.0", () => console.log(`Sahsah Admin listening on port ${port}`));
  const stop = () => {
    server.close(() => void close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

start().catch((error: unknown) => {
  log.error("admin.bootstrap", { code: "BOOTSTRAP_FAILED", stack: errorStack(error) });
  process.exitCode = 1;
});
