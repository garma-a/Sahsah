import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  CircleHelp,
  Coins,
  Eye,
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
  UserPlus,
  X,
  Trophy,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import QuestionAudio from '../components/QuestionAudio'
import PartyQuestion from '../components/PartyQuestion'
import { GAME_MODE_LABELS as MODE_LABELS } from '../lib/game-types'
import { CATEGORIES, toAr } from '../lib/data'
import { useStore, type Session, type Team, type TeamId } from '../lib/store'
import { Logo } from '../components/art'
import { Modal, RollingNumber, useTimerMs } from '../components/ui'
import {
  BOARD_PHOTO,
  BOARD_IMAGE_PADDING,
  PHOTO,
  LOGO,
  FOOTBALL_Q,
  QUESTION_PLACEHOLDER,
} from '../lib/images'

const TEAM_COLORS = ['#e7a72b', '#6fd3a0']

function ScoreBar({ s, host }: { s: Session; host: boolean }) {
  const { state, dispatch, busy, connected } = useStore()
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
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen?.()
    )?.catch(() => dispatch({ type: 'toast', text: 'ملء الشاشة مش متاح في المعاينة دي' }))
  }
  const link = `${location.origin}/join/${s.code}`
  const team = (t: Team, i: number) => (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-black/25 px-4 py-2.5"
      style={{ boxShadow: `inset 0 0 0 1px ${TEAM_COLORS[i]}33` }}
    >
      <span className="h-9 w-1.5 rounded-full" style={{ background: TEAM_COLORS[i] }} />
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ivory/60">{t.name}</div>
        {host && edit ? (
          <button
            aria-label={`تعديل رصيد ${t.name}`}
            disabled={busy || !connected}
            onClick={() => setManual({ teamId: t.id, value: String(t.score) })}
            className="block text-start underline decoration-gold decoration-dashed underline-offset-8"
            title="اضغط لتعديل الرصيد"
          >
            <RollingNumber
              value={t.score}
              className="block text-[34px] font-bold leading-none text-ivory md:text-[42px]"
            />
          </button>
        ) : (
          <RollingNumber
            value={t.score}
            className="block text-[34px] font-bold leading-none text-ivory md:text-[42px]"
          />
        )}
      </div>
      {host && edit && (
        <div className="ms-auto flex gap-1">
          <button
            disabled={busy || !connected}
            aria-label={`خصم ١٠٠ من ${t.name}`}
            onClick={() => dispatch({ type: 'adjust', teamId: t.id, delta: -100 })}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <Minus size={18} />
          </button>
          <button
            disabled={busy || !connected}
            aria-label={`إضافة ١٠٠ لـ${t.name}`}
            onClick={() => dispatch({ type: 'adjust', teamId: t.id, delta: 100 })}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"
          >
            <Plus size={18} />
          </button>
        </div>
      )}
    </div>
  )
  const btn =
    'grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-ivory transition hover:bg-white/20'
  return (
    <div className="mx-auto flex max-w-[1216px] flex-wrap items-center gap-2 px-3 pt-3 md:flex-nowrap md:gap-4 md:px-8">
      <Link to="/play" aria-label="خروج" className="hidden md:block">
        <Logo size={40} mark />
      </Link>
      {team(s.teams[0], 0)}
      {team(s.teams[1], 1)}
      <div className="flex gap-1.5">
        <button onClick={() => setInvite(true)} className={btn} aria-label="دعوة">
          <UserPlus size={18} />
        </button>
        {host && (
          <button
            onClick={() => setEdit((e) => !e)}
            className={`${btn} ${edit ? '!bg-gold !text-forest' : ''}`}
            aria-label="تعديل النقاط"
            aria-pressed={edit}
          >
            <SlidersHorizontal size={18} />
          </button>
        )}
        <button onClick={toggle} className={btn} aria-label="ملء الشاشة">
          {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
      {host && (
        <Link
          to="/tokens"
          className="flex h-9 basis-full items-center justify-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-3 text-xs text-gold sm:h-11 sm:basis-auto"
          aria-label={`رصيدك ${state.tokens} توكن، ${state.tokens} لعبة`}
        >
          <Coins size={15} />
          <span className="num">{toAr(state.tokens)}</span> توكن
        </Link>
      )}
      <Modal open={invite} onClose={() => setInvite(false)} title="دعوة">
        <div className="flex flex-col items-center pt-4 text-center">
          <h2 className="font-display text-3xl">كود اللعبة</h2>
          <div className="num my-2 text-5xl font-bold tracking-[0.2em]">{toAr(s.code)}</div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stroke">
            <QRCodeSVG value={link} size={200} fgColor="#0d2e1d" />
          </div>
        </div>
      </Modal>
      <Modal open={!!manual} onClose={() => setManual(null)} title="تعديل رصيد الفريق">
        {manual && (
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const current = s.teams.find((team) => team.id === manual.teamId)!
              if (
                await dispatch({
                  type: 'adjust',
                  teamId: manual.teamId,
                  delta: Number(manual.value) - current.score,
                })
              )
                setManual(null)
            }}
            className="pt-3"
          >
            <h2 className="font-display text-3xl">تعديل الرصيد</h2>
            <label htmlFor="manual-score" className="mt-4 block text-sm font-semibold">
              رصيد {s.teams.find((team) => team.id === manual.teamId)?.name}
            </label>
            <input
              id="manual-score"
              aria-label="الرصيد الجديد"
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
              disabled={
                busy || !connected || !manual.value || !Number.isInteger(Number(manual.value))
              }
              className="mt-5 h-12 w-full rounded-xl bg-forest font-bold text-ivory disabled:opacity-50"
            >
              حفظ الرصيد
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}

function Board({ s, host }: { s: Session; host: boolean }) {
  const { dispatch, connected, busy } = useStore()
  return (
    <div className="reveal mx-auto max-w-[1216px] px-3 pb-8 pt-4 md:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ivory">اختاروا التحدي… وورّونا شطارتكم</h1>
          <p className="mt-1 text-xs text-ivory/55">
            كل فريق يختار فئة وقيمة السؤال. المضيف يحسب النقط.
          </p>
        </div>
        <span className="rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs text-gold">
          اتلعب{' '}
          <span className="num">
            {toAr(s.questions.filter((q) => q.state === 'answered').length)}
          </span>{' '}
          من <span className="num">{toAr(s.questions.length)}</span>
        </span>
      </div>
      <div role="region" aria-label="لوحة الأسئلة">
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10">
          {s.categoryIds.map((cid, index) => {
            const cat = CATEGORIES.find((c) => c.id === cid)!
            const titleId = `board-category-${cid}`
            const artwork = BOARD_PHOTO[cid]
            const padding = BOARD_IMAGE_PADDING[cid]
            const visibleHeight = 941 - (padding?.top ?? 0) - (padding?.bottom ?? 0)
            const questions = s.questions
              .filter((question) => question.categoryId === cid)
              .sort((a, b) => a.row - b.row)
            return (
              <section
                key={cid}
                data-category-id={cid}
                aria-labelledby={titleId}
                className="min-w-0 space-y-3"
              >
                <header className="overflow-hidden rounded-[22px] bg-[#0c2a1d] shadow-[0_16px_40px_rgba(0,0,0,.3)] ring-1 ring-white/10">
                  <div className="flex aspect-[1672/941] items-center bg-[#0c2a1d]">
                    <div
                      className="relative w-full overflow-hidden"
                      style={{ aspectRatio: `1672 / ${visibleHeight}` }}
                    >
                      <img
                        src={artwork || PHOTO[cid]}
                        alt={cat.name}
                        width="1672"
                        height="941"
                        loading={index < 3 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                        className={`absolute inset-x-0 block w-full ${artwork ? 'object-contain' : 'object-cover'}`}
                        style={{
                          top: `${-((padding?.top ?? 0) / visibleHeight) * 100}%`,
                          height: `${(941 / visibleHeight) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <h2
                    id={titleId}
                    className="flex min-h-14 items-center justify-center border-t-2 border-gold/70 px-3 py-2 text-center font-display text-[28px] leading-tight text-ivory sm:text-[30px] lg:min-h-16 lg:text-[36px]"
                  >
                    {cat.name}
                  </h2>
                </header>
                <div className="grid grid-cols-2 gap-2.5">
                  {questions.map((q) => {
                    const done = q.state === 'answered'
                    return (
                      <motion.button
                        key={q.id}
                        data-question-id={q.id}
                        disabled={done || !host || busy || !connected}
                        onClick={() => dispatch({ type: 'openQuestion', id: q.id })}
                        whileHover={!done && host ? { y: -3 } : undefined}
                        whileTap={!done && host ? { scale: 0.97 } : undefined}
                        aria-label={`${cat.name} — السؤال ${toAr(q.row + 1)} بـ ${q.points} نقطة${done ? ' — تمت الإجابة' : ''}`}
                        className={`grid h-14 place-items-center rounded-2xl border text-[28px] font-bold transition-colors sm:h-[60px] lg:h-16 lg:text-[32px] ${
                          done
                            ? 'border-white/5 bg-white/5 text-ivory/30'
                            : 'border-stroke/70 bg-gradient-to-b from-[#fffdf8] to-[#f3e9d2] text-forest shadow-[0_8px_20px_rgba(0,0,0,.25)] hover:border-gold disabled:opacity-90'
                        }`}
                      >
                        {done ? (
                          <Check size={26} strokeWidth={2.6} />
                        ) : (
                          <span className="num">{q.points}</span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span />
        {host && (
          <button
            disabled={busy || !connected}
            onClick={() => dispatch({ type: 'finish' })}
            className="h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-ivory/80 transition hover:bg-white/10"
          >
            إنهاء اللعبة
          </button>
        )}
      </div>
    </div>
  )
}

function TimerRing({ compact }: { compact?: boolean }) {
  const { ms, t } = useTimerMs()
  if (!t) return null
  const secs = Math.ceil(ms / 1000)
  const frac = ms / t.durationMs
  const r = 70
  const c = 2 * Math.PI * r
  const low = t.status === 'running' && secs <= 5
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${
        compact
          ? 'h-[112px] w-[112px] sm:h-[150px] sm:w-[150px] lg:h-[200px] lg:w-[200px]'
          : 'h-[190px] w-[190px]'
      } ${low ? 'animate-pulse' : ''}`}
      role="timer"
      aria-label={`${secs} ثانية`}
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
        <div
          className={`num font-bold leading-none ${
            compact ? 'text-[40px] sm:text-[50px] lg:text-[68px]' : 'text-[60px]'
          }`}
        >
          {toAr(secs)}
        </div>
        <div className="mt-1 text-xs text-ivory/50">
          {t.status === 'idle'
            ? 'جاهز'
            : t.status === 'running'
              ? 'شغّال'
              : t.status === 'paused'
                ? 'واقف'
                : 'خلص الوقت'}
        </div>
      </div>
    </div>
  )
}

function QuestionFeedback({ sessionId, qid }: { sessionId: string; qid: string }) {
  const { state, dispatch } = useStore()
  const key = `${sessionId}:${qid}`
  const done = state.feedback[key]
  const vote = (v: 'like' | 'dislike') => {
    if (done) return
    dispatch({
      type: 'feedback',
      key,
      vote: v,
    })
  }
  const btn = (v: 'like' | 'dislike', Icon: typeof ThumbsUp, label: string, on: string) => (
    <motion.button
      whileHover={done ? undefined : { y: -2, scale: 1.06 }}
      whileTap={done ? undefined : { scale: 0.9 }}
      animate={
        done?.vote === v
          ? { scale: [1, 1.3, 1], rotate: [0, v === 'like' ? -14 : 14, 0] }
          : undefined
      }
      transition={{ duration: 0.5 }}
      onClick={() => vote(v)}
      disabled={!!done}
      aria-label={label}
      aria-pressed={done?.vote === v}
      className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${
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
    <div className="relative">
      <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#00241a]/75 p-1.5 ps-4 shadow-[0_10px_30px_rgba(0,0,0,.4)] backdrop-blur-md">
        {done ? (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-1 items-center gap-1.5 text-[14px] font-bold text-gold"
          >
            <Check size={16} /> شكرًا على رأيك!
          </motion.span>
        ) : (
          <span className="flex flex-1 items-center gap-2 text-[14px] font-semibold text-ivory/90">
            عجبك السؤال؟
          </span>
        )}
        {btn('like', ThumbsUp, 'عجبني السؤال', 'bg-[#2fae6b]')}
        {btn('dislike', ThumbsDown, 'ما عجبنيش السؤال', 'bg-[#e0553f]')}
      </div>
    </div>
  )
}

function QuestionView({ s, host }: { s: Session; host: boolean }) {
  const { dispatch, busy, connected } = useStore()
  const { t } = useTimerMs()
  const q = s.questions.find((x) => x.id === s.activeQuestionId)!
  const cat = CATEGORIES.find((c) => c.id === q.categoryId)!
  const revealed = s.phase === 'answer'
  const imageQuestion = q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM'
  const audioQuestion =
    q.type === 'AUDIO_GUESS' || q.type === 'AUDIO_REVERSE' || q.type === 'AUDIO_VOICE'
  const partyImage =
    q.type === 'IMAGE_PERSON' ||
    q.type === 'IMAGE_COLOR' ||
    q.type === 'IMAGE_RIDDLE' ||
    q.type === 'IMAGE_MEMORY'
  const memoryWaiting = q.type === 'IMAGE_MEMORY' && q.memoryPhase !== 'recall'
  const photo = q.categoryId === 'football' ? FOOTBALL_Q[q.row] : QUESTION_PLACEHOLDER
  const [helpOpen, setHelpOpen] = useState(false)
  const disabled = busy || !connected
  const ctl =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-[15px] font-bold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-14 sm:text-[17px]'
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26 }}
        className={`mx-auto grid w-full max-w-[1240px] gap-4 px-4 pb-5 pt-4 sm:min-h-[calc(100dvh-118px)] sm:items-center sm:gap-7 sm:px-6 lg:gap-10 ${
          q.type === 'STANDARD'
            ? 'sm:grid-cols-[minmax(0,40%)_1fr] lg:grid-cols-[minmax(0,34%)_1fr]'
            : 'sm:grid-cols-[minmax(0,48%)_1fr]'
        }`}
      >
        <div className="relative min-w-0">
          {partyImage ? (
            <PartyQuestion question={q} host={host} revealed={revealed} />
          ) : audioQuestion ? (
            <div className="h-[260px] sm:h-[min(66dvh,640px)]">
              <QuestionAudio question={q} sessionId={s.id} host={host} revealed={revealed} />
            </div>
          ) : (
            <div
              className={`relative overflow-hidden rounded-[24px] border border-white/15 bg-deep shadow-[0_24px_60px_rgba(0,0,0,.45)] ${
                imageQuestion
                  ? 'h-[clamp(180px,29dvh,270px)] sm:h-[min(68dvh,680px)]'
                  : 'h-[clamp(150px,26dvh,260px)] sm:h-[min(68dvh,680px)]'
              }`}
            >
              <img
                key={imageQuestion ? q.imageUrl + revealed : q.id}
                src={
                  imageQuestion
                    ? revealed
                      ? q.answer?.imageUrl || q.imageUrl
                      : q.imageUrl
                    : photo.src
                }
                alt={revealed ? q.answer?.text || '' : 'صورة السؤال'}
                className={`absolute inset-0 h-full w-full ${
                  imageQuestion ? 'object-contain' : 'object-cover'
                }`}
                style={imageQuestion ? undefined : { objectPosition: photo.pos }}
              />
              {!imageQuestion && (
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#00241a]/70 to-transparent" />
              )}
              {q.type === 'STANDARD' && (
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
                  <QuestionFeedback sessionId={s.id} qid={q.id} />
                </div>
              )}
            </div>
          )}
          {imageQuestion && !revealed && (
            <div className="glass mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div
                className="flex items-center gap-2"
                aria-label={`المرحلة ${q.stageIndex + 1} من ٣`}
              >
                {q.pointStages.map((points, i) => (
                  <span
                    key={i}
                    className={`num rounded-lg px-2.5 py-1 text-sm font-bold ${
                      i === q.stageIndex
                        ? 'bg-gold text-forest'
                        : i < q.stageIndex
                          ? 'text-ivory/35 line-through'
                          : 'bg-white/10 text-ivory/70'
                    }`}
                  >
                    {points}
                  </span>
                ))}
              </div>
              {host && (
                <button
                  onClick={() => dispatch({ type: 'advanceStage' })}
                  disabled={disabled || q.stageIndex >= 2}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold/20 px-3 text-sm font-bold text-gold transition hover:bg-gold/30 disabled:opacity-45"
                >
                  <Eye size={17} />
                  {q.stageIndex >= 2
                    ? 'آخر توضيح'
                    : q.type === 'IMAGE_BLUR'
                      ? 'وضح الصورة'
                      : 'وسع الصورة'}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-forest"
              style={{ background: cat.accent }}
            >
              {cat.name}
            </span>
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
              {MODE_LABELS[q.type]}
            </span>
            <button
              onClick={() => setHelpOpen(true)}
              aria-label="مساعدة"
              className="ms-auto grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/5 text-ivory transition hover:bg-white/15"
            >
              <CircleHelp size={19} />
            </button>
          </div>
          <h1 className="font-display text-[clamp(28px,3.8vw,56px)] leading-[1.25] text-ivory text-balance">
            {q.prompt}
          </h1>
          {partyImage && (
            <p className="-mt-2 text-sm leading-7 text-ivory/60">
              {q.type === 'IMAGE_MEMORY'
                ? 'شوفوا الصورة مع بعض، وبعد ما تختفي اتفقوا على الإجابة.'
                : cat.instruction}
            </p>
          )}
          <div className="flex items-baseline gap-2" aria-live="polite">
            <span className="num text-4xl font-bold text-gold sm:text-5xl">
              {q.availablePoints}
            </span>
            <span className="text-sm font-semibold text-ivory/55">
              نقطة{imageQuestion && !revealed ? ' متاحة' : ''}
            </span>
          </div>
          <AnimatePresence>
            {revealed && q.answer && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[20px] bg-gradient-to-br from-gold to-[#c98a14] px-5 py-4 text-forest shadow-[0_16px_40px_rgba(231,167,43,.3)]"
              >
                <div className="text-xs font-semibold text-forest/60">الإجابة</div>
                <div className="mt-1 font-display text-[clamp(28px,3.5vw,44px)] leading-tight">
                  {q.answer.text}
                </div>
                {q.type === 'IMAGE_COLOR' && (
                  <span
                    className="mt-3 inline-block h-9 w-16 rounded-xl border-2 border-forest/25 shadow-sm"
                    style={{ background: q.colorHex }}
                    aria-label="اللون الأصلي"
                  />
                )}
                {q.answer.forwardAudioUrl && host && (
                  <audio
                    controls
                    controlsList="nodownload"
                    src={q.answer.forwardAudioUrl}
                    className="mt-3 h-10 w-full"
                    aria-label="الكلام الأصلي بعد كشف الإجابة"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {!revealed && (
            <div className="flex items-center gap-3 max-[360px]:flex-col sm:gap-5">
              <TimerRing compact />
              {host && (
                <div className="grid min-w-0 flex-1 gap-2 max-[360px]:w-full">
                  <button
                    disabled={disabled || memoryWaiting}
                    onClick={() =>
                      dispatch({
                        type: 'timer',
                        op: t?.status === 'running' ? 'pause' : 'start',
                      })
                    }
                    className={`${ctl} ${t?.status === 'running' ? 'bg-white/10 text-ivory' : 'bg-gold text-forest'}`}
                  >
                    {t?.status === 'running' ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} fill="currentColor" />
                    )}
                    {t?.status === 'running' ? 'وقّف الوقت' : 'ابدأ الوقت'}
                  </button>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      disabled={disabled || memoryWaiting}
                      onClick={() => dispatch({ type: 'reveal' })}
                      className={`${ctl} btn-play whitespace-nowrap`}
                    >
                      <Eye size={18} /> إظهار الإجابة
                    </button>
                    <button
                      disabled={disabled || memoryWaiting}
                      onClick={() => dispatch({ type: 'timer', op: 'reset' })}
                      aria-label="إعادة الوقت"
                      className={`${ctl} w-12 border border-white/15 !px-0 text-ivory/85 hover:bg-white/5 sm:w-14`}
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {host && revealed && (
            <div className="grid gap-2.5">
              <p className="font-display text-2xl">مين جاوب صح؟</p>
              <div className="grid grid-cols-2 gap-2">
                {s.teams.map((team, i) => (
                  <button
                    key={team.id}
                    disabled={disabled}
                    onClick={() =>
                      dispatch({
                        type: 'award',
                        questionId: q.id,
                        teamId: team.id,
                      })
                    }
                    className={ctl}
                    style={{ background: TEAM_COLORS[i], color: '#0d2e1d' }}
                  >
                    <span className="truncate">{team.name}</span>
                    <span className="num text-sm">+{q.availablePoints}</span>
                  </button>
                ))}
              </div>
              <button
                disabled={disabled}
                onClick={() => dispatch({ type: 'award', questionId: q.id, teamId: null })}
                className={`${ctl} border border-white/20 text-ivory hover:bg-white/5`}
              >
                <X size={17} /> ولا حد
              </button>
            </div>
          )}
          {host && !revealed && (
            <div className="flex items-center justify-between">
              <button
                disabled={disabled || q.audioIsPlaying}
                onClick={() => dispatch({ type: 'backToBoard' })}
                className="min-h-11 text-xs text-ivory/55 hover:underline disabled:opacity-40"
              >
                رجوع للوحة
              </button>
              {q.type !== 'STANDARD' && (
                <button
                  disabled={disabled || memoryWaiting}
                  onClick={() => dispatch({ type: 'reveal' })}
                  className="min-h-11 text-xs text-ivory/55 hover:underline"
                >
                  استسلام
                </button>
              )}
            </div>
          )}
          {!host && <p className="text-xs text-ivory/55">المضيف بيتحكم في الوقت والإجابة.</p>}
        </div>
      </motion.div>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="مساعدة">
        <div className="pt-3">
          <h2 className="font-display text-3xl">{MODE_LABELS[q.type]}</h2>
          <p className="mt-3 text-sm leading-7 text-forest/75">
            {partyImage || q.type === 'AUDIO_VOICE'
              ? cat.help
              : 'ابدأوا الوقت، وخمنوا مع بعض. المضيف بيكشف الإجابة ويحسب النقط.'}
            {imageQuestion
              ? ' كل توضيح بيقلل النقط.'
              : audioQuestion
                ? ` الصوت متاح ${toAr(q.maxPlays)} مرات للشلة كلها.`
                : ''}
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
          transition={{
            duration: 2.2 + (i % 5) * 0.2,
            ease: [0.2, 0.8, 0.3, 1],
          }}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ background: colors[i % 5] }}
        />
      ))}
    </div>
  )
}

function Winner({ s, host }: { s: Session; host: boolean }) {
  const { state, dispatch, busy } = useStore()
  const nav = useNavigate()
  const [a, b] = s.teams
  const tie = a.score === b.score
  const win = a.score > b.score ? a : b
  return (
    <div className="reveal relative mx-auto flex min-h-[80dvh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      {!tie && <Confetti />}
      <img src={LOGO.bubble} alt="" aria-hidden className="mb-4 h-24 w-auto" />
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-gold/25 blur-3xl" />
        <Trophy size={72} strokeWidth={1.3} className="text-gold" />
      </div>
      <h1 className="mt-4 font-display text-[clamp(48px,9vw,96px)] leading-none">
        {tie ? 'تعادل!' : `مبروك يا ${win.name}!`}
      </h1>
      <div className="mt-10 grid w-full grid-cols-2 gap-4">
        {s.teams.map((t, i) => (
          <div
            key={t.id}
            className={`rounded-[22px] p-6 ${
              !tie && win.id === t.id
                ? 'bg-gradient-to-b from-gold to-[#c98a14] text-forest'
                : 'glass'
            }`}
          >
            <div className="text-sm opacity-70">{t.name}</div>
            <RollingNumber value={t.score} className="text-[64px] font-bold leading-none" />
            <span className="sr-only">{i}</span>
          </div>
        ))}
      </div>
      {host ? (
        <div className="mt-10 w-full">
          <p className="mb-4 text-sm text-ivory/65">
            كل لعبة جديدة بتكلف ١ توكن · رصيدك {toAr(state.tokens)} توكن
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              disabled={busy}
              onClick={() =>
                state.tokens < 1
                  ? nav('/tokens?returnTo=' + encodeURIComponent(`/game/${s.id}/results`))
                  : dispatch({ type: 'replay', newCategories: false })
              }
              className="btn-play h-16 rounded-2xl px-10 text-[22px] font-bold"
            >
              {state.tokens >= 1 ? 'العبوا مرة تانية' : 'اشتري توكن للعبة جديدة'}
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'replay', newCategories: true })
                nav('/play')
              }}
              className="h-16 rounded-2xl border border-white/20 px-8 text-lg font-semibold text-ivory hover:bg-white/5"
            >
              فئات جديدة
            </button>
          </div>
        </div>
      ) : (
        <Link to="/play" className="mt-10 text-gold underline">
          العب لعبتك
        </Link>
      )}
    </div>
  )
}

export default function GamePage() {
  const { state, isHost, connected } = useStore()
  const { sessionId } = useParams()
  const nav = useNavigate()
  const s = state.session
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
        <h1 className="font-display text-4xl">الشلة بتتجمع</h1>
        <p className="text-sm text-ivory/60">المضيف هيبدأ اللعبة حالًا</p>
        <div className="glass num rounded-2xl px-8 py-4 text-4xl tracking-widest text-gold">
          {toAr(s.code)}
        </div>
        {isHost && (
          <Link to="/play?step=room" className="btn-play rounded-xl px-6 py-3">
            ابدأ اللعبة
          </Link>
        )}
      </div>
    )

  if (!s || s.id !== sessionId) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-5xl">
            {connected ? 'ثانية واحدة…' : 'اللعبة مش موجودة'}
          </h1>
          <Link
            to="/play"
            className="btn-play mt-8 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold"
          >
            العب الآن
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-dvh">
      {!connected && (
        <div role="status" className="bg-gold/20 px-4 py-2 text-center text-xs">
          الاتصال اتقطع — بنحاول نرجع…
        </div>
      )}
      {s.phase !== 'finished' && <ScoreBar s={s} host={isHost} />}
      <AnimatePresence mode="wait">
        {s.phase === 'board' && <Board key="b" s={s} host={isHost} />}
        {(s.phase === 'question' || s.phase === 'answer') && s.activeQuestionId && (
          <QuestionView key={s.activeQuestionId} s={s} host={isHost} />
        )}
        {s.phase === 'finished' && <Winner key="w" s={s} host={isHost} />}
      </AnimatePresence>
    </div>
  )
}
