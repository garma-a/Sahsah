import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import AppModule from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.get<string>("CORS_ORIGINS", "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(config.get("PORT", 3001)), config.get<string>("HOST", "0.0.0.0"));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
