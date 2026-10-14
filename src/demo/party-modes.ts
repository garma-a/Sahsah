import type { DemoMode, Question, Session } from '../lib/game-types'
import type { PrivateSession } from '../lib/game-rules'

export const gameArtwork = (name: string) => `${import.meta.env.BASE_URL}game-modes/${name}.webp`

type Sample = {
  mode: DemoMode
  prompt: string
  answer: string
  image?: string
  crop?: 'eyes' | 'center' | 'lower'
  colorHex?: string
  audio?: string
  durationMs?: number
}
const person = (name: string, image: string, crop: Sample['crop'] = 'eyes'): Sample => ({
  mode: 'IMAGE_PERSON',
  prompt: 'مين المشهور اللي في الصورة؟',
  answer: name,
  image,
  crop,
})
const riddle = (answer: string, image: string): Sample => ({
  mode: 'IMAGE_RIDDLE',
  prompt: 'الرسمة دي بتقول إيه؟ خمن المثل المصري.',
  answer,
  image,
})
const color = (prompt: string, answer: string, image: string, colorHex: string): Sample => ({
  mode: 'IMAGE_COLOR',
  prompt,
  answer,
  image,
  colorHex,
})
const memory = (prompt: string, answer: string): Sample => ({
  mode: 'IMAGE_MEMORY',
  prompt,
  answer,
  image: 'memory',
})
const voice = (answer: string, audio: string, durationMs: number): Sample => ({
  mode: 'AUDIO_VOICE',
  prompt: 'مين الشخصية صاحبة الصوت؟',
  answer,
  audio,
  durationMs,
})

// Presentation content: replace one entry to change a round without rebuilding its UI.
export const PARTY_SAMPLES: Record<string, Sample[]> = {
  person: [
    person('محمد صلاح', 'person'),
    person('أم كلثوم', 'umm'),
    person('مستر بين — روان أتكينسون', 'bean', 'center'),
    person('عادل إمام', 'adel', 'center'),
    person('تشارلي تشابلن', 'chaplin', 'lower'),
    person('ألبرت أينشتاين', 'einstein', 'lower'),
  ],
  color: [
    color('القميص في الرسمة كان لونه إيه؟', 'أحمر', 'color', '#dc302b'),
    color('ياقة القميص كان لونها إيه؟', 'أسود', 'color', '#171a18'),
    color('أطراف أكمام القميص كان لونها إيه؟', 'أبيض', 'color', '#fffdf8'),
    color('القلم على الترابيزة كان لونه إيه؟', 'أصفر', 'memory', '#e9b42b'),
    color('البلي على الترابيزة كان لونه إيه؟', 'أزرق', 'memory', '#347dd2'),
    color('الكوباية على الترابيزة كان لونها إيه؟', 'أحمر', 'memory', '#dc302b'),
  ],
  riddle: [
    riddle('الباب اللي يجيلك منه الريح سده واستريح', 'riddle'),
    riddle('إيد واحدة متسقفش', 'riddle-hand'),
    riddle('القرد في عين أمه غزال', 'riddle-monkey'),
    riddle('عصفور في اليد ولا عشرة على الشجرة', 'riddle-bird'),
    riddle('اللي بيته من إزاز ميحدفش الناس بالطوب', 'riddle-glass'),
    riddle('على قد لحافك مد رجليك', 'riddle-blanket'),
  ],
  voice: [
    voice('المذيع — شخصية صح صح', 'voices/presenter.wav', 2240.5),
    voice('الكابتن — شخصية صح صح', 'voices/captain.wav', 1731),
    voice('الحكّاء — شخصية صح صح', 'voices/storyteller.wav', 2593),
    voice('الكابتن — شخصية صح صح', 'voices/captain.wav', 1731),
    voice('الحكّاء — شخصية صح صح', 'voices/storyteller.wav', 2593),
    voice('المذيع — شخصية صح صح', 'voices/presenter.wav', 2240.5),
  ],
  memory: [
    memory('كان فيه كام بلية على الترابيزة؟', '٣ بليات'),
    memory('الكوباية كانت لونها إيه؟', 'أحمر'),
    memory('إيه اللي كان على يمين الكراسة؟', 'قلم أصفر'),
    memory('النبتة اللي كانت في الصورة اسمها إيه؟', 'صبار'),
    memory('المفتاح كان في أنهي ركن؟', 'الركن اللي تحت على اليمين'),
    memory('الكراسة كانت مفتوحة ولا مقفولة؟', 'مفتوحة'),
  ],
}

export type MemoryLive = PrivateSession['live'][string] & {
  memoryEndsAt?: number
  memoryHidden?: boolean
}

export function presentPartySession(session: Session, privateSession?: PrivateSession): Session {
  return {
    ...session,
    questions: session.questions.map((q): Question => {
      const sample = PARTY_SAMPLES[q.categoryId]?.[q.row]
      if (!sample) return q
      const answer = q.answer && {
        ...q.answer,
        ...(sample.image ? { imageUrl: gameArtwork(sample.image) } : {}),
      }
      if (sample.mode === 'AUDIO_VOICE' && q.type === 'AUDIO_GUESS')
        return { ...q, type: 'AUDIO_VOICE', answer }
      const imageUrl = gameArtwork(sample.image!)
      if (sample.mode === 'IMAGE_MEMORY') {
        const live = privateSession?.live[q.id] as MemoryLive | undefined
        const memoryPhase = live?.memoryEndsAt
          ? live.memoryHidden || Date.now() >= live.memoryEndsAt
            ? 'recall'
            : 'viewing'
          : 'ready'
        return {
          ...q,
          type: 'IMAGE_MEMORY',
          imageUrl,
          answer,
          prompt:
            memoryPhase === 'recall' || answer
              ? q.prompt
              : 'احفظ تفاصيل الصورة… السؤال بعد ما تختفي!',
          memoryPhase,
          memorySeconds: q.points === 600 ? 5 : q.points === 400 ? 7 : 10,
          memoryEndsAt: live?.memoryEndsAt,
        }
      }
      if (
        sample.mode === 'IMAGE_PERSON' ||
        sample.mode === 'IMAGE_COLOR' ||
        sample.mode === 'IMAGE_RIDDLE'
      )
        return {
          ...q,
          type: sample.mode,
          imageUrl,
          answer,
          crop: sample.crop,
          colorHex: sample.colorHex,
        }
      return q
    }),
  }
}
