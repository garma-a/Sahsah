import type { DemoMode, Question, Session } from '../lib/game-types'
import type { PrivateSession } from '../lib/game-rules'

export const gameArtwork = (name: string) => `${import.meta.env.BASE_URL}game-modes/${name}.webp`

type Sample = {
  mode: DemoMode
  prompt: string
  answer: string
  promptEn?: string
  answerEn?: string
  /** One short hint/joke line under a sound clip. */
  hint?: string
  hintEn?: string
  image?: string
  crop?: 'eyes' | 'center' | 'lower'
  colorHex?: string
  audio?: string
  durationMs?: number
}
const person = (
  name: string,
  nameEn: string,
  image: string,
  crop: Sample['crop'] = 'eyes',
): Sample => ({
  mode: 'IMAGE_PERSON',
  prompt: 'مين المشهور اللي في الصورة؟',
  promptEn: 'Meen el mashhoor elly fel soora?',
  answer: name,
  answerEn: nameEn,
  image,
  crop,
})
const riddle = (answer: string, answerEn: string, image: string): Sample => ({
  mode: 'IMAGE_RIDDLE',
  prompt: 'الرسمة دي بتقول إيه؟ خمن المثل المصري.',
  promptEn: 'El rasma di bet2ool eh? Khamen el masal el masry.',
  answer,
  answerEn,
  image,
})
const color = (
  prompt: string,
  promptEn: string,
  answer: string,
  answerEn: string,
  image: string,
  colorHex: string,
): Sample => ({
  mode: 'IMAGE_COLOR',
  prompt,
  promptEn,
  answer,
  answerEn,
  image,
  colorHex,
})
const memory = (prompt: string, promptEn: string, answer: string, answerEn: string): Sample => ({
  mode: 'IMAGE_MEMORY',
  prompt,
  promptEn,
  answer,
  answerEn,
  image: 'memory',
})
const voice = (
  answer: string,
  answerEn: string,
  audio: string,
  durationMs: number,
  hint: string,
  hintEn: string,
): Sample => ({
  mode: 'AUDIO_VOICE',
  prompt: 'مين الشخصية صاحبة الصوت؟',
  promptEn: 'Meen el shakhseya sa7bet el soot?',
  answer,
  answerEn,
  hint,
  hintEn,
  audio,
  durationMs,
})

// Presentation content: replace one entry to change a round without rebuilding its UI.
export const PARTY_SAMPLES: Record<string, Sample[]> = {
  person: [
    person('محمد صلاح', 'Mohamed Salah', 'person'),
    person('أم كلثوم', 'Om Kalthoum', 'umm'),
    person('مستر بين — روان أتكينسون', 'Mr. Bean — Rowan Atkinson', 'bean', 'center'),
    person('عادل إمام', 'Adel Emam', 'adel', 'center'),
    person('تشارلي تشابلن', 'Charlie Chaplin', 'chaplin', 'lower'),
    person('ألبرت أينشتاين', 'Albert Einstein', 'einstein', 'lower'),
  ],
  color: [
    color('القميص في الرسمة كان لونه إيه؟', 'El 2amees fel rasma kan loono eh?', 'أحمر', 'A7mar', 'color', '#dc302b'),
    color('ياقة القميص كان لونها إيه؟', 'Ya2et el 2amees kan loonha eh?', 'أسود', 'Eswed', 'color', '#171a18'),
    color('أطراف أكمام القميص كان لونها إيه؟', 'Atraf akmam el 2amees kan loonha eh?', 'أبيض', 'Abyad', 'color', '#fffdf8'),
    color('القلم على الترابيزة كان لونه إيه؟', 'El 2alam 3al tarabeeza kan loono eh?', 'أصفر', 'Asfar', 'memory', '#e9b42b'),
    color('البلي على الترابيزة كان لونه إيه؟', 'El bely 3al tarabeeza kan loono eh?', 'أزرق', 'Azra2', 'memory', '#347dd2'),
    color('الكوباية على الترابيزة كان لونها إيه؟', 'El kobbaya 3al tarabeeza kan loonha eh?', 'أحمر', 'A7mar', 'memory', '#dc302b'),
  ],
  riddle: [
    riddle('الباب اللي يجيلك منه الريح سده واستريح', 'El bab elly ygeelak meno el ree7 seddo w estree7', 'riddle'),
    riddle('إيد واحدة متسقفش', 'Eed wa7da mat2sa2afsh', 'riddle-hand'),
    riddle('القرد في عين أمه غزال', 'El 2erd fe 3een omo ghazal', 'riddle-monkey'),
    riddle('عصفور في اليد ولا عشرة على الشجرة', '3asfoor fel eed wala 3ashara 3al shagara', 'riddle-bird'),
    riddle('اللي بيته من إزاز ميحدفش الناس بالطوب', 'Elly beito men ezaz may7defsh el nas bel toob', 'riddle-glass'),
    riddle('على قد لحافك مد رجليك', '3ala 2ad le7afak med reglek', 'riddle-blanket'),
  ],
  voice: [
    voice('المذيع — شخصية صح صح', 'El Mozee3 — shakhseyet Sa7Sa7', 'voices/presenter.wav', 2240.5, 'صوت بتسمعه كل يوم الصبح… بس مش في الراديو', 'Soot betesma3o kol yom el sob7… bas mesh fel radio'),
    voice('الكابتن — شخصية صح صح', 'El Captain — shakhseyet Sa7Sa7', 'voices/captain.wav', 1731, 'صاحب الصوت ده عمره ما ضيّع ماتش', 'Sa7b el soot da 3omro ma daya3 match'),
    voice('الحكّاء — شخصية صح صح', 'El 7akkaa2 — shakhseyet Sa7Sa7', 'voices/storyteller.wav', 2593, 'كان يا ما كان… كمّل انت', 'Kan ya ma kan… kammel enta'),
    voice('الكابتن — شخصية صح صح', 'El Captain — shakhseyet Sa7Sa7', 'voices/captain.wav', 1731, 'الصفارة في إيده من زمان', 'El saffara fe eedo men zaman'),
    voice('الحكّاء — شخصية صح صح', 'El 7akkaa2 — shakhseyet Sa7Sa7', 'voices/storyteller.wav', 2593, 'الصوت ده بيحب القعدة والشاي', 'El soot da bey7eb el 2a3da wel shay'),
    voice('المذيع — شخصية صح صح', 'El Mozee3 — shakhseyet Sa7Sa7', 'voices/presenter.wav', 2240.5, 'سيداتي آنساتي سادتي…', 'Sayedaty anesaty sadaty…'),
  ],
  memory: [
    memory('كان فيه كام بلية على الترابيزة؟', 'Kan feeh kam bilya 3al tarabeeza?', '٣ بليات', '3 bilyat'),
    memory('الكوباية كانت لونها إيه؟', 'El kobbaya kanet loonha eh?', 'أحمر', 'A7mar'),
    memory('إيه اللي كان على يمين الكراسة؟', 'Eh elly kan 3ala yemeen el korrasa?', 'قلم أصفر', '2alam asfar'),
    memory('النبتة اللي كانت في الصورة اسمها إيه؟', 'El nabta elly kanet fel soora esmaha eh?', 'صبار', 'Sabbar'),
    memory('المفتاح كان في أنهي ركن؟', 'El moftah kan fe anhy rokn?', 'الركن اللي تحت على اليمين', 'El rokn elly ta7t 3al yemeen'),
    memory('الكراسة كانت مفتوحة ولا مقفولة؟', 'El korrasa kanet maftoo7a wala ma2foola?', 'مفتوحة', 'Maftoo7a'),
  ],
}

// "Rakez M3aya" is host-controlled: show the picture, hide it to ask, and go back to it at will.
export type MemoryLive = PrivateSession['live'][string] & {
  memoryShown?: boolean
  memoryHidden?: boolean
  /** Once asked, the question stays visible even when the host goes back to the picture. */
  memoryAsked?: boolean
}

export function presentPartySession(session: Session, privateSession?: PrivateSession): Session {
  return {
    ...session,
    questions: session.questions.map((q): Question => {
      const sample = PARTY_SAMPLES[q.categoryId]?.[q.row]
      if (!sample) return q
      const answer = q.answer && {
        ...q.answer,
        ...(sample.answerEn ? { textEn: sample.answerEn } : {}),
        ...(sample.image ? { imageUrl: gameArtwork(sample.image) } : {}),
      }
      const text = {
        ...(sample.promptEn ? { promptEn: sample.promptEn } : {}),
        ...(sample.hint ? { hint: sample.hint, hintEn: sample.hintEn } : {}),
      }
      if (sample.mode === 'AUDIO_VOICE' && q.type === 'AUDIO_GUESS')
        return { ...q, ...text, type: 'AUDIO_VOICE', answer }
      const imageUrl = gameArtwork(sample.image!)
      if (sample.mode === 'IMAGE_MEMORY') {
        const live = privateSession?.live[q.id] as MemoryLive | undefined
        const memoryPhase = !live?.memoryShown ? 'ready' : live.memoryHidden ? 'recall' : 'viewing'
        // The question stays hidden until the picture has been memorised once.
        const asked = !!live?.memoryAsked || !!answer
        return {
          ...q,
          ...text,
          type: 'IMAGE_MEMORY',
          imageUrl,
          answer,
          prompt: asked ? q.prompt : 'احفظ تفاصيل الصورة… السؤال بعد ما تختفي!',
          promptEn: asked ? sample.promptEn : 'E7faz tafaseel el soora… el so2al ba3d ma te5tefy!',
          memoryPhase,
          memoryAsked: asked,
          memorySeconds: 0,
        }
      }
      if (
        sample.mode === 'IMAGE_PERSON' ||
        sample.mode === 'IMAGE_COLOR' ||
        sample.mode === 'IMAGE_RIDDLE'
      )
        return {
          ...q,
          ...text,
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
