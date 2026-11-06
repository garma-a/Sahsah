import "reflect-metadata";
import { StandardSchemaValidationPipe, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import AppModule from "./app.module.js";
import { mountAdminDashboard } from "./admin/admin-dashboard.js";
import { GameplayService } from "./gameplay/service.js";
import type { GameplayOptions } from "./gameplay/ports.js";
import { r2Signer } from "./gameplay/media.js";
import { GameplayWsAdapter } from "./gameplay/realtime.js";
import { json, type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";

export async function createApplication(
  options: { gameplay?: GameplayOptions } = {},
) {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config = app.get(ConfigService);
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.get(GameplayService).configure({
    ...options.gameplay,
    signMedia:
      options.gameplay?.signMedia ??
      ((options.gameplay?.enabled ?? process.env.GAMEPLAY_ENABLED === "true")
        ? r2Signer(process.env)
        : undefined),
  });
  app.setGlobalPrefix("api");
  app.useWebSocketAdapter(
    new GameplayWsAdapter(app, {
      maxSendBufferSize: 262144,
      maxConcurrentMessages: 1,
    }),
  );
  app.enableCors({
    origin: config
      .get<string>("CORS_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-Control-Secret",
      "X-Controller-Generation",
      "X-Guest-Proof",
    ],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
    new StandardSchemaValidationPipe(),
  );
  try {
    // Mount before Nest installs its body parser and catch-all handlers.
    await mountAdminDashboard(app, config);
    app.use("/api/v1", json({ limit: "16kb", strict: true }));
    const bodyError: ErrorRequestHandler = (error, _req, res, next) => {
      if (!error) return next();
      const status = error.status === 413 ? 413 : 400;
      const requestId = randomUUID();
      res.setHeader("X-Request-ID", requestId);
      res
        .status(status)
        .setHeader("Cache-Control", "private, no-store")
        .json({
          type: "urn:sahsah:problem:invalid-input",
          title: "Invalid request body",
          status,
          code: status === 413 ? "BODY_TOO_LARGE" : "INVALID_INPUT",
          requestId,
        });
    };
    app.use("/api/v1", bodyError);
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
