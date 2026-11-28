import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { RequestHandler } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { localMedia, publicMediaBaseUrl, r2Signer } from "../../gameplay/media/media.js";
import type { MediaObject, SignedMedia } from "../../gameplay/platform/ports.js";

export type Scope = "private" | "public";

/** Where finished files go: private R2 for question media, the public bucket for category covers. */
export type AdminMedia = {
  provider: "r2" | "local";
  namespace: (scope: Scope) => string;
  put: (scope: Scope, key: string, body: Buffer, contentType: string) => Promise<void>;
  /** Short-lived link for the staff preview; never stored. */
  sign: (object: MediaObject) => Promise<SignedMedia>;
  publicUrl: (key: string) => string;
  /** Development only: serves the local directory (private files behind a signature). */
  serve?: RequestHandler;
};

type Environment = NodeJS.ProcessEnv;

/**
 * Undefined when no storage is configured: the dashboard then still edits text, and
 * uploads answer that media storage is not set up.
 */
export function createAdminMedia(env: Environment): AdminMedia | undefined {
  const local = localMedia({ ...env, GAMEPLAY_LOCAL_MEDIA_URL: env.GAMEPLAY_LOCAL_MEDIA_URL ?? `http://localhost:${env.ADMIN_PORT ?? env.PORT ?? 3002}/dev-media` });
  if (local) {
    const root = resolve(env.GAMEPLAY_LOCAL_MEDIA_DIR!);
    return {
      provider: "local",
      namespace: () => "local",
      async put(scope, key, body) {
        const file = resolve(root, scope, key);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body, { flag: "wx" });
      },
      sign: local.sign,
      publicUrl: (key) => `${local.publicBaseUrl}/${key}`,
      serve: local.serve,
    };
  }
  const sign = r2Signer(env);
  if (!sign) return undefined;
  for (const name of ["R2_PUBLIC_BUCKET", "GAMEPLAY_PUBLIC_MEDIA_BASE_URL"])
    if (!env[name]) throw new Error(`${name} is required when R2 is configured for the admin service.`);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  const buckets = { private: env.R2_GAMEPLAY_BUCKET!, public: env.R2_PUBLIC_BUCKET! };
  const base = publicMediaBaseUrl(env)!;
  return {
    provider: "r2",
    namespace: (scope) => buckets[scope],
    async put(scope, key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: buckets[scope],
          Key: key,
          Body: body,
          ContentType: contentType,
          // Keys are new for every upload; refuse to replace bytes that may be pinned by a game.
          IfNoneMatch: "*",
          CacheControl: scope === "public" ? "public, max-age=31536000, immutable" : "private, max-age=31536000, immutable",
        }),
      );
    },
    sign,
    publicUrl: (key) => `${base}/${key}`,
  };
}

/**
 * Writes one new object; a previous attempt of the same upload having written it already counts as done.
 * Any other failure throws, for the caller to turn into its own refusal.
 */
export async function putOnce(media: AdminMedia, scope: Scope, key: string, body: Buffer, contentType: string) {
  try {
    await media.put(scope, key, body, contentType);
  } catch (error) {
    const e = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.code === "EEXIST" || e.name === "PreconditionFailed" || e.$metadata?.httpStatusCode === 412) return;
    throw error;
  }
}
