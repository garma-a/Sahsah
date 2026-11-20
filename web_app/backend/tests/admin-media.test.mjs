import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectMedia, MediaRefusal } from "../dist/admin/content/inspect.js";
import { mp3, png } from "./fixtures/media-files.mjs";

const refusal = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof MediaRefusal, String(error));
    return error.code;
  }
  assert.fail("expected a refusal");
};

test("pictures and audio are identified from their bytes and measured", () => {
  assert.deepEqual(inspectMedia(png(120, 80), "image"), { kind: "image", contentType: "image/png", extension: "png", widthPx: 120, heightPx: 80 });
  const audio = inspectMedia(mp3(100), "audio");
  assert.equal(audio.contentType, "audio/mpeg");
  assert.ok(Math.abs(audio.durationMs - 2612) < 5, String(audio.durationMs));
  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0);
  webp.write("WEBP", 8);
  webp.write("VP8X", 12);
  webp.writeUIntLE(199, 24, 3);
  webp.writeUIntLE(99, 27, 3);
  assert.equal(inspectMedia(webp, "image").widthPx, 200);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8]), Buffer.from([0, 90, 0, 160, 3, 1, 0, 0])]);
  assert.deepEqual([inspectMedia(jpeg, "image").widthPx, inspectMedia(jpeg, "image").heightPx], [160, 90]);
});

test("unsupported, corrupt, oversized and mis-shaped files are refused", () => {
  assert.equal(refusal(() => inspectMedia(Buffer.from("GIF89a....."), "image")), "unsupported_image");
  assert.equal(refusal(() => inspectMedia(Buffer.alloc(0), "image")), "empty_file");
  // A picture offered where audio is expected, and the reverse.
  assert.equal(refusal(() => inspectMedia(png(100, 100), "audio")), "unsupported_audio");
  assert.equal(refusal(() => inspectMedia(mp3(100), "image")), "unsupported_image");
  assert.equal(refusal(() => inspectMedia(Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0]), Buffer.alloc(50)]), "audio")), "corrupt_audio");
  assert.equal(refusal(() => inspectMedia(png(10, 10), "image")), "image_dimensions");
  assert.equal(refusal(() => inspectMedia(png(9000, 40), "image")), "image_dimensions");
  assert.equal(refusal(() => inspectMedia(mp3(30000), "audio")), "audio_too_long");
  // Covers are 4:5 portrait posters.
  assert.equal(refusal(() => inspectMedia(png(500, 500), "cover")), "cover_dimensions");
  assert.equal(refusal(() => inspectMedia(png(200, 250), "cover")), "cover_dimensions");
  assert.equal(inspectMedia(png(400, 500), "cover").heightPx, 500);
});
