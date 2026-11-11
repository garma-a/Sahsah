import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  SerializeOptions,
  StandardSchemaSerializerInterceptor,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { id, position, schemas } from "./contract.js";
import { GameplayProblemFilter } from "./problem.js";
import { GameplayService } from "./service.js";
import type { Contract } from "./contract.js";
import { RoomOperations } from "./rooms.js";
import { ProjectionService } from "./projection.js";
import { GameOperations } from "./games.js";
import { CatalogService } from "./catalog.js";
import { RoomLifecycle } from "./lifecycle.js";
import { MediaService } from "./media.js";
import { GameplayHttpInterceptor } from "./http.js";

@Controller("v1")
@UseFilters(GameplayProblemFilter)
@UseInterceptors(GameplayHttpInterceptor, StandardSchemaSerializerInterceptor)
export class GameplayController {
  constructor(
    private service: GameplayService,
    private rooms: RoomOperations,
    private projections: ProjectionService,
    private games: GameOperations,
    private catalog: CatalogService,
    private lifecycle: RoomLifecycle,
    private media: MediaService,
  ) {}
  @Get("categories")
  @SerializeOptions({ schema: schemas.CategoryPage })
  async categories(@Query() query: Record<string, unknown>) {
    return this.catalog.categories(query);
  }
  @Get("categories/:categoryId/packs")
  @SerializeOptions({ schema: schemas.PackPage })
  async packs(
    @Req() req: Request,
    @Param("categoryId") categoryId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.catalog.packs(
      req.headers.authorization ? await this.service.actor(req) : undefined,
      id(categoryId),
      query,
    );
  }
  @Get("gameplay/availability")
  @SerializeOptions({ schema: schemas.Availability })
  availability() {
    this.service.enabled();
    return this.service.admission.availability();
  }
  @Post("rooms")
  @SerializeOptions({ schema: schemas.CreateRoomReceipt })
  async create(
    @Req() req: Request,
    @Body({ schema: schemas.CreateRoom }) body: Contract<"CreateRoom">,
  ) {
    const actor = await this.service.actor(req),
      operationId = this.service.operation(req);
    await this.lifecycle.prepareCreate(actor, operationId);
    return this.service.create(actor, operationId, body);
  }
  @Get("rooms/:roomId/invitation")
  @SerializeOptions({ schema: schemas.Invitation })
  async invitation(@Req() req: Request, @Param("roomId") roomId: string) {
    return this.rooms.invitation(await this.service.actor(req), id(roomId));
  }
  @Get("room-invitations/:code")
  @SerializeOptions({ schema: schemas.InvitationPreview })
  async preview(@Param("code") code: string) {
    return this.rooms.preview(code);
  }
  @Post("room-invitations/:code/memberships")
  @SerializeOptions({ schema: schemas.JoinReceipt })
  async join(
    @Req() req: Request,
    @Param("code") code: string,
    @Body({ schema: schemas.JoinRoom }) body: Contract<"JoinRoom">,
  ) {
    const actor =
        body.identity === "account" ? await this.service.actor(req) : undefined,
      operationId = this.service.operation(req);
    await this.lifecycle.prepareJoin(code, operationId);
    return this.rooms.join(code, actor, operationId, body);
  }
  @Get("rooms/current")
  @SerializeOptions({ schema: schemas.CurrentRoomResponse })
  async current(@Req() req: Request) {
    return this.lifecycle.current(await this.service.actor(req));
  }
  @Get("rooms/:roomId")
  @SerializeOptions({ schema: schemas.Snapshot })
  async room(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Query("language") language?: string,
  ) {
    return this.projections.room(
      await this.service.actor(req),
      id(roomId),
      language,
    );
  }
  @Post("rooms/:roomId/invitation/rotations")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.RoomReceipt })
  async rotate(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.RoomMutation }) body: Contract<"RoomMutation">,
  ) {
    return this.rooms.rotate(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Put("rooms/:roomId/memberships/me/readiness")
  @SerializeOptions({ schema: schemas.MemberReceipt })
  async ready(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.Ready }) body: Contract<"Ready">,
  ) {
    return this.rooms.memberChange(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
      true,
    );
  }
  @Patch("rooms/:roomId/memberships/me")
  @SerializeOptions({ schema: schemas.MemberReceipt })
  async member(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.MemberPatch }) body: Contract<"MemberPatch">,
  ) {
    return this.rooms.memberChange(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
      false,
    );
  }
  @Put("rooms/:roomId/setup")
  @SerializeOptions({ schema: schemas.RoomReceipt })
  async setup(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.SaveSetup }) body: Contract<"SaveSetup">,
  ) {
    return this.rooms.saveSetup(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Post("rooms/:roomId/games")
  @SerializeOptions({ schema: schemas.StartReceipt })
  async start(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.StartGame }) body: Contract<"StartGame">,
  ) {
    return this.games.start(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Get("games/:gameId")
  @SerializeOptions({ schema: schemas.Snapshot })
  async game(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Query("language") language?: string,
  ) {
    return this.projections.game(
      await this.service.actor(req),
      id(gameId),
      language,
    );
  }
  @Get("games/:gameId/result")
  @SerializeOptions({ schema: schemas.Result })
  async result(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Query("language") language?: string,
  ) {
    return this.projections.game(
      await this.service.actor(req),
      id(gameId),
      language,
      true,
    );
  }
  @Post("games/:gameId/commands")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.GameCommandReceipt })
  async command(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body({ schema: schemas.GameCommand }) body: Contract<"GameCommand">,
  ) {
    return this.games.command(
      await this.service.actor(req),
      id(gameId),
      this.service.operation(req),
      body,
    );
  }
  @Put("games/:gameId/questions/:boardPosition/:questionPosition/feedback")
  @SerializeOptions({ schema: schemas.FeedbackReceipt })
  async feedback(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Param("boardPosition") board: string,
    @Param("questionPosition") question: string,
    @Body({ schema: schemas.FeedbackRequest }) body: Contract<"FeedbackRequest">,
  ) {
    return this.games.feedback(
      await this.service.actor(req),
      id(gameId),
      position(board),
      position(question),
      this.service.operation(req),
      body,
    );
  }
  @Get("rooms/:roomId/control")
  @SerializeOptions({ schema: schemas.ControlStatus })
  async control(@Req() req: Request, @Param("roomId") roomId: string) {
    return this.lifecycle.status(await this.service.actor(req), id(roomId));
  }
  @Post("rooms/:roomId/control")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.ControlReceipt })
  async takeover(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.TakeControl }) body: Contract<"TakeControl">,
  ) {
    return this.lifecycle.takeover(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Post("rooms/:roomId/lobby")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.RoomReceipt })
  async lobby(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.RoomMutation }) body: Contract<"RoomMutation">,
  ) {
    return this.lifecycle.replay(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Post("rooms/:roomId/closure")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.RoomReceipt })
  async close(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.RoomMutation }) body: Contract<"RoomMutation">,
  ) {
    return this.lifecycle.close(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Post("rooms/:roomId/memberships/me/departure")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.Receipt })
  async leave(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.Departure }) body: Contract<"Departure">,
  ) {
    return this.lifecycle.memberAction(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
      "leave",
    );
  }
  @Post("rooms/:roomId/memberships/:membershipId/removal")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.MemberReceipt })
  async remove(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Param("membershipId") memberId: string,
    @Body({ schema: schemas.RoomMutation }) body: Contract<"RoomMutation">,
  ) {
    return this.lifecycle.memberAction(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
      "remove",
      id(memberId),
    );
  }
  @Post("rooms/:roomId/memberships/:membershipId/unblock")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.MemberReceipt })
  async unblock(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Param("membershipId") memberId: string,
    @Body({ schema: schemas.RoomMutation }) body: Contract<"RoomMutation">,
  ) {
    return this.lifecycle.memberAction(
      await this.service.actor(req),
      id(roomId),
      this.service.operation(req),
      body,
      "unblock",
      id(memberId),
    );
  }
  @Post("rooms/:roomId/memberships/me/account-binding")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.MemberReceipt })
  async binding(
    @Req() req: Request,
    @Param("roomId") roomId: string,
    @Body({ schema: schemas.Binding }) body: Contract<"Binding">,
  ) {
    return this.lifecycle.bind(
      await this.service.actor(req),
      await this.service.identity(String(req.headers["x-guest-proof"] ?? "")),
      id(roomId),
      this.service.operation(req),
      body,
    );
  }
  @Post("games/:gameId/media-access")
  @HttpCode(200)
  @SerializeOptions({ schema: schemas.MediaLinks })
  async authorizeMedia(
    @Req() req: Request,
    @Param("gameId") gameId: string,
    @Body({ schema: schemas.MediaRequest }) body: Contract<"MediaRequest">,
  ) {
    return this.media.access(await this.service.actor(req), id(gameId), body);
  }
}
