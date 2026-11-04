import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import AppModule from "./app.module.js";
import { mountAdminDashboard } from "./admin/admin-dashboard.js";

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.get<string>("CORS_ORIGINS", "http://localhost:3000")
      .split(",").map((origin) => origin.trim()).filter(Boolean),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  try {
    // Mount before Nest installs its body parser and catch-all handlers.
    await mountAdminDashboard(app, config);
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
