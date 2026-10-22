import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { DEMO_MODE } from '../lib/runtime'
import type { Session } from '../lib/game-types'
import { Logo } from '../components/art'
import { toAr } from '../lib/data'
import { useStore, type TeamId } from '../lib/store'
import { useLang } from '../lib/i18n'

export default function JoinPage() {
  const { code: param } = useParams()
  const { state, adoptSession } = useStore()
  const { t } = useLang()
  const nav = useNavigate()
  const [digits, setDigits] = useState<string[]>(() =>
    param && /^\d{4}$/.test(param) ? param.split('') : ['', '', '', ''],
  )
  const [name, setName] = useState('')
  const [team, setTeam] = useState<TeamId>('A')
  const [error, setError] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [busy, setBusy] = useState(false)
  const s = state.session
  const code = digits.join('')

  const set = (i: number, v: string) => {
    const d = v.replace(/\D/g, '')
    if (d.length > 1) {
      const arr = d
        .slice(0, 4)
        .padEnd(4, ' ')
        .split('')
        .map((x) => x.trim())
      setDigits(arr)
      refs.current[Math.min(d.length, 3)]?.focus()
      return
    }
    setError('')
    setDigits((p) => p.map((x, j) => (j === i ? d : x)))
    if (d && i < 3) refs.current[i + 1]?.focus()
  }

  useEffect(() => {
    if (code.length !== 4) return
    let active = true
    api<Session>(`/api/rooms/${code}`)
      .then((session) => {
        if (active) adoptSession(session)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [code, adoptSession])

  const join = async () => {
    setBusy(true)
    setError('')
    try {
      const room = await api<Session>(`/api/rooms/${code}`)
      const session = await api<Session>(`/api/sessions/${room.id}/join`, {
        name: name.trim() || t('ضيف', 'Deif'),
        team,
      })
      adoptSession(session)
      nav(`/game/${session.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('جرّب تاني', 'Garrab tany'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="paper reveal w-full max-w-md rounded-[26px] p-7 text-center">
        <Link to="/play" className="inline-block">
          <span className="inline-grid place-items-center rounded-[20px] bg-forest p-2.5">
            <Logo size={72} variant="square" />
          </span>
        </Link>
        <h1 className="mt-4 font-display text-[40px] leading-none">{t('ادخل اللعبة', 'Odkhol el le3ba')}</h1>

        <div dir="ltr" className="mt-6 flex justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={t(`الرقم ${toAr(i + 1)}`, `Raqam ${i + 1}`)}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
              }}
              className="num h-16 w-14 rounded-2xl border-2 border-stroke bg-white text-center text-3xl font-bold outline-none transition focus:border-gold"
            />
          ))}
        </div>

        <fieldset className="mt-6 text-start">
          <label className="text-sm font-semibold" htmlFor="gname">
            {t('اسمك (اختياري)', 'Esmak (e5tyary)')}
          </label>
          <input
            id="gname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="mt-1.5 h-12 w-full rounded-xl border-2 border-stroke bg-white px-4 outline-none focus:border-gold"
          />
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('الفريق', 'El fare2')}>
            {(['A', 'B'] as TeamId[]).map((id, i) => (
              <button
                key={id}
                role="radio"
                aria-checked={team === id}
                onClick={() => setTeam(id)}
                className={`h-12 rounded-xl border-2 text-[15px] font-semibold transition ${
                  team === id ? 'border-gold bg-gold/20' : 'border-stroke bg-white'
                }`}
              >
                {s?.teams[i].name ?? (i ? t('الفريق ٢', 'Fare2 2') : t('الفريق ١', 'Fare2 1'))}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-play/10 px-3 py-2 text-sm font-semibold text-play"
          >
            {error}
          </p>
        )}
        <button
          disabled={code.length < 4 || busy}
          onClick={join}
          className="btn-play mt-6 h-14 w-full rounded-2xl text-lg font-bold"
        >
          {busy ? t('ثانية واحدة…', 'Sanya wa7da…') : t('ادخل', 'Odkhol')}
        </button>
        <p className="mt-3 text-xs text-forest/55">
          {DEMO_MODE
            ? t('عرض ضيف تجريبي — المشاركة بين الأجهزة في النسخة النهائية.', 'Ard deif tagreeby — el moshareka bein el agheza fel noskha el neha2eya.')
            : t('هتتفرج بس — المضيف هو اللي بيتحكم في اللعبة.', 'Hatetfarrag bas — el host howa elly beyet7akem.')}
        </p>
      </div>
    </div>
  )
}
