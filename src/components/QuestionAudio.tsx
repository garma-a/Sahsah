import { useEffect, useRef, useState } from 'react'
import { Play, Volume2, AudioLines } from 'lucide-react'
import { api } from '../lib/api'
import type { Question, Session } from '../lib/game-types'
import { useStore } from '../lib/store'
import { useLang } from '../lib/i18n'

type AudioQuestion = Extract<
  Question,
  {
    type: 'AUDIO_GUESS' | 'AUDIO_REVERSE' | 'AUDIO_VOICE'
  }
>
export default function QuestionAudio({
  question: q,
  sessionId,
  host,
  revealed,
}: {
  question: AudioQuestion
  sessionId: string
  host: boolean
  revealed: boolean
}) {
  const { adoptSession, dispatch, connected } = useStore()
  const { t } = useLang()
  const player = useRef<HTMLAudioElement>(null)
  const requestId = useRef('')
  const inFlight = useRef(false)
  const acknowledgment = useRef<Promise<Session> | null>(null)
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const device = useRef(sessionStorage.getItem('sahsah.audio-device') || crypto.randomUUID())
  useEffect(() => {
    sessionStorage.setItem('sahsah.audio-device', device.current)
  }, [])
  useEffect(() => {
    if (revealed) {
      player.current?.pause()
      inFlight.current = false
      setPending(false)
    }
    return () => {
      player.current?.pause()
    }
  }, [revealed, q.id])
  useEffect(() => {
    if (!q.audioIsPlaying) {
      if (!inFlight.current) setProgress(0)
      return
    }
    const update = () =>
      setProgress(
        Math.min(1, (Date.now() - (q.audioStartedAt || Date.now())) / (q.audioDurationMs || 30000)),
      )
    update()
    const handle = setInterval(update, 80)
    return () => clearInterval(handle)
  }, [q.audioIsPlaying, q.audioStartedAt, q.audioDurationMs])

  const send = (op: string, id = requestId.current) =>
    api<Session>(`/api/sessions/${sessionId}/audio`, {
      op,
      questionId: q.id,
      deviceId: device.current,
      requestId: id,
    })
  const play = async () => {
    // Replays are unlimited: the clip can be played as many times as the room needs.
    if (inFlight.current || q.audioIsPlaying || !host || !connected) return
    inFlight.current = true
    setPending(true)
    setError('')
    const id = crypto.randomUUID()
    requestId.current = id
    let reserved = false
    try {
      await api(`/api/sessions/${sessionId}/audio`, {
        op: 'reserve',
        questionId: q.id,
        deviceId: device.current,
        requestId: id,
      })
      reserved = true
      const audio = player.current
      if (!audio || revealed) throw new Error(t('الصوت مش جاهز', 'El soot mesh gahez'))
      audio.currentTime = 0
      await audio.play()
      // play() resolves only after the browser accepts playback. The server
      // acknowledgment is idempotent, so a retry cannot consume a second play.
      acknowledgment.current = send('started', id).catch(() => send('started', id))
      const session = await acknowledgment.current
      adoptSession(session)
    } catch (err) {
      player.current?.pause()
      if (reserved) await send('cancel', id).catch(() => {})
      setError(
        err instanceof DOMException
          ? t('الصوت مش اشتغل، جرّب تاني', 'El soot mashtaghalsh, garrab tany')
          : err instanceof TypeError
            ? t('الاتصال اتقطع، جرّب تاني', 'El etesal et2ata3, garrab tany')
            : err instanceof Error
              ? err.message
              : t('الصوت مش اشتغل، جرّب تاني', 'El soot mashtaghalsh, garrab tany'),
      )
      inFlight.current = false
    } finally {
      setPending(false)
    }
  }
  const end = async () => {
    if (requestId.current) {
      try {
        // Short clips can end while their start acknowledgment is in transit.
        await acknowledgment.current
        adoptSession(await send('ended'))
      } catch {
        await dispatch({
          type: 'toast',
          text: t('اتصال الصوت اتقطع؛ الحالة هتتحدث تلقائيًا', 'Etesal el soot et2ata3; hayet7adas lewa7do'),
        })
      }
    }
    acknowledgment.current = null
    inFlight.current = false
    setPending(false)
    setProgress(0)
  }
  const hint = q.hint
    ? t(q.hint, q.hintEn || q.hint)
    : t('ركّز في النبرة… مش بس في الكلام', 'Rakez fel nabra… mesh bas fel kalam')
  const isPlaying = q.audioIsPlaying || (inFlight.current && !pending)
  return (
    <div className="glass flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-[24px] p-4 text-ivory sm:p-8">
      <div
        className="mb-4 flex h-12 w-full max-w-[325px] items-center justify-between gap-[3px] text-gold sm:mb-8 sm:h-24 sm:gap-[5px] short:mb-2 short:h-10"
        aria-hidden="true"
      >
        {Array.from({ length: 33 }, (_, i) => (
          <span
            key={i}
            className={`w-[4px] rounded-full bg-current sm:w-[5px] ${isPlaying ? 'audio-bar' : ''}`}
            style={{
              height: `${18 + Math.abs(Math.sin(i * 1.7) * Math.sin(i * 0.37)) * 80}%`,
              animationDelay: `${i * 31}ms`,
              opacity: 0.55 + 0.45 * (1 - Math.abs(i - 16) / 16),
            }}
          />
        ))}
      </div>
      {revealed ? (
        <div className="rounded-full bg-gold/15 p-5 text-gold">
          <AudioLines size={36} />
        </div>
      ) : (
        <button
          aria-label={isPlaying ? t('الصوت شغّال', 'El soot shaghal') : t('شغّل الصوت', 'Shaghal el soot')}
          onClick={play}
          disabled={!host || !connected || pending || q.audioIsPlaying || inFlight.current}
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gold sm:h-24 sm:w-24 short:h-14 short:w-14 text-forest shadow-[0_8px_24px_rgba(231,167,43,.25)] transition hover:scale-105 disabled:cursor-default disabled:opacity-50"
        >
          {isPlaying ? <Volume2 size={30} /> : <Play size={30} fill="currentColor" />}
        </button>
      )}
      {/* Two lines only: what to do, plus one hint/joke line. */}
      <div role="status" aria-live="polite" className="mt-4 max-w-xs text-center short:mt-2">
        <p className="text-lg font-bold">
          {revealed
            ? t('عرفت الصوت؟', '3eraft el soot?')
            : isPlaying
              ? t('اسمعوا كويس…', 'Esma3o kwayes…')
              : pending
                ? t('جاري التشغيل…', 'Beyeshtaghal…')
                : t('شغّل الصوت', 'Shaghal el soot')}
        </p>
        <p className="mt-1 line-clamp-1 text-sm text-ivory/60">{hint}</p>
      </div>
      {!revealed && (
        <div
          role="progressbar"
          aria-label={t('تقدم الصوت', 'Ta2adom el soot')}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-5 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-white/10"
          dir="ltr"
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 max-w-xs text-center text-xs text-[#ffb1aa]">
          {error}
        </p>
      )}
      {host && (
        <audio
          ref={player}
          src={q.audioUrl}
          preload="metadata"
          onEnded={end}
          onError={() => {
            if (inFlight.current && requestId.current) void end()
            setError(t('الصوت مش متاح دلوقتي', 'El soot mesh mota7 delwa2ty'))
          }}
        />
      )}
    </div>
  )
}
