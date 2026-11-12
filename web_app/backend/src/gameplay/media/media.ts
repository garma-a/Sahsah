import { DatabaseService } from "../../database/database.module.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { scoped } from "../platform/logging.js";
import type { Contract } from "../contract.js";
import { invariant } from "../platform/invariant.js";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import type { RequestHandler } from "express";
import * as s from "../../database/schema/index.js";
import { canonical } from "../platform/proof.js";
import { answerView, questionView, type Pin } from "../games/content.js";
import { GameOperations } from "../games/operations.js";
import { ProjectionService } from "../games/projection.js";
import { freshTime } from "../platform/clock.js";
import type { Actor } from "../platform/types.js";
import { requireState } from "../platform/problem.js";
import type { MediaObject, SignedMedia } from "../platform/ports.js";

export function r2Signer(
  env: NodeJS.ProcessEnv,
): ((object: MediaObject) => Promise<SignedMedia>) | undefined {
  if (!env.R2_ACCOUNT_ID && !env.R2_ACCESS_KEY_ID && !env.R2_SECRET_ACCESS_KEY)
    return;
  requireState(
    /^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID ?? "") &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_GAMEPLAY_BUCKET,
    "INVALID_R2_CONFIGURATION",
    500,
  );
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = env.R2_GAMEPLAY_BUCKET;
  return async ({ provider, namespace, key }) => {
    requireState(
      provider === "r2" && namespace === bucket,
      "MEDIA_UNAVAILABLE",
      503,
    );
    const signingDate = new Date();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: namespace, Key: key }),
      { expiresIn: 300, signingDate },
    );
    return {
      url,
      expiresAt: new Date(signingDate.getTime() + 300000).toISOString(),
    };
  };
}
/**
 * Development storage: files under one directory, `private/` behind short
 * signed links and `public/` open, served by this API. Never used in production.
 */
export function localMedia(env: NodeJS.ProcessEnv) {
  if (!env.GAMEPLAY_LOCAL_MEDIA_DIR) return;
  requireState(env.NODE_ENV !== "production", "LOCAL_MEDIA_IN_PRODUCTION", 500);
  const root = resolve(env.GAMEPLAY_LOCAL_MEDIA_DIR),
    base = (
      env.GAMEPLAY_LOCAL_MEDIA_URL ??
      `http://localhost:${env.PORT ?? 3001}/api/dev-media`
    ).replace(/\/+$/, ""),
    secret = randomBytes(32);
  const mac = (key: string, expires: number) =>
    createHmac("sha256", secret).update(`${expires}:${key}`).digest("hex");
  const sign = async ({ provider, key }: MediaObject): Promise<SignedMedia> => {
    requireState(provider === "local", "MEDIA_UNAVAILABLE", 503);
    const expires = Date.now() + 300000;
    return {
      url: `${base}/private/${key}?expires=${expires}&signature=${mac(key, expires)}`,
      expiresAt: new Date(expires).toISOString(),
    };
  };
  const serve: RequestHandler = (req, res) => {
    const [, scope, ...rest] = decodeURIComponent(req.path).split("/"),
      key = rest.join("/"),
      expires = Number(req.query.expires),
      signature = Buffer.from(String(req.query.signature ?? ""));
    const permitted =
      scope === "public" ||
      (scope === "private" &&
        expires > Date.now() &&
        signature.length === 64 &&
        timingSafeEqual(signature, Buffer.from(mac(key, expires))));
    if (!["GET", "HEAD"].includes(req.method) || !key || !permitted) {
      res.sendStatus(404);
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader(
      "Cache-Control",
      scope === "public" ? "public, max-age=300" : "private, no-store",
    );
    // sendFile confines the path to root and answers Range requests for audio.
    res.sendFile(`${scope}/${key}`, { root, dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) res.sendStatus(404);
    });
  };
  return { sign, serve, publicBaseUrl: `${base}/public` };
}
export function publicMediaBaseUrl(env: NodeJS.ProcessEnv) {
  if (!env.GAMEPLAY_PUBLIC_MEDIA_BASE_URL) return;
  const url = new URL(env.GAMEPLAY_PUBLIC_MEDIA_BASE_URL);
  requireState(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    "INVALID_PUBLIC_MEDIA_URL",
    500,
  );
  return url.href.replace(/\/+$/, "");
}
function refs(value: unknown): Contract<"MediaRef">[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(refs);
  const obj = Object.fromEntries(Object.entries(value));
  if (["image", "audio"].includes(String(obj.kind)))
    // Only typed question/answer presentations feed this recursive collector.
    return [obj as Contract<"MediaRef">];
  return Object.values(obj).flatMap(refs);
}

@Injectable()
export class MediaService {
  constructor(
    readonly runtime: GameplayRuntime,
    readonly database: DatabaseService,
    private games: GameOperations,
    private projections: ProjectionService,
  ) {}
  @scoped("media.access")
  async access(
    actor: Actor,
    gameId: string,
    body: Contract<"MediaRequest">,
  ): Promise<Contract<"MediaLinks">> {
    const requested = body.refs;
    requireState(
      new Set(requested.map(canonical)).size === requested.length,
      "DUPLICATE_MEDIA_REF",
      400,
    );
    const result = await this.database.transaction(
      async (db) => {
        const game = await this.games.game(db, gameId, false),
          now = await freshTime(db);
        requireState(!game.contentPurgedAt, "CONTENT_PURGED", 410);
        requireState(
          game.status === "active" &&
            now.getTime() < new Date(game.idleExpiresAt).getTime(),
          "MEDIA_PHASE_UNAVAILABLE",
          409,
        );
        await this.projections.authorize(db, game, actor, false);
        requireState(
          game.activeBoardPosition !== null,
          "MEDIA_PHASE_UNAVAILABLE",
        );
        const q = (
          await db
            .select()
            .from(s.gameQuestions)
            .where(
              this.games.slot({
                gameId,
                boardPosition: game.activeBoardPosition,
                questionPosition: game.activeQuestionPosition!,
              }),
            )
        )[0];
        invariant(q, "MEDIA_CURRENT_QUESTION");
        const media = await db
          .select({ pin: s.gameQuestionMedia, asset: s.mediaAssets })
          .from(s.gameQuestionMedia)
          .innerJoin(
            s.mediaAssets,
            eq(s.mediaAssets.id, s.gameQuestionMedia.mediaAssetId),
          )
          .where(
            and(
              eq(s.gameQuestionMedia.gameId, gameId),
              eq(s.gameQuestionMedia.boardPosition, q.boardPosition),
              eq(s.gameQuestionMedia.questionPosition, q.questionPosition),
            ),
          );
        const pins: Pin[] = media.map(({ pin, asset }) => ({
          ...pin,
          durationMs: asset.durationMs,
        }));
        const host = actor.account?.accountId === game.hostAccountId;
        const allowed = refs({
          question: questionView(q, pins, host, "ar"),
          ...(q.revealedAt ? { answer: answerView(q, pins, host, "ar") } : {}),
        }).map(canonical);
        const objects = requested.map((ref) => {
          requireState(
            allowed.includes(canonical(ref)),
            "MEDIA_FORBIDDEN",
            403,
          );
          const row = media.find(
            ({ pin }) =>
              pin.mediaRole === ref.role &&
              pin.variantNumber === ref.variantNumber,
          )!;
          requireState(
            row &&
              ["r2", "local"].includes(row.asset.storageProvider) &&
              row.asset.accessScope === "private" &&
              row.asset.state === "ready",
            "MEDIA_UNAVAILABLE",
            503,
          );
          return { ref, asset: row.asset };
        });
        return { objects, serverTime: now.toISOString() };
      },
      { consistentRead: true },
    );
    const signer = this.runtime.options.signMedia;
    requireState(signer, "MEDIA_UNAVAILABLE", 503);
    const links = await Promise.all(
      result.objects.map(async ({ ref, asset }) => ({
        ref,
        ...(await signer({
          provider: asset.storageProvider,
          namespace: asset.storageNamespace,
          key: asset.storageKey,
        })),
        contentType: asset.contentType!,
        byteSize: String(asset.byteSize),
        ...(asset.durationMs !== null ? { durationMs: asset.durationMs } : {}),
        ...(asset.widthPx !== null ? { width: asset.widthPx } : {}),
        ...(asset.heightPx !== null ? { height: asset.heightPx } : {}),
      })),
    );
    return { links, serverTime: result.serverTime };
  }
}
