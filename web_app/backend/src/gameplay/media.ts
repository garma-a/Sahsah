import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as s from "../database/schema/index.js";
import { canonical } from "./proof.js";
import { answerView, questionView, type Pin } from "./content.js";
import { GameOperations } from "./games.js";
import { ProjectionService } from "./projection.js";
import { GameplayService, freshTime, type Actor } from "./service.js";
import { requireState } from "./problem.js";
import type { Data, MediaObject, SignedMedia } from "./ports.js";

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
  return async ({ namespace, key }) => {
    requireState(namespace === bucket, "MEDIA_UNAVAILABLE", 503);
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
function refs(value: unknown): Data[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(refs);
  const obj = value as Data;
  if (["image", "audio"].includes(String(obj.kind))) return [obj];
  return Object.values(obj).flatMap(refs);
}

@Injectable()
export class MediaService {
  constructor(
    private core: GameplayService,
    private games: GameOperations,
    private projections: ProjectionService,
  ) {}
  async access(actor: Actor, gameId: string, body: Data): Promise<Data> {
    const requested = body.refs as Data[];
    requireState(
      new Set(requested.map(canonical)).size === requested.length,
      "DUPLICATE_MEDIA_REF",
      400,
    );
    const result = await this.core.database.transaction(
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
              row.asset.storageProvider === "r2" &&
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
    const signer = this.core.options.signMedia;
    requireState(signer, "MEDIA_UNAVAILABLE", 503);
    const links = await Promise.all(
      result.objects.map(async ({ ref, asset }) => ({
        ref,
        ...(await signer({
          namespace: asset.storageNamespace,
          key: asset.storageKey,
        })),
        contentType: asset.contentType,
        byteSize: String(asset.byteSize),
        ...(asset.durationMs !== null ? { durationMs: asset.durationMs } : {}),
        ...(asset.widthPx !== null ? { width: asset.widthPx } : {}),
        ...(asset.heightPx !== null ? { height: asset.heightPx } : {}),
      })),
    );
    return { links, serverTime: result.serverTime };
  }
}
