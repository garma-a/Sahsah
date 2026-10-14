import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import sharp from 'sharp'
import { GameEngine, validateQuestion, ApiError } from '../server/engine.ts'
import { createApi } from '../server/api.ts'
import { decodeWav, encodeWav, processImage, reverseWav } from '../server/media.ts'

const categories = ['football', 'general', 'cinema', 'travel', 'music', 'ancient']
const directory = () => mkdtempSync(path.join(tmpdir(), 'sahsah-test-'))
const errorStatus = (status: number) => (error: unknown) =>
  error instanceof ApiError && error.status === status

test('legacy games keep scores, played positions, standard content and manual timer without importing answers', () => {
  const engine = new GameEngine(directory())
  const imported = engine.importLegacy({
    id: 'old-local-game',
    code: '1234',
    phase: 'question',
    categoryIds: categories,
    teams: [
      { name: 'أ', score: 600 },
      { name: 'ب', score: 1200 },
    ],
    questions: [
      { id: 'general-0', categoryId: 'general', row: 0, state: 'answered' },
      {
        id: 'general-1',
        categoryId: 'general',
        row: 1,
        state: 'available',
        correctAnswer: 'injected browser answer',
      },
    ],
    activeQuestionId: 'general-1',
    timer: { status: 'paused', remainingMs: 12000 },
  })
  assert.equal(imported.session.questions.length, 36)
  assert.equal(
    imported.session.questions.every((q) => q.type === 'STANDARD'),
    true,
  )
  assert.deepEqual(
    imported.session.teams.map((t) => t.score),
    [600, 1200],
  )
  assert.equal(imported.session.code, '1234')
  assert.equal(imported.session.phase, 'question')
  assert.equal(imported.session.timer.remainingMs, 12000)
  assert.equal(imported.session.timer.status, 'paused')
  assert.equal(
    imported.session.questions.find((q) => q.categoryId === 'general' && q.row === 0)?.state,
    'answered',
  )
  assert.equal(JSON.stringify(imported.session).includes('injected browser answer'), false)
  const revealed = engine.action(imported.session.id, imported.hostToken, {
    type: 'reveal',
    version: imported.session.version,
  })
  assert.equal(
    revealed.questions.find((q) => q.id === revealed.activeQuestionId)?.answer?.text,
    '27',
  )
})

test('standard board, manual timer, reveal/award ordering and score correction', () => {
  const engine = new GameEngine(directory())
  const { session, hostToken } = engine.create(categories, ['الفراعنة', 'الجدعان'])
  assert.equal(session.questions.length, 36)
  for (const category of categories)
    assert.deepEqual(
      session.questions.filter((q) => q.categoryId === category).map((q) => q.points),
      [200, 200, 400, 400, 600, 600],
    )
  let s = engine.action(session.id, hostToken, {
    type: 'startGame',
    version: session.version,
  })
  const q = s.questions[0]
  s = engine.action(s.id, hostToken, {
    type: 'openQuestion',
    id: q.id,
    version: s.version,
  })
  assert.equal(s.timer.status, 'idle')
  assert.ok(!JSON.stringify(s).includes('answerText'))
  assert.ok(!s.questions[0].answer)
  assert.throws(
    () => engine.action(s.id, 'guest', { type: 'reveal', version: s.version }),
    errorStatus(403),
  )
  assert.throws(
    () =>
      engine.action(s.id, hostToken, {
        type: 'award',
        questionId: q.id,
        teamId: 'A',
        version: s.version,
      }),
    errorStatus(400),
  )
  s = engine.action(s.id, hostToken, {
    type: 'timer',
    op: 'start',
    version: s.version,
  })
  assert.equal(s.timer.status, 'running')
  s = engine.action(s.id, hostToken, {
    type: 'timer',
    op: 'reset',
    version: s.version,
  })
  assert.equal(s.timer.status, 'idle')
  s = engine.action(s.id, hostToken, { type: 'reveal', version: s.version })
  assert.ok(s.questions[0].answer?.text)
  const version = s.version
  s = engine.action(s.id, hostToken, {
    type: 'award',
    questionId: q.id,
    teamId: 'A',
    version,
  })
  engine.action(s.id, hostToken, {
    type: 'award',
    questionId: q.id,
    teamId: 'A',
    version,
  })
  assert.equal(s.teams[0].score, 200)
  assert.equal(s.questions[0].state, 'answered')
  s = engine.action(s.id, hostToken, {
    type: 'adjust',
    teamId: 'A',
    delta: -100,
    version: s.version,
  })
  assert.equal(s.teams[0].score, 100)
  const restored = new GameEngine(engine.directory).public(
    new GameEngine(engine.directory).get(s.id),
  )
  assert.equal(restored.teams[0].score, 100)
  assert.equal(restored.questions[0].state, 'answered')
})

test('image help never resets or increases points, stale taps rejected and nobody earns zero', () => {
  const engine = new GameEngine(directory())
  const q = validateQuestion({
    type: 'IMAGE_BLUR',
    categoryId: 'football',
    row: 4,
    prompt: 'خمن الصورة',
    answerText: 'إجابة خاصة',
    status: 'DRAFT',
  })
  q.status = 'PUBLISHED'
  q.stages = ['one.jpg', 'two.jpg', 'three.jpg']
  q.originalImage = 'original.jpg'
  engine.db.questions.push(q)
  let { session: s, hostToken } = engine.create(categories, ['A', 'B'])
  const act = (type: string, extra = {}) => {
    s = engine.action(s.id, hostToken, { type, version: s.version, ...extra })
  }
  act('startGame')
  act('openQuestion', { id: q.id })
  const version = s.version
  act('advanceStage')
  assert.equal(s.questions.find((x) => x.id === q.id)?.availablePoints, 400)
  assert.throws(
    () => engine.action(s.id, hostToken, { type: 'advanceStage', version }),
    errorStatus(409),
  )
  act('backToBoard')
  act('openQuestion', { id: q.id })
  assert.equal(s.questions.find((x) => x.id === q.id)?.stageIndex, 1)
  act('advanceStage')
  assert.equal(s.questions.find((x) => x.id === q.id)?.availablePoints, 200)
  assert.throws(
    () =>
      engine.action(s.id, hostToken, {
        type: 'advanceStage',
        version: s.version,
      }),
    errorStatus(400),
  )
  act('reveal')
  act('award', { questionId: q.id, teamId: null })
  assert.deepEqual(
    s.teams.map((t) => t.score),
    [0, 0],
  )
  assert.equal(s.lastAward?.points, 0)
  assert.equal(s.questions.length, 36)
})

test('audio lease is atomic, cancellation is free, acknowledgment is idempotent and device authority is shared', () => {
  const engine = new GameEngine(directory())
  const q = validateQuestion({
    type: 'AUDIO_REVERSE',
    categoryId: 'music',
    row: 0,
    prompt: 'خمن',
    answerText: 'سر',
    status: 'DRAFT',
  })
  Object.assign(q, {
    status: 'PUBLISHED',
    playableAudio: 'reversed.wav',
    forwardSpeech: 'original.wav',
    durationMs: 1000,
    allowForward: true,
  })
  engine.db.questions.push(q)
  let { session: s, hostToken } = engine.create(categories, ['A', 'B'])
  s = engine.action(s.id, hostToken, { type: 'startGame', version: s.version })
  s = engine.action(s.id, hostToken, {
    type: 'openQuestion',
    id: q.id,
    version: s.version,
  })
  assert.ok(!JSON.stringify(s).includes('original.wav'))
  assert.ok(!JSON.stringify(s).includes('سر'))
  engine.reserveAudio(s.id, hostToken, q.id, 'main', 'rejected-play')
  assert.throws(
    () => engine.reserveAudio(s.id, hostToken, q.id, 'second', 'race'),
    errorStatus(409),
  )
  engine.acknowledgeAudio(s.id, hostToken, q.id, 'main', 'rejected-play', 'cancel')
  assert.equal(engine.get(s.id).live[q.id].audioPlaysUsed, 0)
  for (let i = 0; i < 3; i++) {
    engine.reserveAudio(s.id, hostToken, q.id, 'main', `play-${i}`)
    s = engine.acknowledgeAudio(s.id, hostToken, q.id, 'main', `play-${i}`, 'started')
    engine.acknowledgeAudio(s.id, hostToken, q.id, 'main', `play-${i}`, 'started')
    assert.equal(engine.get(s.id).live[q.id].audioPlaysUsed, i + 1)
    assert.throws(
      () => engine.reserveAudio(s.id, hostToken, q.id, 'main', 'overlap'),
      errorStatus(409),
    )
    s = engine.acknowledgeAudio(s.id, hostToken, q.id, 'main', `play-${i}`, 'ended')
  }
  assert.throws(
    () => engine.reserveAudio(s.id, hostToken, q.id, 'main', 'fourth'),
    errorStatus(409),
  )
  assert.throws(
    () => engine.reserveAudio(s.id, hostToken, q.id, 'second', 'device'),
    errorStatus(409),
  )
  assert.equal(s.phase, 'question')
  assert.equal(s.timer.status, 'idle')
  assert.equal(s.teams[0].score, 0)
  s = engine.action(s.id, hostToken, { type: 'reveal', version: s.version })
  assert.equal(s.questions.find((x) => x.id === q.id)?.answer?.text, 'سر')
  assert.ok(s.questions.find((x) => x.id === q.id)?.answer?.forwardAudioUrl)
})

test('point schedules and focal coordinates are validated', () => {
  const q = {
    type: 'IMAGE_ZOOM',
    categoryId: 'general',
    row: 4,
    prompt: 'صورة',
    status: 'DRAFT',
    focalX: 0.2,
    focalY: 0.8,
  }
  assert.deepEqual(validateQuestion(q).pointStages, [600, 400, 200])
  assert.throws(() => validateQuestion({ ...q, pointStages: [600, 600, 200] }))
  assert.throws(() => validateQuestion({ ...q, pointStages: [200, 150, 50] }))
  assert.throws(() => validateQuestion({ ...q, focalX: 1.1 }))
  assert.throws(() => validateQuestion({ ...q, maxPlays: 11 }))
})

test('server PCM reversal preserves stereo frames, normalizes and rejects corrupt media', () => {
  const pcm = Buffer.alloc(8000 * 2 * 2)
  for (let i = 0; i < 8000; i++) {
    pcm.writeInt16LE(i % 2 ? 30000 : -25000, i * 4)
    pcm.writeInt16LE(i % 2 ? 20000 : -15000, i * 4 + 2)
  }
  const wav = encodeWav(pcm, 2, 8000),
    reversed = decodeWav(reverseWav(wav))
  assert.equal(reversed.channels, 2)
  assert.equal(reversed.pcm.readInt16LE(0), pcm.readInt16LE(pcm.length - 4))
  assert.equal(reversed.pcm.readInt16LE(2), pcm.readInt16LE(pcm.length - 2))
  assert.equal(reversed.pcm.readInt16LE(reversed.pcm.length - 4), pcm.readInt16LE(0))
  assert.throws(() => decodeWav(Buffer.from('not audio')))
  assert.throws(() => decodeWav(wav.subarray(0, 60)))
})

test('blur/zoom processing uses one source, stripped metadata and stable dimensions', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sahsah-media-'))
  const bytes = await sharp({
    create: { width: 600, height: 450, channels: 3, background: '#ff0000' },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: '#0000ff',
          },
        })
          .png()
          .toBuffer(),
        left: 100,
        top: 100,
      },
    ])
    .png()
    .toBuffer()
  const options = {
    focalX: 0.25,
    focalY: 0.3,
    blurSigmas: [32, 16, 6],
    zoomFactors: [8, 4, 2],
  }
  for (const mode of ['IMAGE_BLUR', 'IMAGE_ZOOM']) {
    const result = await processImage(directory, bytes, mode, options)
    assert.equal(result.stages.length, 3)
    const fingerprints: string[] = []
    for (const file of result.stages) {
      const bytes = readFileSync(path.join(directory, file)),
        meta = await sharp(bytes).metadata()
      assert.equal(meta.width, 1000)
      assert.equal(meta.height, 750)
      assert.equal(meta.exif, undefined)
      fingerprints.push(bytes.toString('base64'))
    }
    assert.equal(new Set(fingerprints).size, 3)
  }
})

test('real HTTP: seed, guest authorization, media privacy, concurrent stages, global plays, admin upload and reconnect', async () => {
  const api = createApi(directory())
  const server = createServer((req, res) => {
    void api.handler(req, res, () => {
      res.writeHead(200)
      res.end('static fallback')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const request = async (
    url: string,
    data?: unknown,
    token = '',
    cookie = '',
    method = data === undefined ? 'GET' : 'POST',
  ) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    })
    const body = await res.json()
    return { res, body }
  }
  try {
    assert.equal(api.engine.db.questions.length, 72)
    assert.equal(api.engine.db.questions.filter((q) => q.type !== 'STANDARD').length, 24)
    const created = await request('/api/sessions', {
      categoryIds: categories,
      names: ['A', 'B'],
    })
    let s = created.body.session
    const token = created.body.hostToken
    const action = async (data: Record<string, unknown>) => {
      const result = await request(
        `/api/sessions/${s.id}/actions`,
        { ...data, version: s.version },
        token,
      )
      assert.equal(result.res.status, 200)
      s = result.body
    }
    await action({ type: 'startGame' })
    const image = s.questions.find((q: any) => q.type === 'IMAGE_BLUR')
    await action({ type: 'openQuestion', id: image.id })
    const privateRecord = api.engine.get(s.id).records.find((q) => q.id === image.id)!
    assert.equal(
      (await fetch(`${base}/api/sessions/${s.id}/media/${privateRecord.originalImage}`)).status,
      403,
    )
    assert.equal(
      (await fetch(`${base}/api/sessions/${s.id}/media/${privateRecord.stages[2]}`)).status,
      403,
    )
    assert.equal(
      (await fetch(base + s.questions.find((q: any) => q.id === image.id).imageUrl)).status,
      200,
    )
    for (const type of ['advanceStage', 'reveal', 'award', 'timer', 'adjust'])
      assert.equal(
        (
          await request(`/api/sessions/${s.id}/actions`, {
            type,
            version: s.version,
            op: 'start',
            questionId: image.id,
            teamId: 'A',
            delta: 100,
          })
        ).res.status,
        403,
      )
    const version = s.version
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        request(`/api/sessions/${s.id}/actions`, { type: 'advanceStage', version }, token),
      ),
    )
    assert.deepEqual(concurrent.map((r) => r.res.status).sort(), [200, 409])
    s = (await request(`/api/sessions/${s.id}`)).body
    assert.equal(s.questions.find((q: any) => q.id === image.id).stageIndex, 1)
    assert.equal(s.timer.status, 'idle')
    await action({ type: 'reveal' })
    assert.equal(
      (await fetch(`${base}/api/sessions/${s.id}/media/${privateRecord.originalImage}`)).status,
      200,
    )
    await action({ type: 'award', questionId: image.id, teamId: null })
    const audio = s.questions.find((q: any) => q.type === 'AUDIO_GUESS')
    await action({ type: 'openQuestion', id: audio.id })
    const audioRequest = (op: string, requestId: string, credential = token) =>
      request(
        `/api/sessions/${s.id}/audio`,
        { op, questionId: audio.id, requestId, deviceId: 'main' },
        credential,
      )
    assert.equal((await audioRequest('reserve', 'guest', '')).res.status, 403)
    for (let i = 0; i < 3; i++) {
      const id = `http-${i}`
      assert.equal((await audioRequest('reserve', id)).res.status, 200)
      assert.equal((await audioRequest('started', id)).res.status, 200)
      assert.equal(
        (await audioRequest('started', id)).body.questions.find((q: any) => q.id === audio.id)
          .audioPlaysUsed,
        i + 1,
      )
      assert.equal((await audioRequest('ended', id)).res.status, 200)
    }
    assert.equal((await audioRequest('reserve', 'fourth')).res.status, 409)
    assert.equal((await request('/api/admin/questions')).res.status, 401)
    const login = await request('/api/admin/auth', {
      password: 'test-password-12345',
    })
    assert.equal(login.res.status, 200)
    const cookie = login.res.headers.get('set-cookie')!.split(';')[0]
    const record = {
      type: 'AUDIO_REVERSE',
      categoryId: 'general',
      row: 0,
      prompt: 'تقدر تخمن؟',
      answerText: 'خاص',
      status: 'DRAFT',
    }
    const draft = await request('/api/admin/questions', record, '', cookie)
    assert.equal(draft.res.status, 201)
    const bytes = readFileSync(
      'server/seed-media/admin_only/reverse_originals/R01/forward_reference.wav',
    )
    const upload = await fetch(`${base}/api/admin/questions/${draft.body.id}/media`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'audio/wav' },
      body: bytes,
    })
    assert.equal(upload.status, 200)
    const media = await upload.json()
    assert.notEqual(media.forwardSpeech, media.playableAudio)
    const reversed = decodeWav(
      readFileSync(path.join(api.engine.directory, 'media', media.playableAudio)),
    )
    assert.equal(reversed.durationMs, decodeWav(bytes).durationMs)
    const published = await request(
      `/api/admin/questions/${media.id}`,
      { ...media, status: 'PUBLISHED' },
      '',
      cookie,
      'PATCH',
    )
    assert.equal(published.res.status, 200)
    const joined = await request(`/api/sessions/${s.id}/join`, {
      name: 'Guest',
      team: 'B',
    })
    assert.equal(joined.res.status, 200)
    assert.equal(joined.body.questions.find((q: any) => q.id === audio.id).audioPlaysUsed, 3)
    const abort = new AbortController(),
      event = await fetch(`${base}/api/sessions/${s.id}/events`, {
        signal: abort.signal,
      })
    const chunk = await event.body!.getReader().read()
    assert.ok(new TextDecoder().decode(chunk.value).includes('event: session'))
    abort.abort()
    for (const file of [
      '/@fs' + api.engine.directory + '/database.json',
      '/server/demo-manifest.json',
      '/server/private/database.json',
      '/server/standard-bank.ts',
      '/sah_sah_four_new_game_modes_assets_and_prompt.zip',
    ])
      assert.equal((await fetch(base + file)).status, 404)
  } finally {
    api.close()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
