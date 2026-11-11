import { type OnModuleDestroy } from "@nestjs/common";
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayInit,
} from "@nestjs/websockets";
import { WsAdapter } from "@nestjs/platform-ws";
import { WebSocket, type RawData, type WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as s from "../database/schema/index.js";
import { GameplayService, type Actor, type Member } from "./service.js";
import { ProjectionService } from "./projection.js";
import { GameOperations } from "./games.js";
import { frame } from "./realtime-contract.js";
import { canonical, equalProof, proof } from "./proof.js";
import { questionView, answerView } from "./content.js";
import { GameplayProblem, requireState } from "./problem.js";
import { clientAddress } from "./http.js";
import type { Contract } from "./contract.js";
import type { RealtimeTypes } from "./contracts/realtime-types.js";
import type { ServerFrame } from "./realtime-contract.js";
import type { UnionFields } from "./content.js";
type Snapshot = Contract<"Snapshot">;
type ServerPayload = UnionFields<ServerFrame["data"]>;

import type { IncomingMessage } from "node:http";

function viewerSnapshot(snapshot: Snapshot): Snapshot {
  const view = snapshot.view;
  const { controls: _controls, feedback: _feedback, ...publicView } = { controls: undefined, feedback: undefined, ...view };
  const result: UnionFields<Snapshot["view"]> = { ...publicView, audience: "viewer" };
  if ("question" in view) {
    const { audio: _audio, ...question } = { audio: undefined, ...view.question };
    result.question = question;
  }
  if ("answer" in view) {
    const { forwardAudio: _forward, ...answer } = { forwardAudio: undefined, ...view.answer };
    result.answer = answer;
  }
  // Removing host-only fields preserves the corresponding viewer contract branch.
  return { ...snapshot, view: result } as Snapshot;
}
function timedSnapshot(snapshot: Snapshot, now: string): Snapshot {
  const view = snapshot.view,
    timer = "timer" in view ? view.timer : undefined;
  const result = {
    ...snapshot,
    serverTime: now,
    view:
      timer?.state === "running"
        ? {
            ...view,
            timer: {
              ...timer,
              remainingMs: Math.max(
                0,
                Math.min(
                  60000,
                  Date.parse(String(timer.deadlineAt)) - Date.parse(now),
                ),
              ),
            },
          }
        : view,
  };
  // Updating only the existing timer preserves its correlated snapshot branch.
  return result as Snapshot;
}

const pendingSources = new Map<string, number>();
const pendingUpgrades = new WeakMap<IncomingMessage, () => void>();
let pendingCount = 0;
function verifyUpgrade(info: { origin: string; req: IncomingMessage }) {
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((v) => v.trim());
  const source = clientAddress(info.req);
  if (
    info.req.url !== "/api/v1/realtime" ||
    (info.origin && !origins.includes(info.origin)) ||
    pendingCount >= 64 ||
    (pendingSources.get(source) ?? 0) >= 8
  )
    return false;
  pendingCount++;
  pendingSources.set(source, (pendingSources.get(source) ?? 0) + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    pendingCount--;
    const count = (pendingSources.get(source) ?? 1) - 1;
    if (count) pendingSources.set(source, count);
    else pendingSources.delete(source);
  };
  pendingUpgrades.set(info.req, release);
  info.req.socket.once("close", release);
  return true;
}

export class GameplayWsAdapter extends WsAdapter {
  // The gateway owns a bounded serial protocol state machine, including the
  // unauthenticated phase. Nest's independent async event dispatch cannot gate it.
  override bindMessageHandlers() {}
}
interface Connection {
  socket: WebSocket;
  streamId: string;
  sequence: bigint;
  roomId?: string;
  memberId?: string;
  actor?: Actor;
  language: Contract<"Language">;
  busy: boolean;
  closed: boolean;
  queue: RawData[];
  tokens: number;
  tokenAt: number;
  lastResync: number;
  playbackSequence: bigint;
  playbackAt: number;
  authTimer: ReturnType<typeof setTimeout>;
  pingAt: number;
  pongAt: number;
  warned: boolean;
  releaseUpgrade?: () => void;
}
interface RoomStream {
  dirty: number;
  running: boolean;
  published?: number;
  playback?: RealtimeTypes["PresenceData"]["playback"];
  playbackSource?: string;
  cache?: Map<string, { source: string; host: boolean; value: Snapshot }>;
}

@WebSocketGateway({
  path: "/api/v1/realtime",
  maxPayload: 8192,
  perMessageDeflate: false,
  verifyClient: verifyUpgrade,
})
export class GameplayRealtime
  implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy
{
  private connections = new Set<Connection>();
  private members = new Map<string, Connection>();
  private rooms = new Map<string, RoomStream>();
  private pendingRooms = new Set<string>();
  private activeBuilds = 0;
  private stopped = false;
  private epoch = randomUUID();
  private timer?: ReturnType<typeof setInterval>;
  private server?: WebSocketServer;
  constructor(
    private core: GameplayService,
    private projections: ProjectionService,
    private games: GameOperations,
  ) {}
  afterInit(server: WebSocketServer) {
    this.server = server;
    this.core.onCommitted = (roomId) => this.invalidate(roomId);
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
  }
  handleConnection(socket: WebSocket, request: IncomingMessage) {
    if (
      !this.core.options.enabled ||
      [...this.connections].filter((c) => !c.actor).length >= 64 ||
      this.connections.size >= 1200
    ) {
      socket.close(1013, "Capacity");
      return;
    }
    const c: Connection = {
      socket,
      streamId: randomUUID(),
      sequence: 0n,
      language: "ar",
      busy: false,
      closed: false,
      queue: [],
      tokens: 20,
      tokenAt: Date.now(),
      lastResync: 0,
      playbackSequence: -1n,
      playbackAt: 0,
      pingAt: Date.now(),
      pongAt: Date.now(),
      warned: false,
      authTimer: setTimeout(
        () => this.stop(c, "protocol_error", "AUTHENTICATION_TIMEOUT"),
        5000,
      ),
      releaseUpgrade: pendingUpgrades.get(request),
    };
    c.authTimer.unref();
    this.connections.add(c);
    socket.on("error", () => this.cleanup(c));
    socket.on("close", () => this.cleanup(c));
    socket.on("pong", () => {
      c.pongAt = Date.now();
    });
    socket.on("message", (raw, binary) => {
      if (c.closed || socket.readyState !== WebSocket.OPEN) return;
      if (binary || c.queue.length >= 20) {
        this.stop(c, "protocol_error", "INVALID_FRAME");
        return;
      }
      c.tokens = Math.min(20, c.tokens + (Date.now() - c.tokenAt) / 100);
      c.tokenAt = Date.now();
      if (c.tokens < 1) {
        this.stop(c, "protocol_error", "RATE_LIMITED");
        return;
      }
      c.tokens--;
      c.queue.push(raw);
      void this.consume(c);
    });
  }
  current(c: Connection) {
    return (
      !c.closed &&
      c.socket.readyState === WebSocket.OPEN &&
      (!c.memberId || this.members.get(`${c.roomId}:${c.memberId}`) === c)
    );
  }
  private async consume(c: Connection) {
    if (c.busy) return;
    c.busy = true;
    try {
      while (c.queue.length && this.current(c)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(c.queue.shift()!.toString());
        } catch {
          throw new GameplayProblem(400, "INVALID_FRAME");
        }
        const message = frame(parsed);
        if (
          message.event === "authenticate" ||
          message.event === "reauthenticate"
        ) {
          const refresh = message.event === "reauthenticate";
          requireState(
            refresh ? !!c.actor : !c.actor,
            refresh ? "AUTHENTICATE_FIRST" : "ALREADY_AUTHENTICATED",
            401,
          );
          if (refresh)
            await this.core.scheduler.run("protected", () => this.authority(c));
          const actor = await this.core.scheduler.run(
            this.core.knownCredential(String(message.data.authorization))
              ? "protected"
              : "public",
            () => this.core.identity(String(message.data.authorization)),
          );
          await this.core.scheduler.run("protected", () =>
            this.authenticate(
              c,
              refresh
                ? { ...message.data, roomId: c.roomId, language: c.language }
                : message.data,
              refresh,
              actor,
            ),
          );
        } else {
          requireState(c.actor, "AUTHENTICATE_FIRST", 401);
          await this.core.scheduler.run("protected", async () => {
            await this.authority(c);
            if (!this.current(c)) return;
            if (message.event === "set_language") {
              c.language = message.data.language;
              this.invalidate(c.roomId!);
            } else if (message.event === "resync") {
              requireState(
                Date.now() - c.lastResync >= 1000,
                "RATE_LIMITED",
                429,
              );
              c.lastResync = Date.now();
              this.invalidate(c.roomId!);
            } else if (message.event === "playback_status")
              await this.playback(c, message.data);
          });
        }
      }
    } catch (error) {
      this.stop(
        c,
        "protocol_error",
        error instanceof GameplayProblem ? error.code : "PROTOCOL_FAILURE",
      );
    } finally {
      c.busy = false;
    }
  }
  private async authenticate(
    c: Connection,
    data: Omit<RealtimeTypes["ClientAuthenticateData"], "roomId" | "language" | "protocolVersion"> & { roomId?: string; language?: Contract<"Language"> },
    refresh: boolean,
    actor: Actor,
  ) {
    const room = await this.core.room(
      this.core.database.db,
      String(data.roomId),
      false,
    );
    actor.controlSecret = data.controllerSecret;
    actor.generation = room.controllerGeneration;
    const member = await this.core.membership(
      this.core.database.db,
      room,
      actor,
    );
    if (actor.account?.accountId === room.ownerAccountId)
      this.core.host(room, actor);
    if (room.currentGameId && room.presentationMode === "game") {
      const game = await this.games.game(
        this.core.database.db,
        room.currentGameId,
        false,
      );
      if (game.status === "active")
        await this.projections.authorize(
          this.core.database.db,
          game,
          actor,
          false,
        );
    }
    requireState(this.current(c), "STREAM_REPLACED", 403);
    if (refresh)
      requireState(
        c.memberId === member.id &&
          c.actor?.account?.accountId === actor.account?.accountId &&
          c.actor?.member?.id === actor.member?.id,
        "PRINCIPAL_CHANGED",
        403,
      );
    // Recheck authority after async verification before changing the stream map.
    const checked = await this.fence(room.id);
    this.check(actor, member.id, checked);
    requireState(this.current(c), "STREAM_REPLACED", 403);
    c.actor = actor;
    c.roomId = room.id;
    c.memberId = member.id;
    c.language = data.language!;
    c.warned = false;
    clearTimeout(c.authTimer);
    c.releaseUpgrade?.();
    const key = `${room.id}:${member.id}`,
      old = this.members.get(key);
    this.members.set(key, c);
    // The seat is still valid: another tab or device took over this stream.
    if (old && old !== c) this.stop(old, "stream_replaced", "STREAM_REPLACED");
    this.rooms.set(
      room.id,
      this.rooms.get(room.id) ?? { dirty: 0, running: false },
    );
    this.send(c, "authenticated", {
      language: c.language,
      ...(actor.account
        ? {
            credentialExpiresAt: new Date(
              actor.account.expiresAt,
            ).toISOString(),
          }
        : {}),
    });
    this.invalidate(room.id);
  }
  private async fence(roomId: string) {
    // One SQL statement supplies a consistent source vector and all current
    // grants. Bigint/bytea decoding stays in Drizzle instead of lossy JSON casts.
    const rows = await this.core.database.db
      .select({
        room: s.rooms,
        game: s.games,
        member: s.roomMemberships,
        state: s.accounts.state,
        now: sql<string>`clock_timestamp()`,
      })
      .from(s.rooms)
      .leftJoin(s.games, eq(s.games.id, s.rooms.currentGameId))
      .leftJoin(
        s.roomMemberships,
        and(
          eq(s.roomMemberships.roomId, s.rooms.id),
          isNull(s.roomMemberships.leftAt),
          isNull(s.roomMemberships.removedAt),
        ),
      )
      .leftJoin(s.accounts, eq(s.accounts.id, s.roomMemberships.accountId))
      .where(eq(s.rooms.id, roomId));
    requireState(rows[0], "NOT_FOUND", 404);
    return {
      room: rows[0].room,
      game: rows[0].game ?? undefined,
      now: new Date(rows[0].now).toISOString(),
      rows: rows.flatMap((r) =>
        r.member ? [{ member: r.member, state: r.state }] : [],
      ),
    };
  }
  private check(
    actor: Actor,
    memberId: string,
    fence: Awaited<ReturnType<GameplayRealtime["fence"]>>,
  ) {
    const { room, game, rows } = fence;
    requireState(!room.closedAt, "ROOM_CLOSED", 403);
    const row = rows.find((r) => r.member.id === memberId),
      m = row?.member;
    requireState(
      m &&
        !m.leftAt &&
        !m.removedAt &&
        (!m.accountId || row?.state === "active"),
      "MEMBERSHIP_REVOKED",
      403,
    );
    if (actor.member)
      requireState(
        !m.accountId &&
          !m.reconnectRevokedAt &&
          equalProof(
            m.reconnectCredentialHash,
            proof("guest", m.id, actor.secret),
          ),
        "MEMBERSHIP_REVOKED",
        403,
      );
    else
      requireState(
        actor.account &&
          actor.account.expiresAt > Date.now() &&
          actor.account.accountId === m.accountId,
        "CREDENTIAL_EXPIRED",
        401,
      );
    if (actor.account?.accountId === room.ownerAccountId) {
      this.core.host(room, actor);
      if (game?.status === "active") this.games.host(game, actor);
    }
  }
  private async authority(c: Connection) {
    requireState(this.current(c), "STREAM_REPLACED", 403);
    const fence = await this.fence(c.roomId!);
    this.check(c.actor!, c.memberId!, fence);
    return fence;
  }
  invalidate(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || this.stopped) return;
    room.dirty++;
    if (!room.running) this.pendingRooms.add(roomId);
    this.pump();
  }
  private pump() {
    while (!this.stopped && this.activeBuilds < 2 && this.pendingRooms.size) {
      const roomId = this.pendingRooms.values().next().value!;
      this.pendingRooms.delete(roomId);
      const room = this.rooms.get(roomId);
      if (!room || room.running) continue;
      room.running = true;
      this.activeBuilds++;
      let failed = false;
      void this.core.scheduler
        .run("protected", () => this.publish(roomId, room))
        .catch(() => {
          failed = true;
          if (this.rooms.has(roomId)) this.pendingRooms.add(roomId);
        })
        .finally(() => {
          room.running = false;
          this.activeBuilds--;
          if (this.rooms.has(roomId) && room.published !== room.dirty)
            this.pendingRooms.add(roomId);
          if (failed) {
            const retry = setTimeout(() => this.pump(), 25);
            retry.unref();
          } else this.pump();
        });
    }
  }
  private async publish(roomId: string, stream: RoomStream) {
    try {
      for (
        let pass = 0;
        pass < 3 && this.rooms.get(roomId) === stream;
        pass++
      ) {
        const generation = stream.dirty;
        const recipients = [...this.members.values()].filter(
          (c) => c.roomId === roomId && this.current(c),
        );
        if (!recipients.length) break;
        const groups = new Map<
          string,
          { actor: Actor; language: Contract<"Language">; recipients: Connection[] }
        >();
        const initial = await this.fence(roomId);
        for (const c of recipients) {
          try {
            this.check(c.actor!, c.memberId!, initial);
          } catch (e) {
            this.revoke(c, e);
            continue;
          }
          const key = `${c.actor?.account?.accountId === initial.room.ownerAccountId ? "host" : "viewer"}:${c.language}`;
          const group = groups.get(key) ?? {
            actor: c.actor!,
            language: c.language,
            recipients: [],
          };
          group.recipients.push(c);
          groups.set(key, group);
        }
        const built: {
          value: Snapshot;
          recipients: Connection[];
          language: Contract<"Language">;
        }[] = [];
        const sourceKey = canonical({
          roomVersion: String(initial.room.stateVersion),
          ...(initial.game && initial.room.presentationMode === "game"
            ? this.games.fields(initial.game)
            : {}),
        });
        stream.cache ??= new Map();
        for (const group of [...groups.values()].sort(
          (a, b) =>
            Number(b.actor.account?.accountId === initial.room.ownerAccountId) -
            Number(a.actor.account?.accountId === initial.room.ownerAccountId),
        )) {
          const host =
            group.actor.account?.accountId === initial.room.ownerAccountId;
          let cached = stream.cache.get(group.language);
          if (
            !cached ||
            cached.source !== sourceKey ||
            (host && !cached.host)
          ) {
            cached = {
              source: sourceKey,
              host,
              value: await this.projections.room(
                group.actor,
                roomId,
                group.language,
              ),
            };
            stream.cache.set(group.language, cached);
            this.core.metrics.projections++;
          }
          built.push({
            value: host ? cached.value : viewerSnapshot(cached.value),
            recipients: group.recipients,
            language: group.language,
          });
        }
        const fence = await this.fence(roomId);
        const source: Contract<"LobbySource"> | Contract<"GameSource"> = {
          roomVersion: String(fence.room.stateVersion),
          ...(fence.game && fence.room.presentationMode === "game"
            ? this.games.fields(fence.game)
            : {}),
        };
        if (
          generation !== stream.dirty ||
          built.some((b) => canonical(b.value.source) !== canonical(source))
        ) {
          stream.dirty++;
          continue;
        }
        const playbackSource = canonical(source);
        if (stream.playbackSource !== playbackSource) {
          stream.playback = undefined;
          stream.playbackSource = playbackSource;
        }
        for (const b of built)
          for (const c of b.recipients) {
            if (!this.current(c) || c.language !== b.language) continue;
            try {
              this.check(c.actor!, c.memberId!, fence);
              this.send(c, "state", timedSnapshot(b.value, fence.now));
              this.presence(
                c,
                fence.rows.map((r) => r.member),
                stream,
              );
            } catch (e) {
              this.revoke(c, e);
            }
          }
        stream.published = generation;
        if (stream.dirty === generation) break;
      }
    } catch (error) {
      // A representative can lose authority during a consistent projection
      // read. Recheck every grant; one member leaving must not evict teammates.
      stream.cache?.clear();
      try {
        const latest = await this.fence(roomId);
        let survivors = 0;
        for (const c of [...this.members.values()])
          if (c.roomId === roomId && this.current(c)) {
            try {
              this.check(c.actor!, c.memberId!, latest);
              survivors++;
            } catch (revoked) {
              this.core.forgetCredential(c.actor!);
              this.revoke(c, revoked);
            }
          }
        const authorizationFailure =
          error instanceof GameplayProblem &&
          [
            "FORBIDDEN",
            "CONTROLLER_FENCED",
            "MEMBERSHIP_REVOKED",
            "PARTICIPATION_ENDED",
            "CREDENTIAL_EXPIRED",
            "ROOM_CLOSED",
            "NOT_FOUND",
          ].includes(error.code);
        if (survivors && authorizationFailure) stream.dirty++;
        else {
          stream.published = stream.dirty;
          for (const c of this.members.values())
            if (c.roomId === roomId)
              this.send(c, "resync_required", {
                code: "PROJECTION_UNAVAILABLE",
              });
        }
      } catch {
        stream.published = stream.dirty;
        for (const c of [...this.members.values()])
          if (c.roomId === roomId) {
            this.send(c, "resync_required", { code: "SERVICE_UNAVAILABLE" });
            this.cleanup(c);
            c.socket.close(1013, "Service unavailable");
          }
      }
    }
  }

  private presence(c: Connection, members: Member[], room: RoomStream) {
    this.send(c, "presence", {
      processEpoch: this.epoch,
      members: members
        .filter((m) => !m.leftAt && !m.removedAt)
        .map((m) => ({
          membershipId: m.id,
          connected: !!this.members.get(`${c.roomId}:${m.id}`),
        })),
      ...(room.playback ? { playback: room.playback } : {}),
    });
  }
  private async playback(c: Connection, data: RealtimeTypes["PlaybackData"]) {
    const { game, room } = await this.authority(c);
    requireState(
      game?.status === "active" && game.id === data.gameId,
      "PLAYBACK_UNAVAILABLE",
    );
    this.games.host(game, c.actor!);
    requireState(
      String(game.stateVersion) === data.gameVersion &&
        String(game.controllerGeneration) === data.controllerGeneration,
      "STALE_PLAYBACK",
    );
    const sequence = BigInt(String(data.playbackSequence));
    if (sequence <= c.playbackSequence) return;
    requireState(Date.now() - c.playbackAt >= 250, "RATE_LIMITED", 429);
    c.playbackAt = Date.now();
    const snapshot = await this.projections.room(c.actor!, room.id, c.language),
      view = snapshot.view;
    const permitted = [
      ("question" in view && "audio" in view.question ? view.question.audio : undefined),
      ("answer" in view && "forwardAudio" in view.answer ? view.answer.forwardAudio : undefined),
    ].filter(Boolean);
    requireState(
      permitted.some((r) => canonical(r) === canonical(data.media)),
      "PLAYBACK_UNAVAILABLE",
      403,
    );
    const media = data.media;
    const metadata = await this.core.database.db
      .select({ duration: s.mediaAssets.durationMs })
      .from(s.gameQuestionMedia)
      .innerJoin(
        s.mediaAssets,
        eq(s.gameQuestionMedia.mediaAssetId, s.mediaAssets.id),
      )
      .where(
        and(
          eq(s.gameQuestionMedia.gameId, game.id),
          eq(s.gameQuestionMedia.boardPosition, Number(media.boardPosition)),
          eq(
            s.gameQuestionMedia.questionPosition,
            Number(media.questionPosition),
          ),
          eq(
            s.gameQuestionMedia.mediaRole,
            media.role,
          ),
          eq(s.gameQuestionMedia.variantNumber, 0),
        ),
      );
    const duration = metadata[0]?.duration;
    requireState(
      duration && Number(data.positionMs) <= duration,
      "INVALID_PLAYBACK",
      400,
    );
    await this.authority(c);
    requireState(this.current(c), "STREAM_REPLACED", 403);
    c.playbackSequence = sequence;
    const stream = this.rooms.get(c.roomId!)!;
    stream.playback = {
      playing: data.playing,
      positionMs: data.positionMs,
      durationMs: duration,
      updatedAt: new Date().toISOString(),
    };
    stream.playbackSource = canonical(snapshot.source);
    this.invalidate(c.roomId!);
  }
  private send(c: Connection, event: ServerFrame["event"], data: ServerPayload) {
    if (c.closed || c.socket.readyState !== WebSocket.OPEN) return;
    if (c.socket.bufferedAmount > 262144) {
      c.socket.terminate();
      this.cleanup(c);
      return;
    }
    const message = frame(
      {
        event,
        data: {
          protocolVersion: 1,
          streamId: c.streamId,
          sequence: String(++c.sequence),
          serverTime: new Date().toISOString(),
          ...data,
        },
      },
      false,
    );
    const serialized = JSON.stringify(message);
    requireState(
      Buffer.byteLength(serialized) <= 65536,
      "STATE_TOO_LARGE",
      500,
    );
    c.socket.send(serialized);
  }
  private revoke(c: Connection, e: unknown) {
    const code =
      e instanceof GameplayProblem ? e.code : "PROJECTION_UNAVAILABLE";
    this.stop(
      c,
      code === "CONTROLLER_FENCED"
        ? "control_revoked"
        : code === "ROOM_CLOSED"
          ? "room_closed"
          : code === "STREAM_REPLACED"
            ? "stream_replaced"
            : "membership_revoked",
      code,
    );
  }
  private stop(c: Connection, event: ServerFrame["event"], code: string) {
    try {
      this.send(c, event, { code });
    } finally {
      this.cleanup(c);
      c.socket.close(1008, code.slice(0, 80));
      const timer = setTimeout(() => c.socket.terminate(), 1000);
      timer.unref();
    }
  }
  private cleanup(c: Connection) {
    if (c.closed) return;
    c.closed = true;
    clearTimeout(c.authTimer);
    c.releaseUpgrade?.();
    c.queue.length = 0;
    this.connections.delete(c);
    const key = `${c.roomId}:${c.memberId}`;
    if (this.members.get(key) === c) {
      this.members.delete(key);
      const stream = this.rooms.get(c.roomId!);
      if (stream) {
        if (c.actor?.account) stream.playback = undefined;
        if (![...this.members.values()].some((v) => v.roomId === c.roomId))
          this.rooms.delete(c.roomId!);
        else this.invalidate(c.roomId!);
      }
    }
  }
  private tick() {
    const now = Date.now();
    for (const c of this.connections) {
      if (!this.current(c)) continue;
      const expires = c.actor?.account?.expiresAt;
      if (expires && expires <= now) {
        this.stop(c, "membership_revoked", "CREDENTIAL_EXPIRED");
        continue;
      }
      if (expires && expires - now <= 60000 && !c.warned) {
        c.warned = true;
        this.send(c, "credential_expiring", { code: "CREDENTIAL_EXPIRING" });
      }
      if (c.pingAt > c.pongAt && now - c.pingAt > 10000) {
        c.socket.terminate();
        this.cleanup(c);
        continue;
      }
      if (now - c.pingAt >= 25000) {
        c.pingAt = now;
        c.socket.ping();
      }
    }
  }
  onModuleDestroy() {
    this.stopped = true;
    this.pendingRooms.clear();
    if (this.timer) clearInterval(this.timer);
    for (const c of [...this.connections]) {
      this.cleanup(c);
      c.socket.terminate();
    }
  }
}
