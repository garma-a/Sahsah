// Loads the authored packs (content/packs.json) and their already-uploaded
// media (content/assets.json, written by content:upload) into a database.
// This is the only content step a deployed database needs: it writes rows,
// never media, and first checks that every referenced file is in storage.
//
// Database: MIGRATION_DATABASE_URL (migration owner).
// Checks:   R2 with R2_ACCOUNT_ID + R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (the
//           API's read key) and GAMEPLAY_PUBLIC_MEDIA_BASE_URL for covers; or
//           GAMEPLAY_LOCAL_MEDIA_DIR when the media was uploaded locally.
// Safe to rerun: identifiers derive from names; existing questions are kept and
// category presentation is refreshed.
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { uuid } from "./media.mjs";

const env = process.env;
const contentDir = new URL("../../content/", import.meta.url);
const staffId = "00000000-0000-4000-8000-000000000018";
const stagePoints = { 200: [200, 150, 50], 400: [400, 250, 150], 600: [600, 400, 200] };

async function verify(manifest) {
  const entries = Object.values(manifest.assets);
  if (manifest.provider === "local") {
    if (!env.GAMEPLAY_LOCAL_MEDIA_DIR) throw new Error("content/assets.json lists local media: set GAMEPLAY_LOCAL_MEDIA_DIR.");
    const root = path.resolve(env.GAMEPLAY_LOCAL_MEDIA_DIR);
    for (const a of entries) await access(path.join(root, a.scope, a.key));
    return;
  }
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "GAMEPLAY_PUBLIC_MEDIA_BASE_URL"])
    if (!env[name]) throw new Error(`Set ${name} so the seed can check the uploaded media.`);
  const { S3Client, HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  const publicBase = env.GAMEPLAY_PUBLIC_MEDIA_BASE_URL.replace(/\/+$/, "");
  const missing = [];
  const check = async (a) => {
    let size;
    if (a.scope === "public") {
      const r = await fetch(`${publicBase}/${a.key}`, { method: "HEAD" });
      size = r.ok ? Number(r.headers.get("content-length")) : undefined;
    } else
      size = await client
        .send(new HeadObjectCommand({ Bucket: manifest.buckets.private, Key: a.key }))
        .then((h) => h.ContentLength, () => undefined);
    return size === a.byteSize;
  };
  // A few at a time, retrying once: the public r2.dev address throttles bursts.
  for (let i = 0; i < entries.length; i += 8)
    await Promise.all(
      entries.slice(i, i + 8).map(async (a) => {
        const ok = await check(a).catch(() => false) || (await check(a).catch(() => false));
        if (!ok) missing.push(a.key);
      }),
    );
  if (missing.length) throw new Error(`${missing.length} media files are missing from storage (first: ${missing[0]}). Run content:upload first.`);
}

/** Pins, by role, for one authored question. */
function pinsFor(q, base, has) {
  const m = q.media ?? {}, cap = q.slot <= 2 ? 200 : q.slot <= 4 ? 400 : 600, pins = [];
  const pin = (role, name, variant = 0, points = null) => pins.push({ role, name, variant, points });
  if (m.prompt) pin("prompt_image", `${base}/prompt`);
  if (m.answer) pin("answer_image", `${base}/answer`);
  (m.clues ?? []).forEach((clue, i) => pin("hint_image", `${base}/clue${i}`, i, clue.points));
  if (m.blur || m.zoom) {
    pin("source_image", `${base}/original`);
    pin("answer_image", `${base}/original`);
    for (let i = 0; i < 3; i++) pin("hint_image", `${base}/stage${i}`, i, stagePoints[cap][i]);
  }
  if (m.audio) {
    pin("source_audio", `${base}/audio`);
    pin("question_audio", `${base}/audio`);
  }
  for (const p of pins) if (!has(p.name)) throw new Error(`content/assets.json has no ${p.name}; rerun content:upload.`);
  return pins;
}

async function main() {
  if (!env.MIGRATION_DATABASE_URL) throw new Error("Set MIGRATION_DATABASE_URL to the migration-owner connection.");
  const catalog = JSON.parse(await readFile(new URL("packs.json", contentDir), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("assets.json", contentDir), "utf8"));
  await verify(manifest);
  const client = new pg.Client({ connectionString: env.MIGRATION_DATABASE_URL, statement_timeout: 60000 });
  await client.connect();
  const inserted = new Set();
  const asset = async (name) => {
    const a = manifest.assets[name];
    if (inserted.has(a.id)) return a.id;
    const source = a.source ? await asset(a.source) : null;
    await client.query(
      `INSERT INTO media_assets(id,media_kind,state,access_scope,storage_provider,storage_namespace,storage_key,content_type,byte_size,width_px,height_px,duration_ms,sha256,source_asset_id,transform_spec,uploaded_by_staff_id,ready_at)
       VALUES($1,$2,'ready',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()) ON CONFLICT DO NOTHING`,
      [a.id, a.kind, a.scope, manifest.provider, manifest.buckets[a.scope], a.key, a.contentType, a.byteSize, a.width ?? null, a.height ?? null,
        a.durationMs ?? null, Buffer.from(a.sha256, "hex"), source, a.transform ?? {}, staffId],
    );
    inserted.add(a.id);
    return a.id;
  };
  let questions = 0;
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash,is_active) VALUES($1,'admin','content-import@sahsah.invalid','disabled',false) ON CONFLICT DO NOTHING", [staffId]);
    const sectionId = uuid(`section:${catalog.section.name}`);
    await client.query("INSERT INTO category_sections(id,name_ar,display_order) VALUES($1,$2,1) ON CONFLICT DO NOTHING", [sectionId, catalog.section.name]);
    for (const [order, category] of catalog.categories.entries()) {
      const categoryId = uuid(`category:${category.key}`);
      await client.query(
        // Presentation (name, description, cover) follows the authored file on rerun.
        "INSERT INTO categories(id,name_ar,display_order,section_id,description_ar,cover_media_asset_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name_ar=EXCLUDED.name_ar,description_ar=EXCLUDED.description_ar,cover_media_asset_id=EXCLUDED.cover_media_asset_id",
        [categoryId, category.name, order + 1, sectionId, category.description, await asset(`${category.key}/cover`)],
      );
      for (const pack of category.packs) {
        const packId = uuid(`pack:${category.key}:${pack.number}`);
        await client.query("INSERT INTO question_packs(id,category_id,pack_number,publication_state) VALUES($1,$2,$3,'published') ON CONFLICT DO NOTHING", [packId, categoryId, pack.number]);
        for (const q of pack.questions) {
          const base = `${category.key}/p${pack.number}/q${q.slot}`, questionId = uuid(`question:${base}`);
          await client.query(
            "INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar,format_config) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
            [questionId, packId, q.slot, q.format, q.prompt, q.answer, q.config ?? {}],
          );
          for (const p of pinsFor(q, base, (name) => name in manifest.assets))
            await client.query(
              "INSERT INTO question_media(question_id,media_role,media_asset_id,variant_number,suggested_points) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
              [questionId, p.role, await asset(p.name), p.variant, p.points],
            );
          questions++;
        }
      }
    }
    await client.query("COMMIT");
    console.log(`Content ready: ${catalog.categories.length} categories, ${questions} questions, ${inserted.size} media files (${manifest.provider}).`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Connection strings and keys never reach the output.
  console.error(error instanceof Error ? error.message : "Seeding failed.");
  process.exitCode = 1;
});
