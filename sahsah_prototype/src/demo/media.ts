import type { AdminQuestion } from '../lib/game-types'

const assets = import.meta.glob<string>('./assets/**/*.{jpg,mp3,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const urls = new Map<string, string>()
let database: Promise<IDBDatabase> | undefined
const open = () =>
  (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('sahsah-demo-media', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('المتصفح مش قادر يحفظ الملف'))
  }))
export const mediaUrl = (id?: string) =>
  id ? (urls.get(id) ?? assets['./assets/' + id] ?? '') : undefined
async function store(blob: Blob) {
  const id = 'local-' + crypto.randomUUID(),
    db = await open()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('files', 'readwrite')
    transaction.objectStore('files').put(blob, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(new Error('المساحة مش كفاية لحفظ الملف'))
  })
  urls.set(id, URL.createObjectURL(blob))
  return id
}
export async function warmMedia(ids: string[]) {
  await Promise.all(
    [...new Set(ids)]
      .filter((id) => id.startsWith('local-') && !urls.has(id))
      .map(async (id) => {
        const db = await open()
        const blob = await new Promise<Blob | undefined>((resolve, reject) => {
          const request = db.transaction('files').objectStore('files').get(id)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(new Error('الملف مش متاح'))
        })
        if (blob) urls.set(id, URL.createObjectURL(blob))
      }),
  )
}
const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('الصورة مش جاهزة'))),
      'image/jpeg',
      0.88,
    ),
  )

async function imageStages(q: AdminQuestion, bytes: Blob) {
  const image = await createImageBitmap(bytes)
  try {
    if (image.width * image.height > 24000000) throw new Error('الصورة بحد أقصى ٢٤ ميجابكسل')
    const original = document.createElement('canvas'),
      ratio = Math.min(1, 1600 / Math.max(image.width, image.height))
    original.width = Math.round(image.width * ratio)
    original.height = Math.round(image.height * ratio)
    original.getContext('2d')!.drawImage(image, 0, 0, original.width, original.height)
    const originalImage = await store(await canvasBlob(original))
    const stages: string[] = []
    for (let i = 0; i < 3; i++) {
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 750
      const context = canvas.getContext('2d')!
      context.fillStyle = '#fbf8f1'
      context.fillRect(0, 0, 1000, 750)
      const zoom = q.type === 'IMAGE_ZOOM' ? q.zoomFactors[i] : 1
      const w = original.width / zoom,
        h = original.height / zoom
      const left = Math.max(0, Math.min(original.width - w, original.width * q.focalX - w / 2))
      const top = Math.max(0, Math.min(original.height - h, original.height * q.focalY - h / 2))
      const fit = Math.min(1000 / w, 750 / h)
      if (q.type === 'IMAGE_BLUR') context.filter = `blur(${q.blurSigmas[i]}px)`
      context.drawImage(
        original,
        left,
        top,
        w,
        h,
        (1000 - w * fit) / 2,
        (750 - h * fit) / 2,
        w * fit,
        h * fit,
      )
      stages.push(await store(await canvasBlob(canvas)))
    }
    return { originalImage, stages }
  } finally {
    image.close()
  }
}
function inspectWav(buffer: ArrayBuffer) {
  const bytes = new DataView(buffer),
    name = (at: number, count: number) => String.fromCharCode(...new Uint8Array(buffer, at, count))
  if (buffer.byteLength < 44 || name(0, 4) !== 'RIFF' || name(8, 4) !== 'WAVE')
    throw new Error('ملف الصوت مش صالح')
  let channels = 0,
    rate = 0,
    offset = 0,
    size = 0
  for (let at = 12; at + 8 <= buffer.byteLength;) {
    const length = bytes.getUint32(at + 4, true)
    if (at + 8 + length > buffer.byteLength) throw new Error('ملف الصوت ناقص')
    if (name(at, 4) === 'fmt ') {
      if (
        length < 16 ||
        bytes.getUint16(at + 8, true) !== 1 ||
        bytes.getUint16(at + 22, true) !== 16
      )
        throw new Error('ارفع ملف صوت صالح')
      channels = bytes.getUint16(at + 10, true)
      rate = bytes.getUint32(at + 12, true)
    }
    if (name(at, 4) === 'data') {
      offset = at + 8
      size = length
    }
    at += 8 + length + (length % 2)
  }
  if (![1, 2].includes(channels) || rate < 8000 || rate > 96000 || !size || size % (channels * 2))
    throw new Error('الصوت مش صالح')
  const durationMs = (size / (channels * rate * 2)) * 1000
  if (durationMs < 200 || durationMs > 30000) throw new Error('مدة الصوت من ٠٫٢ إلى ٣٠ ثانية')
  return { bytes, channels, offset, size, durationMs }
}
async function reversed(bytes: Blob) {
  const buffer = await bytes.arrayBuffer(),
    wav = inspectWav(buffer),
    output = buffer.slice(0),
    target = new DataView(output)
  const stride = wav.channels * 2
  for (let at = 0; at < wav.size; at += stride)
    for (let channel = 0; channel < wav.channels; channel++)
      target.setInt16(
        wav.offset + at + channel * 2,
        wav.bytes.getInt16(wav.offset + wav.size - stride - at + channel * 2, true),
        true,
      )
  return store(new Blob([output], { type: 'audio/wav' }))
}
export async function uploadMedia(q: AdminQuestion, file: Blob) {
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم الملف بحد أقصى ١٥ ميجا')
  if (q.type.startsWith('IMAGE_')) return imageStages(q, file)
  const wav = inspectWav(await file.arrayBuffer()),
    id = await store(file)
  return q.type === 'AUDIO_REVERSE'
    ? { forwardSpeech: id, playableAudio: await reversed(file), durationMs: wav.durationMs }
    : { playableAudio: id, durationMs: wav.durationMs }
}
export async function regenerateMedia(q: AdminQuestion) {
  const id = q.type.startsWith('IMAGE_') ? q.originalImage : q.forwardSpeech
  const url = mediaUrl(id)
  if (!url) throw new Error('ارفع الملف الأول')
  const response = await fetch(url),
    file = await response.blob()
  if (!response.ok) throw new Error('الملف مش متاح')
  return q.type.startsWith('IMAGE_')
    ? { ...(await imageStages(q, file)), originalImage: q.originalImage }
    : { playableAudio: await reversed(file) }
}
