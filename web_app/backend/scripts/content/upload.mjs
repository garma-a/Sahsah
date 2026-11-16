// Prepares the client's pack media and uploads it once, from a developer
// machine. Writes content/assets.json, which content:seed reads; the media
// itself never enters the repository or the database host.
//
// Source:  CONTENT_SOURCE_DIR, the client's pack folder (question_bank.csv and
//          Pack*/Q*/ files), plus generated/ for replacement pictures.
// Storage: GAMEPLAY_LOCAL_MEDIA_DIR for local files; otherwise R2 with
//          R2_ACCOUNT_ID, R2_GAMEPLAY_BUCKET (private), R2_PUBLIC_BUCKET and the
//          write-capable R2_IMPORT_ACCESS_KEY_ID / R2_IMPORT_SECRET_ACCESS_KEY.
// Safe to rerun: object keys are content hashes and existing objects are kept.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { blurStages, coverImage, image, mp3FromQuickTime, sha256, uuid, zoomStages } from "./media.mjs";

const env = process.env;
const contentDir = new URL("../../content/", import.meta.url);

async function storage() {
  if (env.GAMEPLAY_LOCAL_MEDIA_DIR) {
    const root = path.resolve(env.GAMEPLAY_LOCAL_MEDIA_DIR);
    return {
      provider: "local",
      buckets: { private: "local", public: "local" },
      async put(scope, key, body) {
        const file = path.join(root, scope, key);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
        return true;
      },
    };
  }
  for (const name of ["R2_ACCOUNT_ID", "R2_GAMEPLAY_BUCKET", "R2_PUBLIC_BUCKET", "R2_IMPORT_ACCESS_KEY_ID", "R2_IMPORT_SECRET_ACCESS_KEY"])
    if (!env[name]) throw new Error(`Set GAMEPLAY_LOCAL_MEDIA_DIR, or ${name} for R2.`);
  const { S3Client, PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_IMPORT_ACCESS_KEY_ID, secretAccessKey: env.R2_IMPORT_SECRET_ACCESS_KEY },
  });
  const buckets = { private: env.R2_GAMEPLAY_BUCKET, public: env.R2_PUBLIC_BUCKET };
  return {
    provider: "r2",
    buckets,
    async put(scope, key, body, contentType) {
      const Bucket = buckets[scope];
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        if (head.ContentLength === body.length) return false;
      } catch (error) {
        if (error?.$metadata?.httpStatusCode !== 404) throw error;
      }
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType, CacheControl: scope === "public" ? "public, max-age=31536000, immutable" : "private, max-age=31536000, immutable" }));
      return true;
    },
  };
}

async function main() {
  if (!env.CONTENT_SOURCE_DIR) throw new Error("Set CONTENT_SOURCE_DIR to the client's pack folder.");
  const source = path.resolve(env.CONTENT_SOURCE_DIR);
  const catalog = JSON.parse(await readFile(new URL("packs.json", contentDir), "utf8"));
  const store = await storage();
  const assets = {};
  let uploaded = 0;
  const add = async (name, scope, media, extra = {}) => {
    const hash = sha256(media.body);
    const ext = { "image/webp": "webp", "audio/mpeg": "mp3" }[media.contentType];
    const key = `${scope === "public" ? "covers" : "content"}/${hash}.${ext}`;
    if (await store.put(scope, key, media.body, media.contentType)) uploaded++;
    assets[name] = {
      id: uuid(`asset:${scope}:${hash}`),
      scope,
      kind: media.contentType.startsWith("audio/") ? "audio" : "image",
      key,
      contentType: media.contentType,
      byteSize: media.body.length,
      sha256: hash,
      ...(media.width ? { width: media.width, height: media.height } : {}),
      ...(media.durationMs ? { durationMs: media.durationMs } : {}),
      ...extra,
    };
    return name;
  };
  const read = (file) => readFile(path.join(source, file));
  for (const category of catalog.categories) {
    await add(`${category.key}/cover`, "public", await coverImage(await read(category.cover)));
    for (const pack of category.packs)
      for (const q of pack.questions) {
        const base = `${category.key}/p${pack.number}/q${q.slot}`, m = q.media ?? {};
        if (m.prompt) await add(`${base}/prompt`, "private", await image(await read(m.prompt)));
        if (m.answer) await add(`${base}/answer`, "private", await image(await read(m.answer)));
        for (const [i, clue] of (m.clues ?? []).entries()) await add(`${base}/clue${i}`, "private", await image(await read(clue.file)));
        if (m.blur || m.zoom) {
          const original = await image(await read(m.blur ?? m.zoom));
          await add(`${base}/original`, "private", original);
          const operation = m.blur ? "blur" : "crop";
          const stages = m.blur ? await blurStages(original.body) : await zoomStages(original.body, m.focus);
          for (const [i, stage] of stages.entries())
            await add(`${base}/stage${i}`, "private", stage, { source: `${base}/original`, transform: { operation, stageIndex: i } });
        }
        if (m.audio) await add(`${base}/audio`, "private", mp3FromQuickTime(await read(m.audio)));
      }
  }
  const manifest = { provider: store.provider, buckets: store.buckets, assets };
  await writeFile(new URL("assets.json", contentDir), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Content media ready: ${Object.keys(assets).length} files (${uploaded} uploaded) in ${store.provider} storage. Wrote content/assets.json.`);
}

main().catch((error) => {
  // Keys never reach the output.
  console.error(error instanceof Error ? error.message : "Upload failed.");
  process.exitCode = 1;
});
