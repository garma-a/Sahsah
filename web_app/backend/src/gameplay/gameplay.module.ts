import { Module } from "@nestjs/common";
import { GameplayService } from "./service.js";
import { GameplayController } from "./controller.js";
import { RoomOperations } from "./rooms.js";
import { ProjectionService } from "./projection.js";
import { GameOperations } from "./games.js";
import { CatalogService } from "./catalog.js";
import { RoomLifecycle } from "./lifecycle.js";
import { MediaService } from "./media.js";
import { GameplayRealtime } from "./realtime.js";
import { GameplayHttpInterceptor } from "./http.js";
import { GameplayMaintenance } from "./maintenance.js";
import { PreviewController } from "./preview.controller.js";

@Module({
  controllers: [GameplayController, PreviewController],
  providers: [
    GameplayService,
    RoomOperations,
    CatalogService,
    GameOperations,
    ProjectionService,
    RoomLifecycle,
    MediaService,
    GameplayRealtime,
    GameplayHttpInterceptor,
    GameplayMaintenance,
  ],
  exports: [GameplayService],
})
export default class GameplayModule {}
