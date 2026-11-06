import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import HealthModule from "./health/health.module.js";
import DatabaseModule from "./database/database.module.js";
import GameplayModule from "./gameplay/gameplay.module.js";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, HealthModule, GameplayModule],
})
export default class AppModule {}
