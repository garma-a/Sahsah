import { ConfigService } from "@nestjs/config";
import { createApplication } from "./application.js";

async function bootstrap() {
  const app = await createApplication();
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  await app.listen(Number(config.get("PORT", 3001)), config.get<string>("HOST", "0.0.0.0"));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
