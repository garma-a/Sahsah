import { CATEGORIES } from './data.ts'
const randomUUID = () => crypto.randomUUID()
import {
  QUESTION_MS,
  defaultPointStages,
  type AdminQuestion,
  type Session,
  type Question,
  type TeamId,
} from './game-types.ts'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export function check(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(status, message)
}
export const clean = (value: unknown, max = 300) =>
  String(value ?? '')
    .replace(/[\x00-\x1f<>]/g, '')
    .trim()
    .slice(0, max)
const timer = () => ({
  durationMs: QUESTION_MS,
  remainingMs: QUESTION_MS,
  status: 'idle' as const,
})
const POINTS = [200, 200, 400, 400, 600, 600]
type Live = {
  stageIndex: number
  availablePoints: number
  audioPlaysUsed: number
  audioIsPlaying: boolean
  audioStartedAt?: number
  audioDevice?: string
  reservation?: { id: string; device: string; until: number }
  lastAudioRequest?: string
  awarded: boolean
  awardedTo?: TeamId | null
  awardedPoints?: number
  revealed: boolean
}
export type PrivateSession = Omit<Session, 'questions'> & {
  hostToken: string
  records: AdminQuestion[]
  live: Record<string, Live>
}
export type GameDatabase = {
  schemaVersion: number
  questions: AdminQuestion[]
  sessions: Record<string, PrivateSession>
}

export function validateQuestion(input: unknown, previous?: AdminQuestion): AdminQuestion {
  const data = input as AdminQuestion
  check(data && typeof data === 'object', 'بيانات السؤال مش صحيحة')
  check(
    ['STANDARD', 'IMAGE_BLUR', 'IMAGE_ZOOM', 'AUDIO_GUESS', 'AUDIO_REVERSE'].includes(data.type),
    'اختار نوع السؤال',
  )
  check(
    CATEGORIES.some((category) => category.id === data.categoryId),
    'اختار فئة صحيحة',
  )
  check(Number.isInteger(data.row) && data.row >= 0 && data.row < 6, 'اختار مكان السؤال في اللوحة')
  check(['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(data.status), 'حالة السؤال مش صحيحة')
  const points = POINTS[data.row]
  const pointStages = data.pointStages ?? defaultPointStages(points)
  check(
    Array.isArray(pointStages) &&
      pointStages.length === 3 &&
      pointStages[0] === points &&
      pointStages.every(
        (p, i) => Number.isInteger(p) && p > 0 && (i === 0 || p < pointStages[i - 1]),
      ),
    'النقط لازم تقل في كل مرحلة وتبدأ بقيمة الخانة',
  )
  const focalX = Number(data.focalX ?? 0.5),
    focalY = Number(data.focalY ?? 0.5)
  check(
    [focalX, focalY].every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
    'نقطة التركيز من ٠ إلى ١',
  )
  const blurSigmas = data.blurSigmas ?? [32, 16, 6],
    zoomFactors = data.zoomFactors ?? [8, 4, 2]
  check(
    Array.isArray(blurSigmas) &&
      blurSigmas.length === 3 &&
      blurSigmas.every(
        (v, i) => Number.isFinite(v) && v >= 0.3 && v <= 100 && (!i || v < blurSigmas[i - 1]),
      ),
    'درجات التشويش لازم تقل',
  )
  check(
    Array.isArray(zoomFactors) &&
      zoomFactors.length === 3 &&
      zoomFactors.every(
        (v, i) => Number.isFinite(v) && v >= 1 && v <= 20 && (!i || v < zoomFactors[i - 1]),
      ),
    'درجات التكبير لازم تقل',
  )
  const maxPlays = Number(data.maxPlays ?? 3)
  check(Number.isInteger(maxPlays) && maxPlays >= 1 && maxPlays <= 10, 'مرات التشغيل من ١ إلى ١٠')
  const q: AdminQuestion = {
    id: previous?.id ?? randomUUID(),
    type: data.type,
    categoryId: data.categoryId,
    row: data.row,
    points,
    prompt: clean(data.prompt),
    answerText: clean(data.answerText),
    ...(clean(data.promptEn) ? { promptEn: clean(data.promptEn) } : {}),
    ...(clean(data.answerTextEn) ? { answerTextEn: clean(data.answerTextEn) } : {}),
    alternatives: (Array.isArray(data.alternatives) ? data.alternatives : [])
      .map((v) => clean(v))
      .filter(Boolean)
      .slice(0, 10),
    status: data.status,
    packageId: clean(data.packageId, 60),
    notes: clean(data.notes, 1500),
    pointStages,
    focalX,
    focalY,
    blurSigmas,
    zoomFactors,
    maxPlays,
    allowForward: !!data.allowForward,
    // Media IDs can only originate in the upload pipeline, never in user JSON.
    stages:
      data.type.startsWith('IMAGE_') && previous?.type.startsWith('IMAGE_') ? previous.stages : [],
    originalImage:
      data.type.startsWith('IMAGE_') && previous?.type.startsWith('IMAGE_')
        ? previous.originalImage
        : undefined,
    playableAudio: previous?.type === data.type ? previous.playableAudio : undefined,
    forwardSpeech:
      data.type === 'AUDIO_REVERSE' && previous?.type === data.type
        ? previous.forwardSpeech
        : undefined,
    durationMs: previous?.type === data.type ? previous.durationMs : undefined,
  }
  check(q.prompt, 'اكتب نص السؤال')
  if (q.status === 'PUBLISHED') {
    check(q.answerText, 'اكتب الإجابة قبل النشر')
    if (q.type.startsWith('IMAGE_'))
      check(q.stages.length === 3 && q.originalImage, 'ارفع الصورة وولّد المراحل قبل النشر')
    if (q.type.startsWith('AUDIO_')) check(q.playableAudio, 'ارفع الصوت قبل النشر')
    if (q.type === 'AUDIO_REVERSE') check(q.forwardSpeech, 'ارفع الكلام الأصلي وولّد المعكوس')
  }
  return q
}

export type GameRulesOptions = {
  bank: Record<string, [string, string][]>
  load: () => GameDatabase | undefined
  save: (data: GameDatabase) => void
  compareSecrets?: (a: string, b: string) => boolean
  code?: () => string
  mediaUrl?: (id: string, sessionId: string) => string
}

export class GameRules {
  db: GameDatabase
  onChange: (session: Session) => void = () => {}
  private options: GameRulesOptions
  constructor(options: GameRulesOptions, seed: AdminQuestion[] = []) {
    this.options = options
    const saved = options.load()
    this.db = saved ?? { schemaVersion: 1, questions: seed, sessions: {} }
    if (!saved) this.persist()
  }
  persist() {
    this.options.save(this.db)
  }
  get(id: string) {
    const s = this.db.sessions[id]
    check(s, 'اللعبة مش موجودة', 404)
    return s
  }
  public(s: PrivateSession): Session {
    const url = (media: string) =>
      this.options.mediaUrl?.(media, s.id) ?? `/api/sessions/${s.id}/media/${media}`
    const questions = s.records.map((q) => {
      const l = s.live[q.id]
      const common = {
        id: q.id,
        categoryId: q.categoryId,
        row: q.row,
        points: q.points,
        prompt: q.prompt,
        ...(q.promptEn ? { promptEn: q.promptEn } : {}),
        state: l.awarded ? ('answered' as const) : ('available' as const),
        ...(l.awarded ? { wonBy: l.awardedTo ?? null, wonPoints: l.awardedPoints ?? 0 } : {}),
        stageIndex: l.stageIndex,
        availablePoints: l.availablePoints,
        audioPlaysUsed: l.audioPlaysUsed,
        audioIsPlaying: l.audioIsPlaying,
        audioStartedAt: l.audioStartedAt,
        audioDurationMs: q.durationMs,
        ...(l.revealed
          ? {
              answer: {
                text: q.answerText,
                ...(q.answerTextEn ? { textEn: q.answerTextEn } : {}),
                ...(q.originalImage && q.type.startsWith('IMAGE_')
                  ? { imageUrl: url(q.originalImage) }
                  : {}),
                ...(q.type === 'AUDIO_REVERSE' && q.allowForward && q.forwardSpeech
                  ? { forwardAudioUrl: url(q.forwardSpeech) }
                  : {}),
              },
            }
          : {}),
      }
      if (q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM')
        return {
          ...common,
          type: q.type,
          imageUrl: url(q.stages[l.stageIndex]),
          pointStages: q.pointStages,
        }
      if (q.type === 'AUDIO_GUESS' || q.type === 'AUDIO_REVERSE')
        return {
          ...common,
          type: q.type,
          audioUrl: url(q.playableAudio!),
          maxPlays: q.maxPlays,
        }
      return { ...common, type: 'STANDARD' as const }
    }) as Question[]
    const { hostToken: _host, records: _records, live: _live, ...safe } = s
    return { ...safe, questions }
  }
  touch(s: PrivateSession) {
    s.version++
    this.persist()
    const dto = this.public(s)
    this.onChange(dto)
    return dto
  }
  reset(s: PrivateSession) {
    s.live = Object.fromEntries(
      s.records.map((q) => [
        q.id,
        {
          stageIndex: 0,
          availablePoints: q.points,
          audioPlaysUsed: 0,
          audioIsPlaying: false,
          awarded: false,
          revealed: false,
        },
      ]),
    )
  }
  board(categoryIds: string[]) {
    check(
      Array.isArray(categoryIds) &&
        categoryIds.length === 6 &&
        new Set(categoryIds).size === 6 &&
        categoryIds.every((id) => Object.prototype.hasOwnProperty.call(this.options.bank, id)),
      'اختار ٦ فئات مختلفة',
    )
    return categoryIds.flatMap((id) =>
      POINTS.map((_, row) => {
        const q = this.db.questions.find(
          (q) => q.categoryId === id && q.row === row && q.status === 'PUBLISHED',
        )
        if (q) return structuredClone(q)
        const [prompt, answerText] = this.options.bank[id][row]
        return validateQuestion({
          type: 'STANDARD',
          categoryId: id,
          row,
          prompt,
          answerText,
          status: 'PUBLISHED',
        })
      }),
    )
  }
  create(categoryIds: string[], names: string[]) {
    check(Array.isArray(names), 'اسم الفريق مش صحيح')
    const records = this.board(categoryIds)
    let code: string
    do {
      code =
        this.options.code?.() ??
        String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000))
    } while (Object.values(this.db.sessions).some((s) => s.code === code && s.phase !== 'finished'))
    const s: PrivateSession = {
      id: randomUUID(),
      code,
      hostToken: randomUUID(),
      phase: 'lobby',
      teams: [
        { id: 'A', name: clean(names[0], 24) || 'الفراعنة', score: 0 },
        { id: 'B', name: clean(names[1], 24) || 'الجدعان', score: 0 },
      ],
      categoryIds,
      records,
      live: {},
      answerRevealed: false,
      timer: timer(),
      guests: [],
      version: 1,
    }
    this.reset(s)
    this.db.sessions[s.id] = s
    this.persist()
    return { session: this.public(s), hostToken: s.hostToken }
  }
  host(s: PrivateSession, token: string) {
    check(
      (this.options.compareSecrets ?? ((a, b) => a === b))(token, s.hostToken),
      'المضيف بس يقدر يعمل الخطوة دي',
      403,
    )
  }
  importLegacy(data: Record<string, any>) {
    check(
      data && Array.isArray(data.teams) && data.teams.length === 2 && Array.isArray(data.questions),
      'اللعبة القديمة مش صالحة',
    )
    const result = this.create(
      data.categoryIds,
      data.teams.map((t: { name?: string }) => clean(t.name, 24)),
    )
    const s = this.get(result.session.id)
    // A legacy game keeps its standard content and positions. Never trust
    // answer strings or media URLs copied from browser storage.
    s.records = data.categoryIds.flatMap((categoryId: string) =>
      this.options.bank[categoryId].map(([prompt, answerText], row) =>
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
    this.reset(s)
    for (const q of s.records) {
      const old = data.questions.find(
        (old: { categoryId?: string; row?: number }) =>
          old.categoryId === q.categoryId && old.row === q.row,
      )
      if (old?.state === 'answered') s.live[q.id].awarded = true
      if (old?.id === data.activeQuestionId && !s.live[q.id].awarded) s.activeQuestionId = q.id
    }
    s.teams.forEach((team, index) => {
      team.score = Number.isFinite(data.teams[index].score)
        ? Math.max(0, Math.min(1000000, Math.round(data.teams[index].score)))
        : 0
    })
    s.phase = ['lobby', 'board', 'question', 'answer', 'finished'].includes(data.phase)
      ? data.phase
      : 'board'
    if (['question', 'answer'].includes(s.phase) && !s.activeQuestionId) s.phase = 'board'
    if (s.phase === 'answer' && s.activeQuestionId) {
      s.live[s.activeQuestionId].revealed = true
      s.answerRevealed = true
    }
    if (s.activeQuestionId && data.timer) {
      const remaining = Number.isFinite(data.timer.remainingMs)
        ? Math.max(0, Math.min(QUESTION_MS, data.timer.remainingMs))
        : QUESTION_MS
      const running = data.timer.status === 'running' && Number.isFinite(data.timer.startedAt)
      const live = running
        ? Math.max(0, remaining - Math.max(0, Date.now() - data.timer.startedAt))
        : remaining
      s.timer = {
        durationMs: QUESTION_MS,
        remainingMs: live,
        status: live === 0 ? 'expired' : running && s.phase === 'question' ? 'running' : 'paused',
        ...(running && s.phase === 'question' ? { startedAt: Date.now() } : {}),
      }
      if (data.timer.status === 'idle') s.timer.status = 'idle'
    }
    if (
      /^\d{4}$/.test(String(data.code)) &&
      !Object.values(this.db.sessions).some(
        (other) => other.id !== s.id && other.code === data.code && other.phase !== 'finished',
      )
    )
      s.code = data.code
    s.guests = (Array.isArray(data.guests) ? data.guests : [])
      .slice(0, 100)
      .filter((guest: { team?: string }) => ['A', 'B'].includes(guest.team || ''))
      .map((guest: { name?: string; team: TeamId }) => ({
        name: clean(guest.name, 24) || 'ضيف',
        team: guest.team,
      }))
    return { session: this.touch(s), hostToken: s.hostToken }
  }
  reconcile(s: PrivateSession, now = Date.now()) {
    let changed = false
    for (const [id, l] of Object.entries(s.live)) {
      if (l.reservation && l.reservation.until < now) {
        delete l.reservation
        changed = true
      }
      if (
        l.audioIsPlaying &&
        now >=
          (l.audioStartedAt ?? 0) + (s.records.find((q) => q.id === id)?.durationMs ?? 30000) + 1000
      ) {
        l.audioIsPlaying = false
        changed = true
      }
    }
    if (s.timer.status === 'running' && now >= (s.timer.startedAt ?? now) + s.timer.remainingMs) {
      s.timer = {
        ...s.timer,
        remainingMs: 0,
        status: 'expired',
        startedAt: undefined,
      }
      changed = true
    }
    if (changed) this.touch(s)
  }
  action(id: string, token: string, data: Record<string, any>) {
    const s = this.get(id)
    this.host(s, token)
    this.reconcile(s)
    const q = s.records.find((q) => q.id === s.activeQuestionId),
      l = q ? s.live[q.id] : undefined
    // Duplicate award returns the authoritative result even if its revision is old.
    if (data.type === 'award' && s.live[data.questionId]?.awarded) return this.public(s)
    check(data.version === s.version, 'الحالة اتحدثت، جرّب تاني', 409)
    switch (data.type) {
      case 'rename':
        check(s.phase === 'lobby' && [0, 1].includes(data.idx), 'الاسم يتغير قبل البداية')
        s.teams[data.idx as 0 | 1].name = clean(data.name, 24)
        break
      case 'startGame':
        check(s.phase === 'lobby' && s.teams.every((t) => t.name), 'سمّي الفريقين')
        s.phase = 'board'
        break
      case 'openQuestion': {
        check(s.phase === 'board', 'ارجع للوحة الأول')
        const next = s.records.find((q) => q.id === data.id)
        check(next && !s.live[next.id].awarded, 'السؤال اتلعب')
        s.activeQuestionId = next.id
        s.phase = s.live[next.id].revealed ? 'answer' : 'question'
        s.answerRevealed = s.live[next.id].revealed
        s.timer = timer()
        break
      }
      case 'timer': {
        check(s.phase === 'question', 'السؤال مش مفتوح')
        const t = s.timer,
          now = Date.now()
        const remaining =
          t.status === 'running'
            ? Math.max(0, t.remainingMs - (now - (t.startedAt ?? now)))
            : t.remainingMs
        if (data.op === 'start') {
          check(t.status !== 'running', 'الوقت شغّال')
          s.timer = {
            ...t,
            remainingMs: remaining || t.durationMs,
            startedAt: now,
            status: 'running',
          }
        } else if (data.op === 'pause')
          s.timer = {
            ...t,
            remainingMs: remaining,
            startedAt: undefined,
            status: 'paused',
          }
        else if (data.op === 'reset') s.timer = timer()
        else if (data.op === 'expire') {
          check(remaining === 0, 'الوقت لسه مخلصش')
          s.timer = {
            ...t,
            remainingMs: 0,
            status: 'expired',
            startedAt: undefined,
          }
        } else throw new ApiError(400, 'خطوة الوقت مش صحيحة')
        break
      }
      case 'advanceStage':
        check(
          q &&
            l &&
            s.phase === 'question' &&
            q.type.startsWith('IMAGE_') &&
            l.stageIndex < q.pointStages.length - 1,
          'مفيش توضيح تاني',
        )
        l.stageIndex++
        l.availablePoints = q.pointStages[l.stageIndex]
        break
      case 'reveal': {
        check(q && l && s.phase === 'question', 'السؤال مش مفتوح')
        l.revealed = true
        l.audioIsPlaying = false
        delete l.reservation
        const t = s.timer
        s.timer = {
          ...t,
          remainingMs:
            t.status === 'running'
              ? Math.max(0, t.remainingMs - (Date.now() - (t.startedAt ?? Date.now())))
              : t.remainingMs,
          status: t.status === 'running' ? 'paused' : t.status,
          startedAt: undefined,
        }
        s.phase = 'answer'
        s.answerRevealed = true
        break
      }
      case 'award': {
        check(
          q && l && s.phase === 'answer' && q.id === data.questionId && l.revealed && !l.awarded,
          'اظهر الإجابة الأول',
        )
        check(data.teamId === null || ['A', 'B'].includes(data.teamId), 'الفريق مش صحيح')
        // The host may pick the points manually (e.g. the other team answered on the first hint).
        const points = data.points === undefined ? l.availablePoints : data.points
        check(Number.isInteger(points) && points >= 0 && points <= q.points, 'النقط مش صحيحة')
        if (data.teamId) s.teams.find((t) => t.id === data.teamId)!.score += points
        l.awarded = true
        l.awardedTo = (data.teamId as TeamId | null) ?? null
        l.awardedPoints = data.teamId ? points : 0
        s.lastAward = {
          teamId: data.teamId as TeamId | null,
          points: data.teamId ? points : 0,
          at: Date.now(),
        }
        s.phase = Object.values(s.live).every((l) => l.awarded) ? 'finished' : 'board'
        s.activeQuestionId = undefined
        s.answerRevealed = false
        break
      }
      case 'adjust':
        check(
          ['A', 'B'].includes(data.teamId) &&
            Number.isInteger(data.delta) &&
            Math.abs(data.delta) <= 1000000,
          'تعديل النقط مش صحيح',
        )
        {
          const team = s.teams.find((t) => t.id === data.teamId)!
          team.score = Math.max(0, team.score + data.delta)
        }
        break
      case 'backToBoard':
        check(s.phase === 'question' && l && !l.audioIsPlaying, 'خلص الصوت الأول')
        delete l.reservation
        s.phase = 'board'
        s.activeQuestionId = undefined
        s.timer = timer()
        break
      case 'finish':
        check(!l?.audioIsPlaying, 'خلص الصوت الأول')
        s.phase = 'finished'
        if (l) delete l.reservation
        s.timer = timer()
        break
      case 'replay':
        check(s.phase === 'finished', 'خلص اللعبة الأول')
        s.records = this.board(s.categoryIds)
        this.reset(s)
        s.phase = 'board'
        s.teams.forEach((t) => (t.score = 0))
        s.activeQuestionId = undefined
        s.lastAward = undefined
        s.answerRevealed = false
        s.timer = timer()
        break
      default:
        throw new ApiError(400, 'الخطوة مش معروفة')
    }
    return this.touch(s)
  }
  reserveAudio(id: string, token: string, questionId: string, device: string, requestId: string) {
    const s = this.get(id)
    this.host(s, token)
    this.reconcile(s)
    const q = s.records.find((q) => q.id === questionId),
      l = s.live[questionId]
    check(
      q &&
        l &&
        s.activeQuestionId === questionId &&
        s.phase === 'question' &&
        q.type.startsWith('AUDIO_'),
      'سؤال الصوت مش مفتوح',
    )
    check(!l.audioDevice || l.audioDevice === device, 'الصوت من جهاز المضيف الرئيسي بس', 409)
    if (l.reservation?.id === requestId && l.reservation.device === device)
      return { reservationId: requestId }
    check(
      !l.audioIsPlaying && !l.reservation,
      'الصوت شغّال',
      409,
    )
    check(requestId && requestId !== l.lastAudioRequest && device, 'طلب التشغيل مكرر', 409)
    l.reservation = { id: requestId, device, until: Date.now() + 8000 }
    this.touch(s)
    return { reservationId: requestId }
  }
  acknowledgeAudio(
    id: string,
    token: string,
    questionId: string,
    device: string,
    requestId: string,
    op: string,
  ) {
    const s = this.get(id)
    this.host(s, token)
    const q = s.records.find((q) => q.id === questionId),
      l = s.live[questionId]
    check(q && l, 'السؤال مش موجود', 404)
    if (op === 'started' && l.lastAudioRequest === requestId && l.audioDevice === device)
      return this.public(s)
    if (op === 'ended') {
      check(l.lastAudioRequest === requestId && l.audioDevice === device, 'تشغيل مش صالح', 409)
      l.audioIsPlaying = false
      return this.touch(s)
    }
    check(
      l.reservation?.id === requestId && l.reservation.device === device,
      'طلب التشغيل انتهى',
      409,
    )
    if (op === 'cancel') {
      delete l.reservation
      return this.touch(s)
    }
    check(
      op === 'started' &&
        s.phase === 'question' &&
        s.activeQuestionId === questionId &&
        l.reservation.until >= Date.now(),
      'مش مسموح تشغيل الصوت',
      409,
    )
    l.audioDevice = device
    l.audioPlaysUsed++
    l.audioIsPlaying = true
    l.audioStartedAt = Date.now()
    l.lastAudioRequest = requestId
    delete l.reservation
    return this.touch(s)
  }
  saveQuestion(input: unknown, id?: string) {
    const previous = id ? this.db.questions.find((q) => q.id === id) : undefined
    if (id) check(previous, 'السؤال مش موجود', 404)
    const question = validateQuestion(input, previous)
    if (question.status === 'PUBLISHED')
      this.db.questions.forEach((q) => {
        if (
          q.id !== question.id &&
          q.categoryId === question.categoryId &&
          q.row === question.row &&
          q.status === 'PUBLISHED'
        )
          q.status = 'ARCHIVED'
      })
    if (previous) this.db.questions[this.db.questions.indexOf(previous)] = question
    else this.db.questions.push(question)
    this.persist()
    return question
  }
}
