import { ConfigService } from "@nestjs/config";
import { createApplication } from "./application.js";
import { log, errorStack } from "./gameplay/platform/logging.js";

async function bootstrap() {
  const app = await createApplication();
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  const port = Number(config.get("PORT", 3001));
  await app.listen(port, config.get<string>("HOST", "0.0.0.0"));
  printLocalPreviewAccess(port);
}

/**
 * Local runs only: print the preview passcode so testers can sign in. A run counts as local when
 * it uses local media storage or a database on this machine; production refuses the former and a
 * deployment's database is never on localhost, so deployed logs never carry it.
 */
function printLocalPreviewAccess(port: number) {
  const passcode = process.env.GAMEPLAY_PREVIEW_PASSCODE;
  const local =
    process.env.NODE_ENV !== "production" &&
    (Boolean(process.env.GAMEPLAY_LOCAL_MEDIA_DIR) || onThisMachine(process.env.DATABASE_URL));
  if (!local || !passcode) return;
  console.log(`\n  Sahsah API ready on http://localhost:${port}\n  Preview passcode (local only): ${passcode}\n`);
}

function onThisMachine(url: string | undefined) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
}

bootstrap().catch((error: unknown) => {
  log.error("platform.bootstrap", { code: "BOOTSTRAP_FAILED", stack: errorStack(error) });
  process.exitCode = 1;
});
