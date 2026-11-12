import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import HealthModule from "./health/health.module.js";
import DatabaseModule from "./database/database.module.js";
import GameplayModule from "./gameplay/gameplay.module.js";
import { LoggerModule } from "nestjs-pino";
import { rootLogger } from "./gameplay/logging.js";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LoggerModule.forRootAsync({
    useFactory: () => ({ pinoHttp: { logger: rootLogger(), autoLogging: false }, forRoutes: [] }),
  }), DatabaseModule, HealthModule, GameplayModule],
})
export default class AppModule {}
