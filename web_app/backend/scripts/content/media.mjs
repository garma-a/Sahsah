// Media preparation shared by the content commands: image normalisation,
// blur/zoom renditions, category covers and MP3 extraction from QuickTime.
import { createHash } from "node:crypto";
import sharp from "sharp";

export const sha256 = (body) => createHash("sha256").update(body).digest("hex");
/** A stable UUID (v4 layout) derived from a name, so reruns address the same rows. */
export function uuid(name) {
  const h = createHash("sha256").update(`sahsah-content:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const MAX_SIDE = 1600;
async function webp(pipeline) {
  const { data, info } = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { body: data, contentType: "image/webp", width: info.width, height: info.height };
}
/** Re-encodes a picture as WebP within 1600 px, dropping camera metadata. */
export const image = (input) =>
  webp(sharp(input).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }));

/** Three blur stages, strongest first, scaled to the picture so every size blurs alike. */
export async function blurStages(original) {
  const meta = await sharp(original).metadata();
  const side = Math.max(meta.width, meta.height);
  return Promise.all([0.045, 0.022, 0.009].map((f) => webp(sharp(original).blur(Math.max(0.3, side * f)))));
}

/** Three zoom stages around a focus point (fractions of width/height), tightest first. */
export async function zoomStages(original, [fx, fy]) {
  const { width, height } = await sharp(original).metadata();
  return Promise.all(
    [0.22, 0.42, 0.7].map((scale) => {
      const w = Math.round(width * scale), h = Math.round(height * scale);
      const left = Math.min(width - w, Math.max(0, Math.round(width * fx - w / 2)));
      const top = Math.min(height - h, Math.max(0, Math.round(height * fy - h / 2)));
      return webp(sharp(original).extract({ left, top, width: w, height: h }).resize(width, height));
    }),
  );
}

/** A category poster, cropped to the 4:5 card the category picker shows. */
export const coverImage = (input) =>
  webp(sharp(input).rotate().resize({ width: 800, height: 1000, fit: "cover", position: "attention" }));

// QuickTime/MP4 boxes: only the few needed to find one audio track's samples.
function boxes(buf, start, end) {
  const out = [];
  for (let off = start; off + 8 <= end; ) {
    let size = buf.readUInt32BE(off), header = 8;
    const type = buf.toString("latin1", off + 4, off + 8);
    if (size === 1) (size = Number(buf.readBigUInt64BE(off + 8))), (header = 16);
    else if (size === 0) size = end - off;
    if (size < header) throw new Error("Malformed QuickTime box.");
    out.push({ type, start: off + header, end: off + size });
    off += size;
  }
  return out;
}
const child = (buf, box, type) => boxes(buf, box.start, box.end).find((b) => b.type === type);
const path = (buf, box, ...types) => types.reduce((b, t) => b && child(buf, b, t), box);

/**
 * Extracts the MP3 stream from a QuickTime audio file (the client's clips are
 * MP3 inside .mov). Returns the raw MP3 bytes and the track duration.
 */
export function mp3FromQuickTime(buf) {
  const moov = boxes(buf, 0, buf.length).find((b) => b.type === "moov");
  if (!moov) throw new Error("No movie header.");
  for (const trak of boxes(buf, moov.start, moov.end).filter((b) => b.type === "trak")) {
    const mdia = child(buf, trak, "mdia");
    const hdlr = child(buf, mdia, "hdlr");
    if (buf.toString("latin1", hdlr.start + 8, hdlr.start + 12) !== "soun") continue;
    const stbl = path(buf, mdia, "minf", "stbl");
    const stsd = child(buf, stbl, "stsd");
    const codec = buf.toString("latin1", stsd.start + 12, stsd.start + 16);
    if (codec !== ".mp3") throw new Error(`Unsupported audio codec ${codec}.`);
    const mdhd = child(buf, mdia, "mdhd");
    const v1 = buf[mdhd.start] === 1;
    const timescale = buf.readUInt32BE(mdhd.start + (v1 ? 20 : 12));
    const duration = v1 ? Number(buf.readBigUInt64BE(mdhd.start + 24)) : buf.readUInt32BE(mdhd.start + 16);
    // Sample sizes, chunk offsets and the samples-per-chunk runs.
    const stsz = child(buf, stbl, "stsz");
    const fixed = buf.readUInt32BE(stsz.start + 4), count = buf.readUInt32BE(stsz.start + 8);
    const sizes = Array.from({ length: count }, (_, i) => fixed || buf.readUInt32BE(stsz.start + 12 + i * 4));
    const co = child(buf, stbl, "stco") ?? child(buf, stbl, "co64");
    const chunks = buf.readUInt32BE(co.start + 4);
    const offsets = Array.from({ length: chunks }, (_, i) =>
      co.type === "stco" ? buf.readUInt32BE(co.start + 8 + i * 4) : Number(buf.readBigUInt64BE(co.start + 8 + i * 8)),
    );
    const stsc = child(buf, stbl, "stsc");
    const runs = Array.from({ length: buf.readUInt32BE(stsc.start + 4) }, (_, i) => ({
      first: buf.readUInt32BE(stsc.start + 8 + i * 12),
      perChunk: buf.readUInt32BE(stsc.start + 12 + i * 12),
    }));
    const parts = [];
    let sample = 0;
    for (let c = 0; c < chunks; c++) {
      const run = runs.findLast((r) => r.first <= c + 1);
      let at = offsets[c];
      for (let s = 0; s < run.perChunk && sample < count; s++, sample++) {
        parts.push(buf.subarray(at, at + sizes[sample]));
        at += sizes[sample];
      }
    }
    const body = Buffer.concat(parts);
    if (body[0] !== 0xff || (body[1] & 0xe0) !== 0xe0) throw new Error("Extracted audio is not an MP3 frame stream.");
    return { body, contentType: "audio/mpeg", durationMs: Math.round((duration / timescale) * 1000) };
  }
  throw new Error("No audio track.");
}
