import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import type { Request } from "express";
import { DatabaseService } from "../database/database.module.js";
import * as s from "../database/schema/index.js";
import type { JsonObject } from "../database/schema/types.js";
import { Admission } from "./admission.js";
import { digest, equalProof, proof } from "./proof.js";
import { id, revision } from "./contract.js";
import {
  GameplayProblem,
  requireState,
  databaseCode,
  databaseConstraint,
} from "./problem.js";
import { setTimeout as retryDelay } from "node:timers/promises";
import type { Data, GameplayOptions, VerifiedAccount } from "./ports.js";
import { GameplayScheduler } from "./scheduler.js";
import { GameplayMetrics } from "./metrics.js";
import { existingIdentity, resourcePressure } from "./integrations.js";

export type Tx = DatabaseService["db"];
export type Room = typeof s.rooms.$inferSelect;
export type Member = typeof s.roomMemberships.$inferSelect;
export type Game = typeof s.games.$inferSelect;
export type Question = typeof s.gameQuestions.$inferSelect;
export interface Actor {
  account?: VerifiedAccount;
  member?: Member;
  secret?: string;
  controlSecret?: string;
  generation?: bigint;
}

export async function freshTime(db: Tx): Promise<Date> {
  const result = await db.execute(sql`SELECT clock_timestamp() AS now`);
  return new Date((result.rows[0] as { now: Date }).now);
}
export const iso = (value: string | Date) => new Date(value).toISOString();
export const plusDay = (now: Date) =>
  new Date(now.getTime() + 86400000).toISOString();

@Injectable()
export class GameplayService implements OnModuleInit, OnModuleDestroy {
  options: GameplayOptions = {};
  readonly admission = new Admission();
  readonly scheduler = new GameplayScheduler();
  readonly metrics = new GameplayMetrics();
  private pressureTimer?: ReturnType<typeof setInterval>;
  constructor(
    readonly database: DatabaseService,
    private config: ConfigService,
  ) {}
  configure(options: GameplayOptions = {}) {
    this.options = {
      ...options,
      enabled:
        options.enabled ?? this.config.get("GAMEPLAY_ENABLED") === "true",
    };
    if (!this.options.enabled) return;
    this.options.verifyAccount ??= existingIdentity(process.env);
    requireState(
      Number(process.env.DATABASE_POOL_MAX ?? 5) >= 3,
      "GAMEPLAY_POOL_TOO_SMALL",
      500,
    );
    this.options.pressure ??= resourcePressure(process.env, this.metrics);
    const ceiling =
      options.capacity ??
      (process.env.NODE_ENV === "production"
        ? {
            rooms: Number(process.env.GAMEPLAY_CAPACITY_ROOMS),
            members: Number(process.env.GAMEPLAY_CAPACITY_MEMBERS),
            games: Number(process.env.GAMEPLAY_CAPACITY_GAMES),
          }
        : { rooms: 200, members: 1200, games: 200 });
    this.admission.configure(ceiling);
    if (process.env.NODE_ENV === "production") {
      requireState(
        this.options.verifyAccount &&
          this.options.pressure &&
          this.options.signMedia,
        "GAMEPLAY_CONFIGURATION_MISSING",
        500,
      );
      const base = new URL(
        process.env.GAMEPLAY_JOIN_BASE_URL ?? "http://invalid",
      );
      requireState(
        base.protocol === "https:" &&
          !base.username &&
          !base.password &&
          !base.search &&
          !base.hash,
        "INVALID_JOIN_BASE_URL",
        500,
      );
    }
  }
  async reconcileOccupancy() {
    const revision = this.admission.revision;
    const result = await this.database.db
      .execute(sql`SELECT (SELECT count(*)::int FROM rooms WHERE closed_at IS NULL) AS rooms,
      (SELECT count(*)::int FROM room_memberships m JOIN rooms r ON r.id=m.room_id WHERE r.closed_at IS NULL AND m.left_at IS NULL AND m.removed_at IS NULL) AS members,
      (SELECT count(*)::int FROM games WHERE status='active') AS games`);
    this.admission.reconcile(
      result.rows[0] as { rooms: number; members: number; games: number },
      revision,
    );
  }
  async onModuleInit() {
    if (!this.options.enabled) return;
    requireState(
      await this.database.ready(),
      "GAMEPLAY_DATABASE_UNAVAILABLE",
      503,
    );
    requireState(
      await this.database.claimGameplayProcess(),
      "GAMEPLAY_PROCESS_ALREADY_ACTIVE",
      503,
    );
    await this.reconcileOccupancy();
    if (this.options.pressure) {
      try {
        this.admission.initialize(await this.options.pressure());
      } catch {
        /* admission remains paused */
      }
      this.pressureTimer = setInterval(() => {
        void this.options.pressure!()
          .then((sample) => this.admission.update(sample))
          .catch(() => {});
      }, 1000);
      this.pressureTimer.unref();
    }
  }
  onModuleDestroy() {
    if (this.pressureTimer) clearInterval(this.pressureTimer);
    this.metrics.close();
  }
  enabled() {
    requireState(this.options.enabled, "GAMEPLAY_DISABLED", 503);
  }
  operation(req: Request) {
    return id(req.headers["idempotency-key"]);
  }
  async transaction<T>(work: (db: Tx) => Promise<T>): Promise<T> {
    // All callers are database-only, identified gameplay mutations. Retry the
    // entire rolled-back transaction; recheck the original intent/version.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.transaction(work);
      } catch (error) {
        const code = databaseCode(error),
          constraint = databaseConstraint(error);
        const retry =
          code === "40001" ||
          code === "40P01" ||
          (code === "23505" &&
            ["rooms_invitation_code_unique", "rooms_one_open_owner"].includes(
              constraint ?? "",
            ));
        if (!retry || attempt >= 2) throw error;
        await retryDelay(10 * (attempt + 1));
      }
    }
  }
  async identity(authorization?: string): Promise<Actor> {
    this.enabled();
    requireState(
      typeof authorization === "string" && authorization.startsWith("Bearer "),
      "UNAUTHENTICATED",
      401,
    );
    const token = authorization.slice(7);
    if (token.startsWith("g.")) {
      const parts = token.split(".");
      requireState(parts.length === 3, "INVALID_PROOF", 401);
      const member = (
        await this.database.db
          .select()
          .from(s.roomMemberships)
          .where(eq(s.roomMemberships.id, id(parts[1])))
      )[0];
      requireState(
        member &&
          equalProof(
            member.reconnectCredentialHash,
            proof("guest", member.id, parts[2]),
          ),
        "INVALID_PROOF",
        401,
      );
      return { member, secret: parts[2] };
    }
    const account = await this.options.verifyAccount?.(token);
    requireState(
      account && account.expiresAt > Date.now(),
      "UNAUTHENTICATED",
      401,
    );
    const row = (
      await this.database.db
        .select()
        .from(s.accounts)
        .where(eq(s.accounts.id, account.accountId))
    )[0];
    requireState(row?.state === "active", "UNAUTHENTICATED", 401);
    return { account: { ...account, accountId: row.id } };
  }
  async actor(req: Request): Promise<Actor> {
    const actor = await this.identity(req.headers.authorization);
    actor.controlSecret =
      typeof req.headers["x-control-secret"] === "string"
        ? req.headers["x-control-secret"]
        : undefined;
    actor.generation =
      req.headers["x-controller-generation"] === undefined
        ? undefined
        : revision(req.headers["x-controller-generation"]);
    return actor;
  }
  host(room: Room, actor: Actor, control = true) {
    requireState(
      actor.account?.accountId === room.ownerAccountId,
      "FORBIDDEN",
      403,
    );
    requireState(actor.account!.expiresAt > Date.now(), "UNAUTHENTICATED", 401);
    if (control)
      requireState(
        actor.generation === room.controllerGeneration &&
          equalProof(
            room.controllerCredentialHash,
            proof("room-control", room.id, actor.controlSecret),
          ),
        "CONTROLLER_FENCED",
        403,
      );
  }
  async room(db: Tx, roomId: string, lock = true): Promise<Room> {
    const query = db.select().from(s.rooms).where(eq(s.rooms.id, roomId));
    const room = (await (lock ? query.for("update") : query))[0];
    requireState(room, "NOT_FOUND", 404);
    return room;
  }
  async members(db: Tx, roomId: string) {
    return db
      .select()
      .from(s.roomMemberships)
      .where(
        and(
          eq(s.roomMemberships.roomId, roomId),
          isNull(s.roomMemberships.leftAt),
          isNull(s.roomMemberships.removedAt),
        ),
      )
      .orderBy(s.roomMemberships.joinedAt, s.roomMemberships.id);
  }
  async activeAccount(db: Tx, actor: Actor) {
    if (!actor.account) return;
    const row = (
      await db
        .select()
        .from(s.accounts)
        .where(eq(s.accounts.id, actor.account.accountId))
        .for("update")
    )[0];
    requireState(
      row?.state === "active" && actor.account.expiresAt > Date.now(),
      "UNAUTHENTICATED",
      401,
    );
    return row;
  }
  async membership(
    db: Tx,
    room: Room,
    actor: Actor,
    live = true,
  ): Promise<Member> {
    if (actor.account)
      requireState(
        actor.account.expiresAt > Date.now(),
        "UNAUTHENTICATED",
        401,
      );
    const predicate = actor.member
      ? eq(s.roomMemberships.id, actor.member.id)
      : eq(s.roomMemberships.accountId, actor.account!.accountId);
    const member = (
      await db
        .select()
        .from(s.roomMemberships)
        .where(and(eq(s.roomMemberships.roomId, room.id), predicate))
        .orderBy(
          sql`(${s.roomMemberships.leftAt} IS NULL AND ${s.roomMemberships.removedAt} IS NULL) DESC`,
          sql`${s.roomMemberships.joinedAt} DESC`,
        )
    )[0];
    requireState(member, "NOT_FOUND", 404);
    if (live)
      requireState(
        !room.closedAt &&
          !member.leftAt &&
          !member.removedAt &&
          (!actor.member || (!member.accountId && !member.reconnectRevokedAt)),
        "MEMBERSHIP_REVOKED",
        403,
      );
    return member;
  }
  async receipt(
    db: Tx,
    operationId: string,
    hash: Buffer,
  ): Promise<Data | undefined> {
    const row = (
      await db
        .select()
        .from(s.roomActions)
        .where(eq(s.roomActions.operationId, operationId))
    )[0];
    if (!row) return;
    requireState(equalProof(row.requestDigest, hash), "OPERATION_CONFLICT");
    return row.resultData;
  }
  async saveReceipt(
    db: Tx,
    room: Room,
    actor: Actor,
    operationId: string,
    operationName: string,
    hash: Buffer,
    now: Date,
    outcome: Data,
  ): Promise<Data> {
    const result = {
      operationId,
      roomId: room.id,
      acceptedAt: now.toISOString(),
      effect: "changed",
      ...outcome,
    };
    await db.insert(s.roomActions).values({
      operationId,
      roomId: room.id,
      actorAccountId: actor.account?.accountId,
      actorMembershipId: actor.member?.id,
      actorProofHash: actor.member?.reconnectCredentialHash,
      operationName,
      requestDigest: hash,
      acceptedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
      resultData: result as JsonObject,
    });
    return result;
  }
  async hint(
    db: Tx,
    roomId: string,
    version: bigint,
    gameId?: string,
    gameProjection?: bigint,
  ) {
    const resource = gameId ?? roomId;
    await db
      .insert(s.outboxEvents)
      .values({
        id: randomUUID(),
        deduplicationKey: `${gameId ? "game" : "room"}:${resource}:${gameProjection ?? version}`,
        topic: gameId ? "game.changed" : "room.changed",
        resourceKind: gameId ? "game" : "room",
        resourceId: resource,
        payload: { roomId, ...(gameId ? { gameId } : {}) },
        availableAt: sql`clock_timestamp()`,
        createdAt: sql`clock_timestamp()`,
      })
      .onConflictDoNothing();
  }
  async create(actor: Actor, operationId: string, body: Data): Promise<Data> {
    requireState(actor.account, "UNAUTHENTICATED", 401);
    const hash = digest("createRoom", actor.account.accountId, body);
    const original = (
      await this.database.db
        .select()
        .from(s.rooms)
        .where(eq(s.rooms.createRequestId, operationId))
    )[0];
    if (original) {
      this.host(original, actor, false);
      requireState(
        equalProof(original.createRequestDigest, hash),
        "OPERATION_CONFLICT",
      );
      const receipt = await this.receipt(this.database.db, operationId, hash);
      if (receipt) return receipt;
      const member = (
        await this.database.db
          .select()
          .from(s.roomMemberships)
          .where(
            and(
              eq(s.roomMemberships.roomId, original.id),
              eq(s.roomMemberships.accountId, original.ownerAccountId),
            ),
          )
      )[0];
      return {
        operationId,
        roomId: original.id,
        roomVersion: "0",
        membershipId: member?.id,
        membershipVersion: "0",
        controllerGeneration: "1",
        readyGeneration: 1,
        acceptedAt: iso(original.createdAt),
        effect: "changed",
      };
    }
    return this.admission.allocate(
      `create:${actor.account.accountId}:${operationId}`,
      hash,
      () =>
        this.transaction(async (db) => {
          const existing = (
            await db
              .select()
              .from(s.rooms)
              .where(
                and(
                  eq(s.rooms.ownerAccountId, actor.account!.accountId),
                  isNull(s.rooms.closedAt),
                ),
              )
          )[0];
          requireState(
            !existing,
            "ROOM_ALREADY_OPEN",
            409,
            existing ? { existingRoomId: existing.id } : {},
          );
          const account = await this.activeAccount(db, actor);
          const now = await freshTime(db),
            roomId = randomUUID(),
            memberId = randomUUID();
          const [room] = await db
            .insert(s.rooms)
            .values({
              id: roomId,
              ownerAccountId: actor.account!.accountId,
              teamOneName: String(body.teamOneName).trim(),
              teamTwoName: String(body.teamTwoName).trim(),
              createRequestId: operationId,
              createRequestDigest: hash,
              controllerCredentialHash: proof(
                "room-control",
                roomId,
                body.proposedControlSecret,
              ),
              controllerAcquiredAt: now.toISOString(),
              createdAt: now.toISOString(),
              lastLobbyActivityAt: now.toISOString(),
              lobbyIdleExpiresAt: plusDay(now),
              invitationCode: String(randomInt(1000000)).padStart(6, "0"),
              invitationIssuedAt: now.toISOString(),
              invitationExpiresAt: plusDay(now),
            })
            .returning();
          await db.insert(s.roomMemberships).values({
            id: memberId,
            roomId,
            accountId: actor.account!.accountId,
            displayName: account!.displayName!,
            lobbyTeamNumber: body.hostTeamNumber as number | null,
            joinedAt: now.toISOString(),
          });
          const selections = body.selections as Data[];
          if (selections.length)
            await db.insert(s.roomPackSelections).values(
              selections.map((item) => ({
                roomId,
                boardPosition: Number(item.boardPosition),
                categoryId: String(item.categoryId),
                packId: String(item.packId),
                observedRevision: BigInt(String(item.observedRevision)),
              })),
            );
          await this.hint(db, room.id, room.stateVersion);
          return this.saveReceipt(
            db,
            room,
            actor,
            operationId,
            "createRoom",
            hash,
            now,
            {
              roomVersion: "0",
              membershipId: memberId,
              membershipVersion: "0",
              controllerGeneration: "1",
              readyGeneration: 1,
            },
          );
        }),
    );
  }
}
