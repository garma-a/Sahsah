import { GameplayRuntime } from "./runtime.js";
import { scoped, enrichContext } from "./logging.js";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { DatabaseService } from "../../database/database.module.js";
import * as s from "../../database/schema/index.js";
import { equalProof, proof } from "./proof.js";
import { id, revision } from "../contract.js";
import { GameplayProblem, requireState } from "./problem.js";
import type { VerifiedAccount } from "./ports.js";
import type { Actor, Tx, Room } from "./types.js";

@Injectable()
export class GameplayIdentity {
  constructor(
    readonly runtime: GameplayRuntime,
    readonly database: DatabaseService,
  ) {}

  private credentials = new Map<
    string,
    { until: number; subject: string; account?: VerifiedAccount }
  >();
  private actors = new WeakMap<Request, Actor>();
  fingerprint(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  knownCredential(authorization?: string) {
    if (!authorization) return undefined;
    const key = this.fingerprint(authorization),
      entry = this.credentials.get(key);
    if (entry && entry.until > Date.now()) return entry;
    this.credentials.delete(key);
    return undefined;
  }
  forgetCredential(actor: Actor) {
    if (actor.proofFingerprint) this.credentials.delete(actor.proofFingerprint);
  }
  private rememberCredential(
    key: string,
    subject: string,
    account?: VerifiedAccount,
  ) {
    if (this.credentials.size >= 4096)
      this.credentials.delete(this.credentials.keys().next().value!);
    this.credentials.set(key, {
      subject,
      account,
      until: Math.min(Date.now() + 30000, account?.expiresAt ?? Infinity),
    });
  }
  @scoped("platform.identity.identity")
  async identity(authorization?: string): Promise<Actor> {
    this.runtime.enabled();
    requireState(
      typeof authorization === "string" && authorization.startsWith("Bearer "),
      "UNAUTHENTICATED",
      401,
    );
    const token = authorization.slice(7);
    const fingerprint = this.fingerprint(authorization);
    if (token.startsWith("g.")) {
      const parts = token.split(".");
      requireState(parts.length === 3, "INVALID_PROOF", 401);
      const member = (
        await this.database.db
          .select()
          .from(s.roomMemberships)
          .where(eq(s.roomMemberships.id, id(parts[1])))
      )[0];
      const valid =
        member &&
        equalProof(
          member.reconnectCredentialHash,
          proof("guest", member.id, parts[2]),
        );
      if (!valid) this.credentials.delete(fingerprint);
      requireState(valid, "INVALID_PROOF", 401);
      this.rememberCredential(fingerprint, `guest:${member.id}`);
      return { member, secret: parts[2], proofFingerprint: fingerprint };
    }
    const cached = this.knownCredential(authorization);
    const account =
      cached?.account ?? (await this.runtime.options.verifyAccount?.(token));
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
    if (row?.state !== "active") {
      this.credentials.delete(fingerprint);
      throw new GameplayProblem(401, "UNAUTHENTICATED");
    }
    const verified = { ...account, accountId: row.id };
    enrichContext({ accountId: row.id });
    if (!cached?.account)
      this.rememberCredential(fingerprint, `account:${row.id}`, verified);
    return { account: verified, proofFingerprint: fingerprint };
  }
  @scoped("platform.identity.actor")
  async actor(req: Request): Promise<Actor> {
    const known = this.actors.get(req);
    if (known) return known;
    const actor = await this.identity(req.headers.authorization);
    actor.controlSecret =
      typeof req.headers["x-control-secret"] === "string"
        ? req.headers["x-control-secret"]
        : undefined;
    actor.generation =
      req.headers["x-controller-generation"] === undefined
        ? undefined
        : revision(req.headers["x-controller-generation"]);
    this.actors.set(req, actor);
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
}
