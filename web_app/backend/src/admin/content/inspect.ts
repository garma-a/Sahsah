/**
 * Reads what a finished upload is, without changing it: type from the file's own bytes (never
 * the browser's claim), pixel size for pictures, duration for audio. Sahsah does not process media.
 */
export type Inspected = {
  kind: "image" | "audio";
  contentType: string;
  extension: string;
  widthPx?: number;
  heightPx?: number;
  durationMs?: number;
};

export class MediaRefusal extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export const LIMITS = {
  imageBytes: 10 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
  coverBytes: 5 * 1024 * 1024,
  logoBytes: 2 * 1024 * 1024,
  maxSide: 8192,
  minSide: 32,
  audioMs: 10 * 60 * 1000,
  // The category card is 4:5 (portrait).
  cover: { minWidth: 400, maxWidth: 2400, minRatio: 0.75, maxRatio: 0.85 },
} as const;

function png(b: Buffer) {
  if (b.length < 24 || b.toString("latin1", 12, 16) !== "IHDR") throw new MediaRefusal("corrupt_image");
  return { widthPx: b.readUInt32BE(16), heightPx: b.readUInt32BE(20) };
}

function jpeg(b: Buffer) {
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) throw new MediaRefusal("corrupt_image");
    const marker = b[at + 1]!;
    if (marker === 0xff) {
      at++;
      continue;
    }
    // Start-of-frame markers carry the size; 0xC4, 0xC8 and 0xCC are not frames.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { heightPx: b.readUInt16BE(at + 5), widthPx: b.readUInt16BE(at + 7) };
    at += 2 + b.readUInt16BE(at + 2);
  }
  throw new MediaRefusal("corrupt_image");
}

function webp(b: Buffer) {
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X" && b.length >= 30) return { widthPx: 1 + b.readUIntLE(24, 3), heightPx: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return { widthPx: (bits & 0x3fff) + 1, heightPx: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8 " && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { widthPx: b.readUInt16LE(26) & 0x3fff, heightPx: b.readUInt16LE(28) & 0x3fff };
  throw new MediaRefusal("corrupt_image");
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const SAMPLE_RATES = [44100, 48000, 32000];

/** MPEG-1 Layer III only (what browsers and the apps all play): walks the frames and adds up their length. */
function mp3(b: Buffer) {
  let at = 0;
  if (b.toString("latin1", 0, 3) === "ID3" && b.length > 10) at = 10 + ((b[6]! & 0x7f) << 21 | (b[7]! & 0x7f) << 14 | (b[8]! & 0x7f) << 7 | (b[9]! & 0x7f));
  let seconds = 0, frames = 0;
  while (at + 4 <= b.length) {
    const header = b.readUInt32BE(at);
    const valid = (header >>> 21) === 0x7ff && ((header >>> 19) & 3) === 3 && ((header >>> 17) & 3) === 1;
    const bitrate = BITRATES[(header >>> 12) & 15], rate = SAMPLE_RATES[(header >>> 10) & 3];
    if (!valid || !bitrate || !rate) {
      // Trailing tags or junk after real audio are tolerated; junk before any frame is not.
      if (frames) break;
      at++;
      if (at > 1 << 20) break;
      continue;
    }
    const length = Math.floor((144000 * bitrate) / rate) + ((header >>> 9) & 1);
    seconds += 1152 / rate;
    frames++;
    at += length;
  }
  if (frames < 10) throw new MediaRefusal("corrupt_audio");
  return { durationMs: Math.max(1, Math.round(seconds * 1000)) };
}

export function inspectMedia(body: Buffer, purpose: "cover" | "logo" | "image" | "audio"): Inspected {
  if (!body.length) throw new MediaRefusal("empty_file");
  const isPng = body.length > 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = body.length > 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  const isWebp = body.length > 16 && body.toString("latin1", 0, 4) === "RIFF" && body.toString("latin1", 8, 12) === "WEBP";
  const isAudio = body.toString("latin1", 0, 3) === "ID3" || (body.length > 2 && body[0] === 0xff && (body[1]! & 0xe0) === 0xe0);

  if (purpose === "audio") {
    if (!isAudio) throw new MediaRefusal("unsupported_audio");
    if (body.length > LIMITS.audioBytes) throw new MediaRefusal("file_too_large");
    const { durationMs } = mp3(body);
    if (durationMs > LIMITS.audioMs) throw new MediaRefusal("audio_too_long");
    return { kind: "audio", contentType: "audio/mpeg", extension: "mp3", durationMs };
  }
  if (!isPng && !isJpeg && !isWebp) throw new MediaRefusal("unsupported_image");
  if (body.length > (purpose === "cover" ? LIMITS.coverBytes : purpose === "logo" ? LIMITS.logoBytes : LIMITS.imageBytes)) throw new MediaRefusal("file_too_large");
  const { widthPx, heightPx } = isPng ? png(body) : isJpeg ? jpeg(body) : webp(body);
  if (!widthPx || !heightPx || Math.min(widthPx, heightPx) < LIMITS.minSide || Math.max(widthPx, heightPx) > LIMITS.maxSide) throw new MediaRefusal("image_dimensions");
  if (purpose === "cover") {
    const ratio = widthPx / heightPx;
    if (widthPx < LIMITS.cover.minWidth || widthPx > LIMITS.cover.maxWidth || ratio < LIMITS.cover.minRatio || ratio > LIMITS.cover.maxRatio) throw new MediaRefusal("cover_dimensions");
  }
  return isPng
    ? { kind: "image", contentType: "image/png", extension: "png", widthPx, heightPx }
    : isJpeg
      ? { kind: "image", contentType: "image/jpeg", extension: "jpg", widthPx, heightPx }
      : { kind: "image", contentType: "image/webp", extension: "webp", widthPx, heightPx };
}
