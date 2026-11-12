import { RoomCreation } from "./rooms/create.js";
import { GameplayTransactions } from "./platform/transaction.js";
import { GameplayOutbox } from "./platform/outbox.js";
import { RoomReceipts } from "./platform/receipts.js";
import { RoomAccess } from "./rooms/access.js";
import { GameplayIdentity } from "./platform/identity.js";
import { GameplayRuntime } from "./platform/runtime.js";
import { Module } from "@nestjs/common";
import { GameplayController } from "./controller.js";
import { RoomOperations } from "./rooms/operations.js";
import { ProjectionService } from "./games/projection.js";
import { GameOperations } from "./games/operations.js";
import { CatalogService } from "./catalog/catalog.js";
import { RoomLifecycle } from "./rooms/lifecycle.js";
import { MediaService } from "./media/media.js";
import { GameplayRealtime } from "./realtime/gateway.js";
import { GameplayHttpInterceptor } from "./platform/http.js";
import { GameplayMaintenance } from "./maintenance/maintenance.js";
import { PreviewController } from "./preview/controller.js";

@Module({
  controllers: [GameplayController, PreviewController],
  providers: [
    GameplayRuntime,
    GameplayIdentity,
    RoomAccess,
    RoomReceipts,
    GameplayOutbox,
    GameplayTransactions,
    RoomCreation,
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
  exports: [GameplayRuntime],
})
export default class GameplayModule {}
