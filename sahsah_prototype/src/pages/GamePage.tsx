import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  CircleHelp,
  Eye,
  Lightbulb,
  ThumbsDown,
  ThumbsUp,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  UserPlus,
  X,
  Trophy,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import QuestionAudio from '../components/QuestionAudio'
import PartyQuestion from '../components/PartyQuestion'
import { GAME_MODE_LABELS as MODE_LABELS, GAME_MODE_LABELS_EN, type Question } from '../lib/game-types'
import { CATEGORIES, TEAM_COLORS, toAr, type Category } from '../lib/data'
import { useStore, type Session, type Team, type TeamId } from '../lib/store'
import { Logo, Poster } from '../components/art'
import { LangToggle } from '../components/Shell'
import { FitText, Modal, RollingNumber, useTimerMs, ZoomableImage } from '../components/ui'
import { BOARD_PHOTO, BOARD_IMAGE_PADDING, PHOTO, LOGO, FOOTBALL_Q } from '../lib/images'
import { useLang } from '../lib/i18n'

const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) as Category

/** How a round works — shown on the transition screen and behind every help button. */
function useSteps() {
  const { t } = useLang()
  return [
    t('الفريق الأول يختار السؤال ويجاوب في ٦٠ ثانية', 'El fare2 el awel ye5tar el so2al w ygaweb fe 60 sanya'),
    t('لو مجاوبش صح، الفريق التاني ياخد فرصته', 'Law magawebsh sa7, el fare2 el tany ya5od forsto'),
    t('اكشفوا الإجابة والمضيف يحسب النقط', 'E2shefo el egaba wel host ye7seb el no2at'),
    t('اعكسوا الدور: الفريق التاني يختار', 'E3keso el dor: el fare2 el tany ye5tar'),
  ]
}

function HowToPlay({ compact = false }: { compact?: boolean }) {
  const steps = useSteps()
  return (
    <ol className={`grid gap-2 short:gap-1 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10 short:gap-2 short:rounded-xl short:p-1.5">
          <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold font-bold text-forest short:h-6 short:w-6 short:text-xs">
            {toAr(i + 1)}
          </span>
          <span className="text-[15px] font-semibold leading-snug short:text-[13px]">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function ScoreBar({ s, host, onHelp }: { s: Session; host: boolean; onHelp: () => void }) {
  const { dispatch, busy, connected } = useStore()
  const { t } = useLang()
  const [full, setFull] = useState(!!document.fullscreenElement)
  const [edit, setEdit] = useState(false)
  const [invite, setInvite] = useState(false)
  const [manual, setManual] = useState<{ teamId: TeamId; value: string } | null>(null)
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const toggle = () => {
    void (
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
    )?.catch(() =>
      dispatch({ type: 'toast', text: t('ملء الشاشة مش متاح في المعاينة دي', 'Full screen mesh mota7 hena') }),
    )
  }
  const link = `${location.origin}/join/${s.code}`
  const team = (tm: Team, i: number) => (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-black/25 px-4 py-2 short:py-1"
      style={{ boxShadow: `inset 0 0 0 2px ${TEAM_COLORS[i]}55` }}
    >
      <span className="h-9 w-2 shrink-0 rounded-full short:h-7" style={{ background: TEAM_COLORS[i] }} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ivory/75 short:text-[12px]">{tm.name}</div>
        {host && edit ? (
          <button
            aria-label={t(`تعديل رصيد ${tm.name}`, `Ta3deel rased ${tm.name}`)}
            disabled={busy || !connected}
            onClick={() => setManual({ teamId: tm.id, value: String(tm.score) })}
            className="block text-start underline decoration-gold decoration-dashed underline-offset-8"
          >
            <RollingNumber value={tm.score} className="block text-[32px] font-bold leading-none md:text-[40px] short:text-[24px]" />
          </button>
        ) : (
          <RollingNumber value={tm.score} className="block text-[32px] font-bold leading-none md:text-[40px] short:text-[24px]" />
        )}
      </div>
      {host && edit && (
        <div className="ms-auto flex gap-1">
          <button
            disabled={busy || !connected}
            aria-label={t(`خصم ١٠٠ من ${tm.name}`, `Ekhsem 100 men ${tm.name}`)}
            onClick={() => dispatch({ type: 'adjust', teamId: tm.id, delta: -100 })}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <Minus size={18} />
          </button>
          <button
            disabled={busy || !connected}
            aria-label={t(`إضافة ١٠٠ لـ${tm.name}`, `Daif 100 le ${tm.name}`)}
            onClick={() => dispatch({ type: 'adjust', teamId: tm.id, delta: 100 })}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  )
  const btn =
    'grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-ivory transition hover:bg-white/20 short:h-10 short:w-10'
  return (
    <div className="mx-auto flex w-full max-w-[1400px] shrink-0 items-center gap-2 px-3 pt-3 md:gap-3 md:px-6 short:pt-2">
      <Link to="/play" aria-label={t('خروج', 'Khoroog')} className="hidden shrink-0 lg:block">
        <Logo size={46} mark />
      </Link>
      {team(s.teams[0], 0)}
      {team(s.teams[1], 1)}
      <div className="flex gap-1.5">
        <button onClick={onHelp} className={btn} aria-label={t('إزاي نلعب؟', 'Ezay nel3ab?')}>
          <CircleHelp size={20} />
        </button>
        <button onClick={() => setInvite(true)} className={btn} aria-label={t('دعوة', 'Da3wa')}>
          <UserPlus size={19} />
        </button>
        {host && (
          <button
            onClick={() => setEdit((e) => !e)}
            className={`${btn} ${edit ? '!bg-gold !text-forest' : ''}`}
            aria-label={t('تعديل النقاط', 'Ta3deel el no2at')}
            aria-pressed={edit}
          >
            <SlidersHorizontal size={19} />
          </button>
        )}
        <LangToggle className="short:h-10" />
        <button onClick={toggle} className={`${btn} max-sm:hidden`} aria-label={t('ملء الشاشة', 'Full screen')}>
          {full ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </button>
      </div>
      <Modal open={invite} onClose={() => setInvite(false)} title={t('دعوة', 'Da3wa')}>
        <div className="flex flex-col items-center pt-4 text-center">
          <h2 className="font-display text-3xl">{t('كود اللعبة', 'Code el le3ba')}</h2>
          <div className="num my-2 text-5xl font-bold tracking-[0.2em]">{toAr(s.code)}</div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stroke">
            <QRCodeSVG value={link} size={200} fgColor="#0d2e1d" />
          </div>
        </div>
      </Modal>
      <Modal open={!!manual} onClose={() => setManual(null)} title={t('تعديل رصيد الفريق', 'Ta3deel rased el fare2')}>
        {manual && (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const current = s.teams.find((x) => x.id === manual.teamId)!
              if (await dispatch({ type: 'adjust', teamId: manual.teamId, delta: Number(manual.value) - current.score }))
                setManual(null)
            }}
            className="pt-3"
          >
            <h2 className="font-display text-3xl">{t('تعديل الرصيد', 'Ta3deel el rased')}</h2>
            <label htmlFor="manual-score" className="mt-4 block text-sm font-semibold">
              {s.teams.find((x) => x.id === manual.teamId)?.name}
            </label>
            <input
              id="manual-score"
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              value={manual.value}
              onChange={(event) => setManual({ ...manual, value: event.target.value })}
              className="num mt-2 h-14 w-full rounded-xl border border-stroke bg-white px-4 text-2xl text-forest"
            />
            <button
              type="submit"
              disabled={busy || !connected || !manual.value || !Number.isInteger(Number(manual.value))}
              className="mt-5 h-12 w-full rounded-xl bg-forest font-bold text-ivory disabled:opacity-50"
            >
              {t('حفظ الرصيد', '7fz el rased')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}

/** Transition screen before the board: team names face off, categories, QR and how to play. */
function Intro({ s, host, onStart }: { s: Session; host: boolean; onStart: () => void }) {
  const { t, ar } = useLang()
  const link = `${location.origin}/join/${s.code}`
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="mx-auto flex min-h-0 w-full max-w-[1300px] flex-1 flex-col gap-4 p-4 md:p-6 short:gap-2 short:p-2"
    >
      <div className="flex items-center justify-center gap-4 md:gap-8">
        <motion.p
          initial={{ x: ar ? 60 : -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="min-w-0 truncate font-display text-[clamp(30px,6vw,76px)] leading-none short:text-[34px]"
          style={{ color: TEAM_COLORS[0] }}
        >
          {s.teams[0].name}
        </motion.p>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 400 }}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-play font-display text-2xl text-white shadow-[0_0_40px_rgba(217,52,43,.6)] md:h-20 md:w-20 md:text-3xl short:h-12 short:w-12 short:text-xl"
        >
          VS
        </motion.span>
        <motion.p
          initial={{ x: ar ? -60 : 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="min-w-0 truncate font-display text-[clamp(30px,6vw,76px)] leading-none short:text-[34px]"
          style={{ color: TEAM_COLORS[1] }}
        >
          {s.teams[1].name}
        </motion.p>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1.25fr_1fr] short:gap-2">
        <div className="grid min-h-0 grid-cols-6 content-center gap-2 md:gap-3">
          {s.categoryIds.map((id, i) => (
            <motion.div
              key={id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 + i * 0.07 }}
              className="min-w-0"
            >
              <Poster cat={catOf(id)} titleClass="text-[12px] md:text-[15px]" boxClass="min-h-[2.25rem]" className="rounded-[12px]" />
            </motion.div>
          ))}
        </div>
        <div className="flex min-h-0 flex-col justify-center gap-3 overflow-hidden short:gap-1">
          <p className="font-display text-2xl text-gold short:text-lg">{t('إزاي نلعب؟', 'Ezay nel3ab?')}</p>
          <HowToPlay compact />
          <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10 short:hidden">
            <span className="rounded-xl bg-white p-1.5">
              <QRCodeSVG value={link} size={64} fgColor="#0d2e1d" />
            </span>
            <span className="text-sm text-ivory/70">
              {t('الشلة تدخل بالكود', 'El shella tedkhol bel code')}{' '}
              <span className="num text-xl font-bold tracking-widest text-gold">{toAr(s.code)}</span>
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onStart}
        className="btn-play sheen mx-auto flex h-[72px] w-full max-w-md shrink-0 items-center justify-center gap-3 rounded-2xl text-[28px] font-bold short:h-12 short:text-xl"
      >
        {host ? t('يلا نبدأ!', 'Yalla nebda2!') : t('شوف اللوحة', 'Shoof el lo7a')}
      </button>
    </motion.div>
  )
}

function Board({ s, host }: { s: Session; host: boolean }) {
  const { dispatch, connected, busy } = useStore()
  const { t } = useLang()
  const tile = (q: Question, cat: Category) => {
    const done = q.state === 'answered'
    const won = done && q.wonBy ? s.teams.findIndex((x) => x.id === q.wonBy) : -1
    const name = t(cat.name, cat.nameEn)
    return (
      <motion.button
        key={q.id}
        data-question-id={q.id}
        disabled={done || !host || busy || !connected}
        onClick={() => dispatch({ type: 'openQuestion', id: q.id })}
        whileHover={!done && host ? { y: -2 } : undefined}
        whileTap={!done && host ? { scale: 0.96 } : undefined}
        aria-label={`${name} — ${q.points}${
          done
            ? won >= 0
              ? t(` — كسبه ${s.teams[won].name}`, ` — kasabo ${s.teams[won].name}`)
              : t(' — محدش كسبه', ' — ma7adsh kasabo')
            : ''
        }`}
        className={`grid min-w-0 flex-1 place-items-center rounded-xl text-[clamp(16px,2.6dvh,30px)] font-bold transition-colors ${
          done
            ? won >= 0
              ? 'text-forest shadow-inner'
              : 'bg-white/5 text-ivory/30'
            : 'border border-stroke/70 bg-gradient-to-b from-[#fffdf8] to-[#f3e9d2] text-forest shadow-[0_6px_16px_rgba(0,0,0,.25)] hover:border-gold disabled:opacity-90'
        }`}
        style={won >= 0 ? { background: TEAM_COLORS[won] } : undefined}
      >
        {done ? (
          won >= 0 ? (
            <Check size={22} strokeWidth={3} />
          ) : (
            <X size={20} />
          )
        ) : (
          <span className="num">{toAr(q.points)}</span>
        )}
      </motion.button>
    )
  }
  return (
    <div
      role="region"
      aria-label={t('لوحة الأسئلة', 'Lo7et el as2ela')}
      className="reveal mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-3 grid-rows-2 gap-3 p-3 md:gap-4 md:px-6 md:pb-5 portrait:grid-cols-2 portrait:grid-rows-3 short:gap-2 short:p-2"
    >
      {s.categoryIds.map((cid, index) => {
        const cat = catOf(cid)
        const artwork = BOARD_PHOTO[cid]
        const padding = BOARD_IMAGE_PADDING[cid]
        const visible = 941 - (padding?.top ?? 0) - (padding?.bottom ?? 0)
        const questions = s.questions.filter((q) => q.categoryId === cid).sort((a, b) => a.row - b.row)
        // 200 / 400 / 600 above the art, and the second 200 / 400 / 600 below it.
        const top = questions.filter((q) => q.row % 2 === 0)
        const bottom = questions.filter((q) => q.row % 2 === 1)
        const row = 'flex h-[clamp(30px,7.5dvh,64px)] shrink-0 gap-1.5 short:h-[clamp(24px,8dvh,34px)]'
        return (
          <section
            key={cid}
            data-category-id={cid}
            aria-label={t(cat.name, cat.nameEn)}
            className="flex min-h-0 min-w-0 flex-col gap-1.5 rounded-[20px] bg-[#0c2a1d] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.3)] ring-1 ring-gold/20"
          >
            <div className={row}>{top.map((q) => tile(q, cat))}</div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px]">
              <img
                src={artwork || PHOTO[cid]}
                alt=""
                loading={index < 3 ? 'eager' : 'lazy'}
                draggable={false}
                className="absolute inset-x-0 w-full object-cover"
                style={
                  artwork
                    ? { top: `${-((padding?.top ?? 0) / visible) * 100}%`, height: `${(941 / visible) * 100}%` }
                    : { top: 0, height: '100%' }
                }
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c2a1d] via-[#0c2a1d]/80 to-transparent px-2 pb-1.5 pt-6 text-center">
                <h2 className="truncate font-display text-[clamp(16px,3.2dvh,34px)] leading-tight text-ivory">
                  {t(cat.name, cat.nameEn)}
                </h2>
              </div>
            </div>
            <div className={row}>{bottom.map((q) => tile(q, cat))}</div>
          </section>
        )
      })}
    </div>
  )
}

function TimerRing() {
  const { ms, t } = useTimerMs()
  const { t: tr } = useLang()
  if (!t) return null
  const secs = Math.ceil(ms / 1000)
  const frac = ms / t.durationMs
  const r = 70
  const c = 2 * Math.PI * r
  const low = t.status === 'running' && secs <= 10
  return (
    <div
      className={`relative grid aspect-square shrink-0 place-items-center ${low ? 'animate-pulse' : ''}`}
      style={{ width: 'min(100%, 30dvh, 220px)' }}
      role="timer"
      aria-label={tr(`${secs} ثانية`, `${secs} sanya`)}
    >
      <svg viewBox="0 0 170 170" className="absolute inset-0 -rotate-90">
        <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
        <circle
          cx="85"
          cy="85"
          r={r}
          fill="none"
          stroke={low ? '#d9342b' : '#e7a72b'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="text-center">
        <div className="num text-[clamp(30px,8dvh,68px)] font-bold leading-none">{toAr(secs)}</div>
        <div className="mt-1 text-xs text-ivory/50">
          {t.status === 'idle'
            ? tr('جاهز', 'Gahez')
            : t.status === 'running'
              ? tr('شغّال', 'Shaghal')
              : t.status === 'paused'
                ? tr('واقف', 'Wa2ef')
                : tr('خلص الوقت', 'El wa2t 5eles')}
        </div>
      </div>
    </div>
  )
}

function QuestionFeedback({ sessionId, qid }: { sessionId: string; qid: string }) {
  const { state, dispatch } = useStore()
  const { t } = useLang()
  const key = `${sessionId}:${qid}`
  const done = state.feedback[key]
  const btn = (v: 'like' | 'dislike', Icon: typeof ThumbsUp, label: string, on: string) => (
    <motion.button
      whileHover={done ? undefined : { y: -2, scale: 1.06 }}
      whileTap={done ? undefined : { scale: 0.9 }}
      animate={done?.vote === v ? { scale: [1, 1.3, 1], rotate: [0, v === 'like' ? -14 : 14, 0] } : undefined}
      transition={{ duration: 0.5 }}
      onClick={() => !done && dispatch({ type: 'feedback', key, vote: v })}
      disabled={!!done}
      aria-label={label}
      aria-pressed={done?.vote === v}
      className={`grid h-12 w-12 place-items-center rounded-full border transition-colors short:h-10 short:w-10 ${
        done?.vote === v
          ? `${on} border-transparent text-white`
          : done
            ? 'border-white/10 text-white/30'
            : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      <Icon size={20} strokeWidth={2.2} fill={done?.vote === v ? 'currentColor' : 'none'} />
    </motion.button>
  )
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t('عجبك السؤال؟', '3agabak el so2al?')}>
      {done && <Check size={16} className="text-gold" aria-label={t('شكرًا على رأيك', 'Shokran')} />}
      {btn('like', ThumbsUp, t('عجبني السؤال', '3agabny el so2al'), 'bg-[#2fae6b]')}
      {btn('dislike', ThumbsDown, t('ما عجبنيش السؤال', 'Ma3agabneesh el so2al'), 'bg-[#e0553f]')}
    </div>
  )
}

/** Template 3 — question → hint image 1…n → answer. Each hint costs points. */
function HintSteps({ q, host }: { q: Extract<Question, { type: 'IMAGE_BLUR' | 'IMAGE_ZOOM' }>; host: boolean }) {
  const { dispatch, busy, connected } = useStore()
  const { t } = useLang()
  const last = q.pointStages.length - 1
  return (
    <div className="glass flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2">
      <div className="flex items-center gap-1.5" aria-label={t(`تلميح ${q.stageIndex + 1}`, `Talmee7 ${q.stageIndex + 1}`)}>
        {q.pointStages.map((points, i) => (
          <span
            key={i}
            className={`num rounded-lg px-2.5 py-1 text-sm font-bold ${
              i === q.stageIndex ? 'bg-gold text-forest' : i < q.stageIndex ? 'text-ivory/35 line-through' : 'bg-white/10 text-ivory/70'
            }`}
          >
            {toAr(points)}
          </span>
        ))}
      </div>
      {host && (
        <button
          onClick={() => dispatch({ type: 'advanceStage' })}
          disabled={busy || !connected || q.stageIndex >= last}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold/20 px-3 text-sm font-bold text-gold transition hover:bg-gold/30 disabled:opacity-45"
        >
          <Lightbulb size={17} />
          {q.stageIndex >= last
            ? t('آخر تلميح', 'Akher talmee7')
            : t(`تلميح جديد (−${toAr(q.pointStages[q.stageIndex] - q.pointStages[q.stageIndex + 1])})`, `Talmee7 gdeed (−${q.pointStages[q.stageIndex] - q.pointStages[q.stageIndex + 1]})`)}
        </button>
      )}
    </div>
  )
}

function Media({ s, q, host, revealed }: { s: Session; q: Question; host: boolean; revealed: boolean }) {
  const { t } = useLang()
  if (q.type === 'IMAGE_PERSON' || q.type === 'IMAGE_COLOR' || q.type === 'IMAGE_RIDDLE' || q.type === 'IMAGE_MEMORY')
    return <PartyQuestion question={q} host={host} revealed={revealed} />
  if (q.type === 'AUDIO_GUESS' || q.type === 'AUDIO_REVERSE' || q.type === 'AUDIO_VOICE')
    return <QuestionAudio question={q} sessionId={s.id} host={host} revealed={revealed} />
  if (q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM') {
    const src = revealed ? q.answer?.imageUrl || q.imageUrl : q.imageUrl
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-white/15 bg-deep">
          <ZoomableImage
            key={src}
            src={src}
            alt={revealed ? t('صورة الإجابة', 'Soret el egaba') : t('صورة السؤال', 'Soret el so2al')}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain"
          />
        </div>
        {!revealed && <HintSteps q={q} host={host} />}
      </div>
    )
  }
  const photo = q.categoryId === 'football' ? FOOTBALL_Q[q.row] : undefined
  if (!photo) return null
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[22px] border border-white/15 bg-deep">
      <ZoomableImage
        src={photo.src}
        alt={t('صورة السؤال', 'Soret el so2al')}
        className="h-full w-full"
        imgClassName="h-full w-full object-cover"
        style={{ objectPosition: photo.pos }}
      />
    </div>
  )
}

function QuestionView({ s, host }: { s: Session; host: boolean }) {
  const { dispatch, busy, connected } = useStore()
  const { t: timer } = useTimerMs()
  const { t, ar } = useLang()
  const q = s.questions.find((x) => x.id === s.activeQuestionId)!
  const cat = catOf(q.categoryId)
  const revealed = s.phase === 'answer'
  const staged = q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM'
  // Template 4: nothing to answer until the picture has been memorised and hidden once.
  const memoryWaiting = q.type === 'IMAGE_MEMORY' && !q.memoryAsked
  const hasMedia = q.type !== 'STANDARD' || q.categoryId === 'football'
  const disabled = busy || !connected
  const [helpOpen, setHelpOpen] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const started = useRef(false)
  // Timers start on their own; "Rakez M3aya" starts once the question is asked.
  useEffect(() => {
    if (!host || revealed || started.current || timer?.status !== 'idle') return
    if (memoryWaiting) return
    const id = setTimeout(() => {
      started.current = true
      void dispatch({ type: 'timer', op: 'start' })
    }, 350)
    return () => clearTimeout(id)
  }, [host, revealed, timer?.status, memoryWaiting, dispatch])
  const award = points ?? q.availablePoints
  const prompt = ar ? q.prompt : q.promptEn || q.prompt
  const answer = q.answer && (ar ? q.answer.text : q.answer.textEn || q.answer.text)
  const ctl =
    'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-[17px] font-bold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 short:min-h-11 short:text-[15px]'
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26 }}
        className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3 px-3 pb-3 pt-3 md:px-6 md:pb-5 short:gap-2 short:pb-2 short:pt-2"
      >
        {/* One title only: category + value, then feedback and help */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="truncate rounded-full bg-gold px-4 py-2 font-display text-[20px] leading-none text-forest short:py-1.5 short:text-[16px]">
            {t(cat.name, cat.nameEn)}
          </span>
          <span className="flex items-baseline gap-1.5" aria-live="polite">
            <span className="num text-[30px] font-bold leading-none text-gold short:text-[24px]">{toAr(q.availablePoints)}</span>
            <span className="text-sm font-semibold text-ivory/55">{t('نقطة', 'no2ta')}</span>
          </span>
          <div className="ms-auto flex items-center gap-2">
            <QuestionFeedback sessionId={s.id} qid={q.id} />
            <button
              onClick={() => setHelpOpen(true)}
              aria-label={t('مساعدة', 'Mosa3da')}
              className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/5 text-ivory transition hover:bg-white/15 short:h-10 short:w-10"
            >
              <CircleHelp size={20} />
            </button>
          </div>
        </div>
        {/* Question first, then the media, then the timer — nothing overlaps, nothing scrolls. */}
        <div
          className={`grid min-h-0 flex-1 gap-3 md:gap-5 short:gap-2 ${
            hasMedia
              ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)_minmax(0,0.85fr)] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto]'
              : 'grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] portrait:grid-cols-1 portrait:grid-rows-[minmax(0,1fr)_auto]'
          }`}
        >
          <div className="flex min-h-0 flex-col gap-3 short:gap-2">
            <div className="glass min-h-0 flex-1 rounded-[22px] p-4 md:p-6 short:p-3">
              <FitText max={hasMedia ? 64 : 88} min={14} className="font-display leading-[1.3] text-ivory">
                {prompt}
              </FitText>
            </div>
            <AnimatePresence>
              {revealed && answer && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-h-[45%] shrink-0 overflow-hidden rounded-[20px] bg-gradient-to-br from-gold to-[#c98a14] px-5 py-3 text-forest shadow-[0_16px_40px_rgba(231,167,43,.3)]"
                >
                  <div className="text-xs font-semibold text-forest/60">{t('الإجابة', 'El egaba')}</div>
                  <div className="mt-1 font-display text-[clamp(22px,4dvh,42px)] leading-tight">{answer}</div>
                  {q.type === 'IMAGE_COLOR' && (
                    <span
                      className="mt-2 inline-block h-8 w-16 rounded-xl border-2 border-forest/25 shadow-sm"
                      style={{ background: q.colorHex }}
                      aria-label={t('اللون الأصلي', 'El loon el asly')}
                    />
                  )}
                  {q.answer?.forwardAudioUrl && host && (
                    <audio controls controlsList="nodownload" src={q.answer.forwardAudioUrl} className="mt-2 h-10 w-full" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {hasMedia && (
            <div className="min-h-0">
              <Media s={s} q={q} host={host} revealed={revealed} />
            </div>
          )}
          <div className="flex min-h-0 flex-col items-center justify-center gap-3 short:gap-2 portrait:flex-row">
            {!revealed && <TimerRing />}
            {host && !revealed && (
              <div className="grid w-full max-w-[260px] gap-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    disabled={disabled || memoryWaiting}
                    onClick={() => dispatch({ type: 'timer', op: timer?.status === 'running' ? 'pause' : 'start' })}
                    className={`${ctl} ${timer?.status === 'running' ? 'bg-white/10 text-ivory' : 'bg-gold text-forest'}`}
                  >
                    {timer?.status === 'running' ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                    {timer?.status === 'running' ? t('وقّف', 'Wa22af') : t('كمّل', 'Kammel')}
                  </button>
                  <button
                    disabled={disabled || memoryWaiting}
                    onClick={() => dispatch({ type: 'timer', op: 'reset' })}
                    aria-label={t('إعادة الوقت', 'E3adet el wa2t')}
                    className={`${ctl} w-14 border border-white/15 !px-0 text-ivory/85 hover:bg-white/5`}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <button
                  disabled={disabled || memoryWaiting}
                  onClick={() => dispatch({ type: 'reveal' })}
                  className={`${ctl} btn-play whitespace-nowrap`}
                >
                  <Eye size={18} /> {t('إظهار الإجابة', 'Ezhar el egaba')}
                </button>
              </div>
            )}
            {host && revealed && (
              <div className="grid w-full max-w-[300px] gap-2">
                <p className="font-display text-2xl short:text-xl">{t('مين جاوب صح؟', 'Meen gaweb sa7?')}</p>
                {/* Template 3: the host can pick the points (e.g. the other team got it on the first hint). */}
                {staged && (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('النقط', 'El no2at')}>
                    {[...new Set([q.points, ...q.pointStages])].map((p) => (
                      <button
                        key={p}
                        role="radio"
                        aria-checked={award === p}
                        onClick={() => setPoints(p)}
                        className={`num h-10 flex-1 rounded-xl text-[15px] font-bold transition ${award === p ? 'bg-gold text-forest' : 'bg-white/10 text-ivory hover:bg-white/20'}`}
                      >
                        {toAr(p)}
                      </button>
                    ))}
                  </div>
                )}
                {s.teams.map((team, i) => (
                  <button
                    key={team.id}
                    disabled={disabled}
                    onClick={() => dispatch({ type: 'award', questionId: q.id, teamId: team.id, points: award })}
                    className={ctl}
                    style={{ background: TEAM_COLORS[i], color: '#0d2e1d' }}
                  >
                    <span className="truncate">{team.name}</span>
                    <span className="num text-sm">+{toAr(award)}</span>
                  </button>
                ))}
                <button
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'award', questionId: q.id, teamId: null })}
                  className={`${ctl} border border-white/20 text-ivory hover:bg-white/5`}
                >
                  <X size={17} /> {t('ولا حد', 'Wala 7ad')}
                </button>
              </div>
            )}
            {!host && (
              <p className="text-center text-xs text-ivory/55">
                {t('المضيف بيتحكم في الوقت والإجابة.', 'El host beyet7akem fel wa2t wel egaba.')}
              </p>
            )}
          </div>
        </div>
      </motion.div>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title={t('مساعدة', 'Mosa3da')}>
        <div className="pt-3">
          <h2 className="font-display text-3xl">{ar ? MODE_LABELS[q.type] : GAME_MODE_LABELS_EN[q.type]}</h2>
          <p className="mt-3 text-sm leading-7 text-forest/75">
            {q.type !== 'STANDARD' && cat.fresh
              ? t(cat.help, cat.helpEn)
              : t('الوقت بيبدأ لوحده. خمنوا مع بعض، والمضيف بيكشف الإجابة ويحسب النقط.', 'El wa2t beyebda2 lewa7do. Khamenoo ma3 ba3d, wel host beye2shef el egaba w ye7seb el no2at.')}
            {staged ? t(' كل تلميح بيقلل النقط.', ' Kol talmee7 beye2allel el no2at.') : ''}
          </p>
        </div>
      </Modal>
    </>
  )
}

function Confetti() {
  const colors = ['#e7a72b', '#feb700', '#d9342b', '#6fd3a0', '#fffdf8']
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 34 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ x: '50vw', y: '40vh', opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: `${(Math.sin(i * 12.9) * 0.5 + 0.5) * 100}vw`,
            y: `${95 + (i % 5) * 4}vh`,
            opacity: [1, 1, 0],
            rotate: 360 * ((i % 3) + 1),
          }}
          transition={{ duration: 2.2 + (i % 5) * 0.2, ease: [0.2, 0.8, 0.3, 1] }}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ background: colors[i % 5] }}
        />
      ))}
    </div>
  )
}

/** Categories each team "owns": the team that scored the most points in that category. */
function useCategoryWins(s: Session) {
  return useMemo(() => {
    const wins: [string[], string[]] = [[], []]
    for (const id of s.categoryIds) {
      const totals = s.teams.map((team) =>
        s.questions
          .filter((q) => q.categoryId === id && q.wonBy === team.id)
          .reduce((sum, q) => sum + (q.wonPoints ?? 0), 0),
      )
      if (totals[0] > totals[1]) wins[0].push(id)
      else if (totals[1] > totals[0]) wins[1].push(id)
    }
    return wins
  }, [s])
}

function Winner({ s, host }: { s: Session; host: boolean }) {
  const { state, dispatch, busy } = useStore()
  const { t } = useLang()
  const nav = useNavigate()
  const [a, b] = s.teams
  const tie = a.score === b.score
  const win = a.score > b.score ? a : b
  const members = state.teamMembers[s.id] ?? [[], []]
  const wins = useCategoryWins(s)
  return (
    <div className="reveal relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-4 text-center short:gap-2 short:py-2">
      {!tie && <Confetti />}
      <div className="flex items-center gap-4">
        <img src={LOGO.bubble} alt="" aria-hidden className="h-16 w-auto short:hidden" />
        <Trophy size={56} strokeWidth={1.3} className="text-gold short:h-10 short:w-10" />
      </div>
      <h1 className="font-display text-[clamp(40px,8dvh,88px)] leading-none">
        {tie ? t('تعادل!', 'Ta3adol!') : t(`مبروك يا ${win.name}!`, `Mabrook ya ${win.name}!`)}
      </h1>
      <div className="grid w-full grid-cols-2 gap-3 md:gap-4">
        {s.teams.map((tm, i) => {
          const winner = !tie && win.id === tm.id
          return (
            <div
              key={tm.id}
              className={`flex min-w-0 flex-col items-center rounded-[22px] p-4 md:p-5 short:p-2 ${winner ? 'bg-gradient-to-b from-gold to-[#c98a14] text-forest' : 'glass'}`}
            >
              <div className="truncate font-display text-2xl short:text-xl">{tm.name}</div>
              <RollingNumber value={tm.score} className="text-[clamp(40px,9dvh,72px)] font-bold leading-none" />
              {members[i].length > 0 && (
                <p className={`mt-2 line-clamp-2 text-sm ${winner ? 'text-forest/75' : 'text-ivory/70'}`}>
                  {members[i].join(' · ')}
                </p>
              )}
              {wins[i].length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 short:mt-1">
                  {wins[i].map((id) => {
                    const c = catOf(id)
                    return (
                      <span
                        key={id}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full ps-1 pe-3 text-xs font-bold ${winner ? 'bg-forest/15' : 'bg-white/10'}`}
                      >
                        <img src={PHOTO[id]} alt="" className="h-6 w-6 rounded-full object-cover" />
                        {t(c.name, c.nameEn)}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {host ? (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            disabled={busy}
            onClick={() =>
              state.tokens < 1
                ? nav('/tokens?returnTo=' + encodeURIComponent(`/game/${s.id}/results`))
                : dispatch({ type: 'replay', newCategories: false })
            }
            className="btn-play sheen h-16 rounded-2xl px-12 text-[24px] font-bold short:h-12 short:text-lg"
          >
            {t('العبوا مرة تانية', 'El3abo marra tanya')}
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'replay', newCategories: true })
              nav('/play')
            }}
            className="h-16 rounded-2xl border border-white/20 px-8 text-lg font-semibold text-ivory hover:bg-white/5 short:h-12"
          >
            {t('فئات جديدة', 'Fe2at gdeeda')}
          </button>
        </div>
      ) : (
        <Link to="/play" className="text-gold underline">
          {t('العب لعبتك', 'El3ab le3betak')}
        </Link>
      )}
    </div>
  )
}

/** Games are played in landscape on phones. */
function RotateHint() {
  const { t } = useLang()
  return (
    <div className="fixed inset-0 z-[95] hidden flex-col items-center justify-center gap-4 bg-deep/97 p-8 text-center max-md:portrait:flex">
      <motion.div animate={{ rotate: [0, -90, -90, 0] }} transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.3, 0.7, 1] }}>
        <Smartphone size={64} className="text-gold" strokeWidth={1.4} />
      </motion.div>
      <p className="font-display text-3xl">{t('لف الموبايل', 'Leff el mobile')}</p>
      <p className="text-sm text-ivory/65">{t('اللعبة بتتلعب والشاشة بالعرض', 'El le3ba btetle3eb wel shasha bel 3ard')}</p>
    </div>
  )
}

export default function GamePage() {
  const { state, isHost, connected, dispatch } = useStore()
  const { t } = useLang()
  const { sessionId } = useParams()
  const nav = useNavigate()
  const s = state.session
  const [howTo, setHowTo] = useState(false)
  useEffect(() => {
    if (!s || s.id !== sessionId) return
    const url =
      s.phase === 'question' || s.phase === 'answer'
        ? `/game/${s.id}/question/${s.activeQuestionId}${s.phase === 'answer' ? '?answer=1' : ''}`
        : s.phase === 'finished'
          ? `/game/${s.id}/results`
          : `/game/${s.id}`
    if (location.pathname + location.search !== url) nav(url, { replace: true })
  }, [s, sessionId, nav])

  if (s && s.id === sessionId && s.phase === 'lobby')
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="rounded-2xl bg-forest p-3">
          <Logo size={64} />
        </div>
        <h1 className="font-display text-4xl">{t('الشلة بتتجمع', 'El shella betetgamma3')}</h1>
        <p className="text-sm text-ivory/60">{t('المضيف هيبدأ اللعبة حالًا', 'El host hayebda2 el le3ba 7alan')}</p>
        <div className="glass num rounded-2xl px-8 py-4 text-4xl tracking-widest text-gold">{toAr(s.code)}</div>
        {isHost && (
          <Link to="/play?step=room" className="btn-play rounded-xl px-6 py-3">
            {t('ابدأ اللعبة', 'Ebda2 el le3ba')}
          </Link>
        )}
      </div>
    )

  if (!s || s.id !== sessionId) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-5xl">{connected ? t('ثانية واحدة…', 'Sanya wa7da…') : t('اللعبة مش موجودة', 'El le3ba mesh mawgooda')}</h1>
          <Link to="/play" className="btn-play mt-8 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold">
            {t('العب الآن', 'El3ab delwa2ty')}
          </Link>
        </div>
      </div>
    )
  }
  const fresh = s.phase === 'board' && !state.introSeen.includes(s.id) && s.questions.every((q) => q.state !== 'answered')
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {s.phase !== 'finished' && <RotateHint />}
      {!connected && (
        <div role="status" className="shrink-0 bg-gold/20 px-4 py-1.5 text-center text-xs">
          {t('الاتصال اتقطع — بنحاول نرجع…', 'El etesal et2ata3 — bne7awel nerga3…')}
        </div>
      )}
      {s.phase !== 'finished' && !fresh && <ScoreBar s={s} host={isHost} onHelp={() => setHowTo(true)} />}
      <AnimatePresence mode="wait">
        {fresh && <Intro key="i" s={s} host={isHost} onStart={() => dispatch({ type: 'introSeen', sessionId: s.id })} />}
        {s.phase === 'board' && !fresh && <Board key="b" s={s} host={isHost} />}
        {(s.phase === 'question' || s.phase === 'answer') && s.activeQuestionId && (
          <QuestionView key={s.activeQuestionId} s={s} host={isHost} />
        )}
        {s.phase === 'finished' && <Winner key="w" s={s} host={isHost} />}
      </AnimatePresence>
      <Modal open={howTo} onClose={() => setHowTo(false)} title={t('إزاي نلعب؟', 'Ezay nel3ab?')} tone="glass" wide>
        <div className="pt-2">
          <h2 className="mb-4 font-display text-3xl">{t('إزاي نلعب؟', 'Ezay nel3ab?')}</h2>
          <HowToPlay />
        </div>
      </Modal>
    </div>
  )
}
