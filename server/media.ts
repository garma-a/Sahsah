import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export function decodeWav(bytes: Buffer) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('ارفع صوت قابل للتحويل إلى WAV')
  let format = 0,
    channels = 0,
    sampleRate = 0,
    bits = 0,
    pcm: Buffer | undefined
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4),
      end = at + 8 + size
    if (end > bytes.length) throw new Error('ملف الصوت ناقص')
    const name = bytes.toString('ascii', at, at + 4)
    if (name === 'fmt ' && size >= 16) {
      format = bytes.readUInt16LE(at + 8)
      channels = bytes.readUInt16LE(at + 10)
      sampleRate = bytes.readUInt32LE(at + 12)
      bits = bytes.readUInt16LE(at + 22)
    }
    if (name === 'data') pcm = bytes.subarray(at + 8, end)
    at = end + (size % 2)
  }
  if (
    format !== 1 ||
    ![1, 2].includes(channels) ||
    bits !== 16 ||
    sampleRate < 8000 ||
    sampleRate > 96000 ||
    !pcm ||
    !pcm.length ||
    pcm.length % (channels * 2)
  )
    throw new Error('الصوت لازم يكون PCM 16-bit صالح')
  const durationMs = (pcm.length / (sampleRate * channels * 2)) * 1000
  if (durationMs < 200 || durationMs > 30000) throw new Error('مدة الصوت من ٠٫٢ إلى ٣٠ ثانية')
  return { pcm, channels, sampleRate, durationMs }
}

export function encodeWav(pcm: Buffer, channels: number, rate: number) {
  const head = Buffer.alloc(44)
  head.write('RIFF')
  head.writeUInt32LE(pcm.length + 36, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(channels, 22)
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * channels * 2, 28)
  head.writeUInt16LE(channels * 2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([head, pcm])
}

export function reverseWav(bytes: Buffer) {
  const { pcm, channels, sampleRate } = decodeWav(bytes)
  const stride = channels * 2,
    result = Buffer.alloc(pcm.length)
  let peak = 0
  for (let at = 0; at < pcm.length; at += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(at)))
  const gain = peak > 0 ? Math.min(4, 30000 / peak) : 1
  // Reverse PCM frames while preserving the channels within each frame.
  for (let at = 0; at < pcm.length; at += stride) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = pcm.readInt16LE(pcm.length - stride - at + channel * 2)
      result.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(sample * gain))),
        at + channel * 2,
      )
    }
  }
  return encodeWav(result, channels, sampleRate)
}

export function saveMedia(directory: string, bytes: Buffer, ext: 'jpg' | 'wav' | 'mp3') {
  mkdirSync(directory, { recursive: true })
  const id = randomUUID() + '.' + ext
  writeFileSync(path.join(directory, id), bytes)
  return id
}

export async function processImage(
  directory: string,
  bytes: Buffer,
  type: string,
  options: {
    focalX: number
    focalY: number
    blurSigmas: number[]
    zoomFactors: number[]
  },
) {
  const meta = await sharp(bytes, { limitInputPixels: 24000000 }).metadata()
  if (
    !['jpeg', 'png', 'webp'].includes(meta.format || '') ||
    !meta.width ||
    !meta.height ||
    (meta.pages ?? 1) > 1
  )
    throw new Error('اختار صورة JPG أو PNG أو WebP ثابتة')
  const original = await sharp(bytes, { limitInputPixels: 24000000 })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#fffdf8' })
    .jpeg({ quality: 90 })
    .toBuffer()
  const originalImage = saveMedia(directory, original, 'jpg')
  const normalized = await sharp(original).metadata(),
    w = normalized.width!,
    h = normalized.height!
  const stages: string[] = []
  for (let i = 0; i < 3; i++) {
    let pipeline = sharp(original)
    if (type === 'IMAGE_BLUR')
      pipeline = pipeline
        .resize(1000, 750, { fit: 'contain', background: '#fbf8f1' })
        .blur(options.blurSigmas[i])
    else {
      const zoom = options.zoomFactors[i]
      const width = Math.max(1, Math.floor(w / zoom)),
        height = Math.max(1, Math.floor(h / zoom))
      const left = Math.max(0, Math.min(w - width, Math.round(options.focalX * w - width / 2)))
      const top = Math.max(0, Math.min(h - height, Math.round(options.focalY * h - height / 2)))
      pipeline = pipeline
        .extract({ left, top, width, height })
        .resize(1000, 750, { fit: 'contain', background: '#fbf8f1' })
    }
    stages.push(saveMedia(directory, await pipeline.jpeg({ quality: 88 }).toBuffer(), 'jpg'))
  }
  return { originalImage, stages }
}

export async function regenerateImage(
  directory: string,
  source: string,
  type: string,
  options: Parameters<typeof processImage>[3],
) {
  return processImage(directory, readFileSync(path.join(directory, source)), type, options)
}
