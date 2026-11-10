// Registers placeholder sections, categories, packs, questions and media so the
// game is playable before real content exists. Safe to rerun: identifiers and
// storage keys are derived from names, and existing rows are left untouched.
//
// Database: MIGRATION_DATABASE_URL (migration owner).
// Storage:  GAMEPLAY_LOCAL_MEDIA_DIR for local files; otherwise R2 with
//           R2_ACCOUNT_ID, R2_GAMEPLAY_BUCKET (private), R2_PUBLIC_BUCKET and
//           the write-capable R2_IMPORT_ACCESS_KEY_ID / R2_IMPORT_SECRET_ACCESS_KEY.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const env = process.env;
const uuid = (name) => {
  const h = createHash("sha256").update(`sahsah-placeholder:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const arabic = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

async function storage() {
  if (env.GAMEPLAY_LOCAL_MEDIA_DIR) {
    const root = path.resolve(env.GAMEPLAY_LOCAL_MEDIA_DIR);
    return {
      provider: "local",
      namespace: () => "local",
      async put(scope, key, body) {
        const file = path.join(root, scope, key);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
      },
    };
  }
  for (const name of ["R2_ACCOUNT_ID", "R2_GAMEPLAY_BUCKET", "R2_PUBLIC_BUCKET", "R2_IMPORT_ACCESS_KEY_ID", "R2_IMPORT_SECRET_ACCESS_KEY"])
    if (!env[name]) throw new Error(`Set GAMEPLAY_LOCAL_MEDIA_DIR, or ${name} for R2.`);
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_IMPORT_ACCESS_KEY_ID, secretAccessKey: env.R2_IMPORT_SECRET_ACCESS_KEY },
  });
  const bucket = (scope) => (scope === "public" ? env.R2_PUBLIC_BUCKET : env.R2_GAMEPLAY_BUCKET);
  return {
    provider: "r2",
    namespace: bucket,
    put: (scope, key, body, contentType) =>
      client.send(new PutObjectCommand({
        Bucket: bucket(scope), Key: key, Body: body, ContentType: contentType,
        ...(scope === "public" ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
      })),
  };
}

// Placeholder artwork: a numbered badge on a category-coloured card. The number
// is the answer, so image questions can really be played.
const W = 1200, H = 800;
function card({ hue, label, number, effect }) {
  const filter = {
    blur0: '<filter id="f"><feGaussianBlur stdDeviation="42"/></filter>',
    blur1: '<filter id="f"><feGaussianBlur stdDeviation="22"/></filter>',
    blur2: '<filter id="f"><feGaussianBlur stdDeviation="9"/></filter>',
    grayscale: '<filter id="f"><feColorMatrix type="saturate" values="0"/></filter>',
  }[effect];
  // Crops keep the full canvas size and magnify a region around the badge.
  const view = { crop0: "520 330 160 107", crop1: "430 270 340 227", crop2: "300 180 600 400", crop: "350 150 500 333" }[effect] ?? `0 0 ${W} ${H}`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${view}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 75% 35%)"/></linearGradient>${filter ?? ""}</defs>
<g${filter ? ' filter="url(#f)"' : ""}><rect width="${W}" height="${H}" fill="url(#g)"/>
<circle cx="600" cy="380" r="210" fill="#fff8e7" stroke="#1d1d1b" stroke-width="14"/>
<text x="600" y="455" font-family="sans-serif" font-size="220" font-weight="800" text-anchor="middle" fill="#1d1d1b">${number}</text>
<text x="600" y="720" font-family="sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#fff8e7" direction="rtl">${label}</text></g></svg>`);
}
function cover({ hue, label }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 75% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 80% 28%)"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<circle cx="400" cy="400" r="230" fill="none" stroke="#fff8e7" stroke-width="18" stroke-dasharray="40 26"/>
<circle cx="400" cy="400" r="120" fill="#fff8e7"/>
<text x="400" y="820" font-family="sans-serif" font-size="96" font-weight="800" text-anchor="middle" fill="#fff8e7" direction="rtl">${label}</text></svg>`);
}
// A short run of beeps; the number of beeps is the answer.
const RATE = 16000;
function beeps(count, hue) {
  const note = 0.22, gap = 0.16, total = Math.round((0.3 + count * (note + gap)) * RATE);
  const samples = new Int16Array(total), frequency = 330 + (hue % 240);
  for (let n = 0; n < count; n++) {
    const start = Math.round((0.15 + n * (note + gap)) * RATE), length = Math.round(note * RATE);
    for (let i = 0; i < length; i++) {
      const fade = Math.min(1, i / 300, (length - i) / 300);
      // Rising pitch makes a reversed clip audibly different from the original.
      samples[start + i] = Math.round(Math.sin((2 * Math.PI * (frequency + n * 60) * i) / RATE) * 12000 * fade);
    }
  }
  return samples;
}
function wav(samples) {
  const header = Buffer.alloc(44), data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sections = [
  { name: "فئات جديدة", categories: ["كرة القدم", "أفلام", "مسلسلات", "أغاني"] },
  { name: "مشاهير وترفيه", categories: ["مشاهير", "ألعاب", "أكلات", "سيارات"] },
  { name: "ثقافة عامة", categories: ["جغرافيا", "تاريخ", "علوم", "تكنولوجيا"] },
];
const templates = [
  ["STANDARD", "IMAGE_BLUR", "STANDARD", "IMAGE_ZOOM", "IMAGE_MEMORY", "AUDIO_GUESS"],
  ["STANDARD", "IMAGE_RIDDLE", "IMAGE_PERSON", "IMAGE_COLOR", "AUDIO_REVERSE", "AUDIO_VOICE"],
];
const stagePoints = { 200: [200, 150, 50], 400: [400, 250, 150], 600: [600, 400, 200] };
const staffId = "00000000-0000-4000-8000-000000000018";

async function main() {
  if (!env.MIGRATION_DATABASE_URL) throw new Error("Set MIGRATION_DATABASE_URL to the migration-owner connection.");
  const store = await storage();
  const client = new pg.Client({ connectionString: env.MIGRATION_DATABASE_URL, statement_timeout: 60000 });
  await client.connect();
  let files = 0;
  // Uploads finish before the rows that reference them are committed.
  const asset = async (name, scope, kind, body, contentType, meta = {}) => {
    const id = uuid(`asset:${name}`), key = `placeholder/${id}.${contentType === "audio/wav" ? "wav" : "svg"}`;
    await store.put(scope, key, body, contentType);
    files++;
    await client.query(
      `INSERT INTO media_assets(id,media_kind,state,access_scope,storage_provider,storage_namespace,storage_key,content_type,byte_size,width_px,height_px,duration_ms,sha256,source_asset_id,transform_spec,uploaded_by_staff_id,ready_at)
       VALUES($1,$2,'ready',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()) ON CONFLICT DO NOTHING`,
      [id, kind, scope, store.provider, store.namespace(scope), key, contentType, body.length, meta.width ?? null, meta.height ?? null,
        meta.durationMs ?? null, createHash("sha256").update(body).digest(), meta.source ?? null, meta.transform ?? {}, staffId],
    );
    return id;
  };
  const image = (name, options, meta) => asset(name, "private", "image", card(options), "image/svg+xml", { width: W, height: H, ...meta });
  const audio = (name, samples, meta) => asset(name, "private", "audio", wav(samples), "audio/wav", { durationMs: Math.round((samples.length / RATE) * 1000), ...meta });
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO staff_accounts(id,role,normalized_email,password_hash,is_active) VALUES($1,'admin','content-import@sahsah.invalid','disabled',false) ON CONFLICT DO NOTHING", [staffId]);
    let order = 0;
    for (const [s, section] of sections.entries()) {
      const sectionId = uuid(`section:${section.name}`);
      await client.query("INSERT INTO category_sections(id,name_ar,display_order) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [sectionId, section.name, s + 1]);
      for (const name of section.categories) {
        const hue = (order * 47) % 360, categoryId = uuid(`category:${name}`);
        const coverId = await asset(`cover:${name}`, "public", "image", cover({ hue, label: name }), "image/svg+xml", { width: 800, height: 1000 });
        await client.query(
          "INSERT INTO categories(id,name_ar,display_order,section_id,description_ar,cover_media_asset_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
          [categoryId, name, ++order, sectionId, `أسئلة تجريبية في ${name}`, coverId],
        );
        for (const [p, formats] of templates.entries()) {
          const packId = uuid(`pack:${name}:${p + 1}`);
          await client.query("INSERT INTO question_packs(id,category_id,pack_number,publication_state) VALUES($1,$2,$3,'published') ON CONFLICT DO NOTHING", [packId, categoryId, p + 1]);
          for (const [i, format] of formats.entries()) {
            const slot = i + 1, tag = `${name}:${p + 1}:${slot}`, questionId = uuid(`question:${tag}`);
            const number = 2 + ((order * 7 + p * 5 + slot * 3) % 8), shown = arabic(number), cap = slot <= 2 ? 200 : slot <= 4 ? 400 : 600;
            const a = 3 + ((order + slot) % 7), b = 4 + ((order * 3 + p + slot) % 6);
            const [prompt, answer, config] = {
              STANDARD: [`كم يساوي ${arabic(a)} × ${arabic(b)}؟`, arabic(a * b), {}],
              IMAGE_BLUR: ["ما الرقم المختبئ في الصورة؟", shown, {}],
              IMAGE_ZOOM: ["ما الرقم الظاهر في الصورة المقرّبة؟", shown, {}],
              IMAGE_MEMORY: ["ما الرقم الذي كان في الصورة؟", shown, {}],
              IMAGE_RIDDLE: ["اضرب الرقم الظاهر في الصورة في ٢. ما الناتج؟", arabic(number * 2), {}],
              IMAGE_PERSON: ["ما الرقم الظاهر في هذا الجزء من الصورة؟", shown, {}],
              IMAGE_COLOR: ["الصورة بلا ألوان. ما الرقم الظاهر فيها؟", shown, { colorHex: "#e8a33d" }],
              AUDIO_GUESS: ["كم نغمة سمعت؟", shown, {}],
              AUDIO_REVERSE: ["المقطع معكوس. كم نغمة سمعت؟", shown, { allowForward: true }],
              AUDIO_VOICE: ["كم نغمة في هذا المقطع؟", shown, { hintAr: "عدّ النغمات بهدوء" }],
            }[format];
            await client.query(
              "INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar,format_config) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
              [questionId, packId, slot, format, prompt, answer, config],
            );
            const pin = (role, assetId, variant = 0, suggested = null) =>
              client.query("INSERT INTO question_media(question_id,media_role,media_asset_id,variant_number,suggested_points) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", [questionId, role, assetId, variant, suggested]);
            if (format.startsWith("IMAGE_")) {
              const options = { hue, label: name, number: shown };
              const original = await image(`${tag}:original`, options);
              await pin("source_image", original);
              if (format !== "IMAGE_RIDDLE") await pin("answer_image", original);
              if (format === "IMAGE_BLUR" || format === "IMAGE_ZOOM") {
                const operation = format === "IMAGE_BLUR" ? "blur" : "crop";
                for (let stage = 0; stage < 3; stage++)
                  await pin("hint_image", await image(`${tag}:${operation}${stage}`, { ...options, effect: `${operation}${stage}` },
                    { source: original, transform: { operation, stageIndex: stage } }), stage, stagePoints[cap][stage]);
              } else if (format === "IMAGE_PERSON" || format === "IMAGE_COLOR") {
                const operation = format === "IMAGE_COLOR" ? "grayscale" : "crop";
                await pin("prompt_image", await image(`${tag}:${operation}`, { ...options, effect: operation }, { source: original, transform: { operation } }));
              } else await pin("prompt_image", original);
            }
            if (format.startsWith("AUDIO_")) {
              const samples = beeps(number, hue), original = await audio(`${tag}:original`, samples);
              await pin("source_audio", original);
              if (format === "AUDIO_REVERSE") {
                await pin("question_audio", await audio(`${tag}:reverse`, samples.slice().reverse(), { source: original, transform: { operation: "reverse" } }));
                await pin("answer_audio", original);
              } else await pin("question_audio", original);
            }
          }
        }
      }
    }
    await client.query("COMMIT");
    console.log(`Placeholder content ready: ${order} categories, ${order * templates.length} packs, ${files} files in ${store.provider} storage.`);
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
