import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID, scryptSync } from 'node:crypto'
import { GameEngine, ApiError, check, clean, safeEqual, validateQuestion } from './engine.ts'
import { BANK } from './standard-bank.ts'
import { decodeWav, processImage, regenerateImage, reverseWav, saveMedia } from './media.ts'
import { defaultPointStages, type AdminQuestion } from '../src/lib/game-types.ts'

export const PRIVATE_DIR = path.resolve(process.env.SAHSAH_DATA_DIR || 'server/private')
const MEDIA_DIR = path.join(PRIVATE_DIR, 'media')

function seed(mediaDirectory: string): AdminQuestion[] {
  mkdirSync(mediaDirectory, { recursive: true })
  const questions = Object.entries(BANK).flatMap(([categoryId, rows]) =>
    rows.map(([prompt, answerText], row) =>
      validateQuestion({
        type: 'STANDARD',
        categoryId,
        row,
        prompt,
        answerText,
        status: 'PUBLISHED',
      }),
    ),
  )
  const manifest = JSON.parse(readFileSync(path.resolve('server/demo-manifest.json'), 'utf8'))
  for (const item of manifest) {
    const q = questions.find((q) => q.categoryId === item.categoryId && q.row === item.row)!
    const importMedia = (file: string) =>
      saveMedia(
        mediaDirectory,
        readFileSync(path.resolve('server/seed-media', file)),
        file.endsWith('.mp3') ? 'mp3' : file.endsWith('.wav') ? 'wav' : 'jpg',
      )
    Object.assign(q, {
      type: item.type,
      prompt: item.prompt,
      answerText: item.answer,
      notes: item.notes || item.descriptionForAdminOnly || '',
      pointStages: defaultPointStages(q.points),
    })
    if (item.stageImages) {
      q.stages = item.stageImages.map(importMedia)
      q.originalImage = importMedia(item.revealImage)
    }
    if (item.audioUrl) {
      q.playableAudio = importMedia(item.audioUrl)
      const wav = item.audioUrl.replace('.mp3', '.wav')
      // WAV twins give accurate playback duration without trusting filename metadata.
      q.durationMs = decodeWav(readFileSync(path.resolve('server/seed-media', wav))).durationMs
    }
    if (item.forwardAudioAdminOnly) {
      q.forwardSpeech = importMedia(item.forwardAudioAdminOnly)
      q.allowForward = true
    }
  }
  return questions
}

export function createApi(directory = PRIVATE_DIR) {
  const initialized = existsSync(path.join(directory, 'database.json'))
  const mediaDirectory = path.join(directory, 'media')
  const engine = new GameEngine(directory, initialized ? [] : seed(mediaDirectory))
  const streams = new Map<string, Set<ServerResponse>>()
  engine.onChange = (session) =>
    streams
      .get(session.id)
      ?.forEach((res) => res.write(`event: session\ndata: ${JSON.stringify(session)}\n\n`))
  const adminSessions = new Map<string, number>()
  const authFile = path.join(directory, 'admin-auth.json')
  if (!existsSync(authFile) && process.env.SAHSAH_ADMIN_PASSWORD) {
    check(
      process.env.SAHSAH_ADMIN_PASSWORD.length >= 10,
      'SAHSAH_ADMIN_PASSWORD must have at least 10 characters',
    )
    const salt = randomUUID()
    writeFileSync(
      authFile,
      JSON.stringify({
        salt,
        hash: scryptSync(process.env.SAHSAH_ADMIN_PASSWORD, salt, 32).toString('hex'),
      }),
      { mode: 0o600 },
    )
  }
  const failedLogins = new Map<string, { attempts: number; until: number }>()
  const hashPassword = (password: string, salt: string) =>
    scryptSync(password, salt, 32).toString('hex')
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(JSON.stringify(data))
  }
  const token = (req: IncomingMessage) => req.headers.authorization?.replace(/^Bearer /, '') || ''
  const adminToken = (req: IncomingMessage) =>
    req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('sahsah_admin='))
      ?.slice(13) || ''
  const isAdmin = (req: IncomingMessage) => (adminSessions.get(adminToken(req)) ?? 0) > Date.now()
  const body = async (req: IncomingMessage, max = 2 * 1024 * 1024) => {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      check(size <= max, 'حجم الملف أكبر من المسموح', 413)
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
  const parse = async (req: IncomingMessage) => {
    try {
      return JSON.parse((await body(req)).toString())
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(400, 'بيانات الطلب مش صحيحة')
    }
  }
  const poll = setInterval(() => {
    for (const s of Object.values(engine.db.sessions)) engine.reconcile(s)
    for (const clients of streams.values()) for (const res of clients) res.write(': keepalive\n\n')
    for (const [id, until] of adminSessions) if (until < Date.now()) adminSessions.delete(id)
  }, 1500)
  poll.unref()

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawPath = req.url?.split('?')[0] || '/'
    let pathname: string
    try {
      pathname = decodeURIComponent(rawPath)
    } catch {
      return json(res, 400, { error: 'رابط مش صالح' })
    }
    const diskPath = path.resolve(
      pathname.startsWith('/@fs/')
        ? pathname.slice(4)
        : path.resolve(process.cwd(), '.' + pathname),
    )
    const privateRoot = path.resolve(directory)
    if (diskPath === privateRoot || diskPath.startsWith(privateRoot + path.sep))
      return json(res, 404, { error: 'مش موجود' })
    if (/(^|\/)src\/demo(\/|$)/.test(pathname)) return json(res, 404, { error: 'مش موجود' })
    // Backend source, seeds and private persistence must never be served by Vite.
    if (/(^|\/)(server|\.git|\.env[^/]*)(\/|$)/.test(pathname) || pathname.endsWith('.zip'))
      return json(res, 404, { error: 'مش موجود' })
    if (!pathname.startsWith('/api/')) return next()
    try {
      if (!['GET', 'HEAD'].includes(req.method || '') && req.headers.origin) {
        check(new URL(req.headers.origin).host === req.headers.host, 'مصدر الطلب مش مسموح', 403)
      }
      const segments = pathname.slice(5).split('/'),
        method = req.method
      if (segments[0] === 'health') return json(res, 200, { ok: true })
      if (segments[0] === 'admin') {
        if (segments[1] === 'auth') {
          if (method === 'GET')
            return json(res, 200, {
              authenticated: isAdmin(req),
              setupRequired: !existsSync(authFile),
            })
          if (method === 'DELETE') {
            adminSessions.delete(adminToken(req))
            res.setHeader(
              'Set-Cookie',
              'sahsah_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0',
            )
            return json(res, 200, { ok: true })
          }
          check(method === 'POST', 'طريقة الطلب مش صحيحة', 405)
          const input = await parse(req),
            password = String(input.password ?? '')
          const key = req.socket.remoteAddress || 'local',
            previous = failedLogins.get(key)
          check(
            !previous || previous.until < Date.now() || previous.attempts < 5,
            'استنى شوية قبل المحاولة تاني',
            429,
          )
          if (!existsSync(authFile)) {
            // No default admin password; setup is possible only on the server machine.
            check(
              ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(key),
              'إعداد الإدارة لأول مرة من جهاز السيرفر بس',
              403,
            )
            check(password.length >= 10 && password.length <= 200, 'كلمة السر ١٠ حروف على الأقل')
            const salt = randomUUID()
            writeFileSync(authFile, JSON.stringify({ salt, hash: hashPassword(password, salt) }), {
              mode: 0o600,
            })
          } else {
            check(password.length <= 200, 'كلمة السر مش صحيحة', 401)
            const auth = JSON.parse(readFileSync(authFile, 'utf8'))
            if (!safeEqual(hashPassword(password, auth.salt), auth.hash)) {
              failedLogins.set(key, {
                attempts:
                  (previous?.until && previous.until > Date.now() ? previous.attempts : 0) + 1,
                until: Date.now() + 60000,
              })
              throw new ApiError(401, 'كلمة السر مش صحيحة')
            }
          }
          failedLogins.delete(key)
          const credential = randomUUID()
          adminSessions.set(credential, Date.now() + 8 * 3600000)
          res.setHeader(
            'Set-Cookie',
            `sahsah_admin=${credential}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${
              'encrypted' in req.socket && req.socket.encrypted ? '; Secure' : ''
            }`,
          )
          return json(res, 200, { authenticated: true })
        }
        check(isAdmin(req), 'ادخل بحساب الإدارة الأول', 401)
        if (segments[1] === 'media' && method === 'GET') {
          check(/^[0-9a-f-]+\.(jpg|wav|mp3)$/.test(segments[2]), 'ملف مش موجود', 404)
          const file = path.join(mediaDirectory, segments[2])
          check(existsSync(file), 'ملف مش موجود', 404)
          res.writeHead(200, {
            'Content-Type': file.endsWith('.jpg')
              ? 'image/jpeg'
              : file.endsWith('.wav')
                ? 'audio/wav'
                : 'audio/mpeg',
            'Cache-Control': 'no-store',
          })
          return res.end(readFileSync(file))
        }
        check(segments[1] === 'questions', 'مش موجود', 404)
        if (!segments[2]) {
          if (method === 'GET') return json(res, 200, engine.db.questions)
          check(method === 'POST', 'طريقة الطلب مش صحيحة', 405)
          return json(res, 201, engine.saveQuestion(await parse(req)))
        }
        const q = engine.db.questions.find((q) => q.id === segments[2])
        check(q, 'السؤال مش موجود', 404)
        if (!segments[3] && method === 'PATCH')
          return json(res, 200, engine.saveQuestion(await parse(req), q.id))
        if (segments[3] === 'media' && method === 'POST') {
          const bytes = await body(req, 15 * 1024 * 1024)
          try {
            if (q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM')
              Object.assign(q, await processImage(mediaDirectory, bytes, q.type, q))
            else if (q.type === 'AUDIO_GUESS' || q.type === 'AUDIO_REVERSE') {
              const wav = decodeWav(bytes)
              q.durationMs = wav.durationMs
              if (q.type === 'AUDIO_REVERSE') {
                q.forwardSpeech = saveMedia(mediaDirectory, bytes, 'wav')
                q.playableAudio = saveMedia(mediaDirectory, reverseWav(bytes), 'wav')
              } else q.playableAudio = saveMedia(mediaDirectory, bytes, 'wav')
            } else throw new ApiError(400, 'اختار نوع السؤال الأول')
          } catch (error) {
            if (error instanceof ApiError) throw error
            throw new ApiError(
              400,
              q.type.startsWith('IMAGE_')
                ? 'ملف الصورة مش صالح. اختار JPG أو PNG أو WebP ثابتة.'
                : error instanceof Error
                  ? error.message
                  : 'ملف الصوت مش صالح',
            )
          }
          engine.persist()
          return json(res, 200, q)
        }
        if (segments[3] === 'generate-stages' && method === 'POST') {
          check(q.originalImage && q.type.startsWith('IMAGE_'), 'ارفع الصورة الأول')
          Object.assign(q, await regenerateImage(mediaDirectory, q.originalImage, q.type, q))
          engine.persist()
          return json(res, 200, q)
        }
        if (segments[3] === 'generate-reverse' && method === 'POST') {
          check(q.type === 'AUDIO_REVERSE' && q.forwardSpeech, 'ارفع الكلام الأصلي الأول')
          q.playableAudio = saveMedia(
            mediaDirectory,
            reverseWav(readFileSync(path.join(mediaDirectory, q.forwardSpeech))),
            'wav',
          )
          engine.persist()
          return json(res, 200, q)
        }
        throw new ApiError(404, 'مش موجود')
      }
      if (segments[0] === 'rooms' && method === 'GET') {
        const s = Object.values(engine.db.sessions).find(
          (s) => s.code === segments[1] && s.phase !== 'finished',
        )
        check(s, 'الكود مش صحيح أو اللعبة خلصت', 404)
        return json(res, 200, engine.public(s))
      }
      if (segments[0] === 'sessions') {
        if (segments[1] === 'import' && method === 'POST')
          return json(res, 201, engine.importLegacy(await parse(req)))
        if (!segments[1] && method === 'POST') {
          const data = await parse(req)
          return json(res, 201, engine.create(data.categoryIds || [], data.names || []))
        }
        const s = engine.get(segments[1])
        engine.reconcile(s)
        if (!segments[2] && method === 'GET') return json(res, 200, engine.public(s))
        if (segments[2] === 'events' && method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          })
          res.write(`event: session\ndata: ${JSON.stringify(engine.public(s))}\n\n`)
          const clients = streams.get(s.id) || new Set<ServerResponse>()
          streams.set(s.id, clients)
          clients.add(res)
          req.on('close', () => {
            clients.delete(res)
            if (!clients.size) streams.delete(s.id)
          })
          return
        }
        if (segments[2] === 'join' && method === 'POST') {
          const data = await parse(req)
          check(['A', 'B'].includes(data.team), 'اختار فريق')
          check(s.guests.length < 100, 'اللعبة مليانة')
          const name = clean(data.name, 24) || 'ضيف'
          s.guests.push({ name, team: data.team })
          return json(res, 200, engine.touch(s))
        }
        if (segments[2] === 'actions' && method === 'POST')
          return json(res, 200, engine.action(s.id, token(req), await parse(req)))
        if (segments[2] === 'audio' && method === 'POST') {
          const data = await parse(req)
          const result =
            data.op === 'reserve'
              ? engine.reserveAudio(
                  s.id,
                  token(req),
                  data.questionId,
                  data.deviceId,
                  data.requestId,
                )
              : engine.acknowledgeAudio(
                  s.id,
                  token(req),
                  data.questionId,
                  data.deviceId,
                  data.requestId,
                  data.op,
                )
          return json(res, 200, result)
        }
        if (segments[2] === 'media' && method === 'GET') {
          const media = segments[3]
          check(/^[0-9a-f-]+\.(jpg|wav|mp3)$/.test(media), 'ملف مش موجود', 404)
          const allowed = s.records.some((q) => {
            const l = s.live[q.id]
            return (
              (s.activeQuestionId === q.id &&
                (q.stages.slice(0, l.stageIndex + 1).includes(media) ||
                  q.playableAudio === media)) ||
              (l.revealed &&
                (q.originalImage === media || (q.allowForward && q.forwardSpeech === media)))
            )
          })
          check(allowed, 'المحتوى لسه مش متاح', 403)
          const file = path.join(mediaDirectory, media)
          check(existsSync(file), 'ملف مش موجود', 404)
          const bytes = readFileSync(file)
          res.writeHead(200, {
            'Content-Type': media.endsWith('.jpg')
              ? 'image/jpeg'
              : media.endsWith('.wav')
                ? 'audio/wav'
                : 'audio/mpeg',
            'Content-Length': bytes.length,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          return res.end(bytes)
        }
      }
      throw new ApiError(404, 'مش موجود')
    } catch (error) {
      if (res.headersSent) return res.end()
      const status = error instanceof ApiError ? error.status : 500
      if (status === 500) console.error(error)
      json(res, status, {
        error:
          error instanceof ApiError ? error.message : 'حصلت مشكلة في الملف أو السيرفر. جرّب تاني.',
      })
    }
  }
  return {
    handler,
    engine,
    close: () => {
      clearInterval(poll)
      streams.forEach((clients) => clients.forEach((res) => res.end()))
    },
  }
}
