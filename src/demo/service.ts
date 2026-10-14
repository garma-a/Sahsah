import { GameRules, clean, check, validateQuestion, type GameDatabase } from '../lib/game-rules'
import type { AdminQuestion, Session } from '../lib/game-types'
import { BANK } from './standard-bank'
import samples from './samples.json'
import { mediaUrl, warmMedia, uploadMedia, regenerateMedia } from './media'
import { PARTY_SAMPLES, presentPartySession, type MemoryLive } from './party-modes'

const KEY = 'sahsah.demo.database.v1'
const EVENT = 'sahsah-demo-session'
export { mediaUrl }
const DEMO_BANK = {
  ...BANK,
  ...Object.fromEntries(
    Object.entries(PARTY_SAMPLES).map(([id, rows]) => [
      id,
      rows.map((row): [string, string] => [row.prompt, row.answer]),
    ]),
  ),
}
function seed(): AdminQuestion[] {
  const questions = Object.entries(DEMO_BANK).flatMap(([categoryId, rows]) =>
    rows.map(([prompt, answerText], row) =>
      validateQuestion({
        categoryId,
        row,
        prompt,
        answerText,
        type: 'STANDARD',
        status: 'PUBLISHED',
      }),
    ),
  )
  for (const sample of samples) {
    const q = questions.find((q) => q.categoryId === sample.categoryId && q.row === sample.row)!
    Object.assign(q, {
      type: sample.type,
      prompt: sample.prompt,
      answerText: sample.answer,
      stages: sample.stages,
      originalImage: sample.originalImage ?? undefined,
      playableAudio: sample.playableAudio ?? undefined,
      forwardSpeech: sample.forwardSpeech ?? undefined,
      durationMs: 'durationMs' in sample ? sample.durationMs : undefined,
      allowForward: true,
      notes: 'محتوى تجريبي لعرض الفكرة على العميل.',
    })
  }
  for (const q of questions) {
    const sample = PARTY_SAMPLES[q.categoryId]?.[q.row]
    if (sample?.audio)
      Object.assign(q, {
        type: 'AUDIO_GUESS',
        playableAudio: sample.audio,
        durationMs: sample.durationMs,
        notes: 'صوت تمثيلي لشخصية خيالية في عرض صح صح.',
      })
  }
  return questions
}
const sampleQuestions = seed()
function load(): GameDatabase | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}
async function engine() {
  const saved = load()
  // Keep existing games and edits; seed only the newly added presentation slots.
  if (saved)
    for (const q of sampleQuestions) {
      if (!saved.questions.some((old) => old.categoryId === q.categoryId && old.row === q.row))
        saved.questions.push(q)
    }
  const records = [
    ...(saved?.questions ?? []),
    ...Object.values(saved?.sessions ?? {}).flatMap((s) => s.records),
  ]
  await warmMedia(
    records.flatMap((q) =>
      [...q.stages, q.originalImage, q.playableAudio, q.forwardSpeech].filter(
        (id): id is string => !!id,
      ),
    ),
  )
  const rules = new GameRules(
    {
      bank: DEMO_BANK,
      load: () => saved,
      save: (db) => localStorage.setItem(KEY, JSON.stringify(db)),
      mediaUrl: (id) => mediaUrl(id) || '',
    },
    sampleQuestions,
  )
  rules.onChange = (session) =>
    window.dispatchEvent(
      new CustomEvent(EVENT, {
        detail: presentPartySession(session, rules.db.sessions[session.id]),
      }),
    )
  return rules
}
async function execute(url: string, data: any, method: string, token: string) {
  const rules = await engine(),
    parts = url
      .split('?')[0]
      .replace(/^\/api\//, '')
      .split('/')
  if (parts[0] === 'health') return { ok: true, demo: true }
  if (parts[0] === 'admin') {
    if (parts[1] === 'auth') {
      if (method === 'DELETE') {
        sessionStorage.setItem('sahsah.demo.admin', 'out')
        return { ok: true }
      }
      if (method === 'POST') sessionStorage.removeItem('sahsah.demo.admin')
      return {
        authenticated: sessionStorage.getItem('sahsah.demo.admin') !== 'out',
        setupRequired: false,
      }
    }
    check(parts[1] === 'questions', 'مش موجود')
    if (!parts[2]) return method === 'GET' ? rules.db.questions : rules.saveQuestion(data)
    const q = rules.db.questions.find((q) => q.id === parts[2])
    check(q, 'السؤال مش موجود')
    if (method === 'PATCH') return rules.saveQuestion(data, q.id)
    if (parts[3] === 'media') Object.assign(q, await uploadMedia(q, data as Blob))
    else if (['generate-stages', 'generate-reverse'].includes(parts[3]))
      Object.assign(q, await regenerateMedia(q))
    else throw new Error('الخطوة مش موجودة')
    rules.persist()
    return q
  }
  if (parts[0] === 'rooms') {
    check(/^\d{4}$/.test(parts[1]), 'الكود مش صحيح')
    let s = Object.values(rules.db.sessions).find(
      (s) => s.code === parts[1] && s.phase !== 'finished',
    )
    // A phone opened by QR shows a guest preview. Only same-browser tabs sync.
    if (!s) {
      const preview = rules.create(
        ['cinema', 'music', 'football', 'general', 'ancient', 'travel'],
        ['الفراعنة', 'الجدعان'],
      )
      s = rules.get(preview.session.id)
      s.code = parts[1]
      s.phase = 'board'
      rules.touch(s)
    }
    return rules.public(s)
  }
  check(parts[0] === 'sessions', 'مش موجود')
  if (!parts[1]) return rules.create(data.categoryIds, data.names)
  if (parts[1] === 'import') return rules.importLegacy(data)
  const s = rules.get(parts[1])
  const beforeMemoryExpiry = s.version
  let expiredMemory = false
  for (const record of s.records) {
    if (PARTY_SAMPLES[record.categoryId]?.[record.row]?.mode !== 'IMAGE_MEMORY') continue
    const recordLive = s.live[record.id] as MemoryLive
    if (
      recordLive.memoryEndsAt &&
      !recordLive.memoryHidden &&
      Date.now() >= recordLive.memoryEndsAt
    ) {
      recordLive.memoryHidden = true
      expiredMemory = true
    }
  }
  if (expiredMemory) {
    rules.touch(s)
    // A viewing countdown may finish while this local click is being handled.
    if (parts[2] === 'actions' && data?.version === beforeMemoryExpiry)
      data = { ...data, version: s.version }
  }
  const current = s.activeQuestionId
    ? s.records.find((q) => q.id === s.activeQuestionId)
    : undefined
  const memory =
    current && PARTY_SAMPLES[current.categoryId]?.[current.row]?.mode === 'IMAGE_MEMORY'
  const live = current ? (s.live[current.id] as MemoryLive) : undefined
  rules.reconcile(s)
  if (!parts[2]) return rules.public(s)
  if (parts[2] === 'actions') {
    if (['startMemory', 'hideMemory', 'resetMemory'].includes(data.type)) {
      rules.host(s, token)
      check(s.phase === 'question' && memory && live && current, 'تحدي الذاكرة مش مفتوح')
      if (data.type === 'startMemory') {
        check(!live.memoryEndsAt, 'الصورة اتعرضت بالفعل')
        const seconds = current.points === 600 ? 5 : current.points === 400 ? 7 : 10
        live.memoryEndsAt = Date.now() + seconds * 1000
        live.memoryHidden = false
      } else if (data.type === 'hideMemory') {
        check(live.memoryEndsAt, 'اعرض الصورة الأول')
        live.memoryHidden = true
      } else {
        delete live.memoryEndsAt
        delete live.memoryHidden
        s.timer = { durationMs: 30000, remainingMs: 30000, status: 'idle' }
      }
      return rules.touch(s)
    }
    if (memory && ['reveal', 'timer'].includes(data.type))
      check(live?.memoryHidden, 'شوف الصورة الأول، وبعد ما تختفي جاوب السؤال')
    return rules.action(s.id, token, data)
  }
  if (parts[2] === 'join') {
    check(['A', 'B'].includes(data.team), 'اختار فريق')
    s.guests.push({ name: clean(data.name, 24) || 'ضيف', team: data.team })
    return rules.touch(s)
  }
  if (parts[2] === 'audio')
    return data.op === 'reserve'
      ? rules.reserveAudio(s.id, token, data.questionId, data.deviceId, data.requestId)
      : rules.acknowledgeAudio(s.id, token, data.questionId, data.deviceId, data.requestId, data.op)
  throw new Error('الخطوة مش موجودة')
}
export async function request<T>(
  url: string,
  data: unknown,
  method: string,
  token: string,
): Promise<T> {
  const task = async () => {
    const result = await execute(url, data, method, token)
    const db = load()
    if (result && 'questions' in result && 'teams' in result)
      return presentPartySession(result as Session, db?.sessions[(result as Session).id]) as T
    if (result && 'session' in result) {
      const room = result as { session: Session; hostToken: string }
      return {
        ...room,
        session: presentPartySession(room.session, db?.sessions[room.session.id]),
      } as T
    }
    return result as T
  }
  return navigator.locks ? navigator.locks.request('sahsah-demo', task) : task()
}
export function subscribe(
  id: string,
  receive: (session: Session) => void,
  connected: (ok: boolean) => void,
) {
  let active = true,
    version = -1
  const send = (s: Session) => {
    if (active && s.id === id && s.version > version) {
      version = s.version
      receive(s)
      connected(true)
    }
  }
  const on = (event: Event) => send((event as CustomEvent<Session>).detail)
  const refresh = () => {
    void request<Session>(`/api/sessions/${id}`, undefined, 'GET', '')
      .then(send)
      .catch(() => {
        if (active) connected(false)
      })
  }
  const storage = (event: StorageEvent) => {
    if (event.key === KEY) refresh()
  }
  window.addEventListener(EVENT, on)
  window.addEventListener('storage', storage)
  const tick = setInterval(refresh, 600)
  refresh()
  return () => {
    active = false
    clearInterval(tick)
    window.removeEventListener(EVENT, on)
    window.removeEventListener('storage', storage)
  }
}
