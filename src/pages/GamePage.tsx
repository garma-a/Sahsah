import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleHelp, Coins, Eye, ThumbsDown, ThumbsUp, Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, SlidersHorizontal, UserPlus, X, Trophy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { CATEGORIES, toAr } from '../lib/data'
import { useStore, type Session, type Team } from '../lib/store'
import { Logo, Poster } from '../components/art'
import { Modal, RollingNumber, useTimerMs } from '../components/ui'
import { LOGO, FOOTBALL_Q, QUESTION_PLACEHOLDER } from '../lib/images'

const TEAM_COLORS = ['#e7a72b', '#6fd3a0']

function ScoreBar({ s, host }: { s: Session; host: boolean }) {
  const { dispatch } = useStore()
  const [full, setFull] = useState(!!document.fullscreenElement)
  const [edit, setEdit] = useState(false)
  const [invite, setInvite] = useState(false)
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())
  const link = `${location.origin}/join/${s.code}`
  const team = (t: Team, i: number) => (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-black/25 px-4 py-2.5" style={{ boxShadow: `inset 0 0 0 1px ${TEAM_COLORS[i]}33` }}>
      <span className="h-9 w-1.5 rounded-full" style={{ background: TEAM_COLORS[i] }} />
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ivory/60">{t.name}</div>
        <RollingNumber value={t.score} className="block text-[34px] font-bold leading-none text-ivory md:text-[42px]" />
      </div>
      {host && edit && (
        <div className="ms-auto flex gap-1">
          <button aria-label={`خصم ١٠٠ من ${t.name}`} onClick={() => dispatch({ type: 'adjust', teamId: t.id, delta: -100 })} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><Minus size={18} /></button>
          <button aria-label={`إضافة ١٠٠ لـ${t.name}`} onClick={() => dispatch({ type: 'adjust', teamId: t.id, delta: 100 })} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><Plus size={18} /></button>
        </div>
      )}
    </div>
  )
  const btn = 'grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-ivory transition hover:bg-white/20'
  return (
    <div className="mx-auto flex max-w-[1216px] items-center gap-2 px-3 pt-3 md:gap-4 md:px-8">
      <Link to="/play" aria-label="خروج" className="hidden md:block"><Logo size={40} mark /></Link>
      {team(s.teams[0], 0)}
      {team(s.teams[1], 1)}
      <div className="flex gap-1.5">
        <button onClick={() => setInvite(true)} className={btn} aria-label="دعوة"><UserPlus size={18} /></button>
        {host && <button onClick={() => setEdit((e) => !e)} className={`${btn} ${edit ? '!bg-gold !text-forest' : ''}`} aria-label="تعديل النقاط" aria-pressed={edit}><SlidersHorizontal size={18} /></button>}
        <button onClick={toggle} className={`${btn} hidden sm:grid`} aria-label="ملء الشاشة">{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
      </div>
      <Modal open={invite} onClose={() => setInvite(false)} title="دعوة">
        <div className="flex flex-col items-center pt-4 text-center">
          <h2 className="font-display text-3xl">كود اللعبة</h2>
          <div className="num my-2 text-5xl font-bold tracking-[0.2em]">{toAr(s.code)}</div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-stroke"><QRCodeSVG value={link} size={200} fgColor="#0d2e1d" /></div>
        </div>
      </Modal>
    </div>
  )
}

function Board({ s, host }: { s: Session; host: boolean }) {
  const { dispatch } = useStore()
  return (
    <div className="reveal mx-auto max-w-[1216px] px-3 pb-8 pt-4 md:px-8">
      <div className="overflow-x-auto pb-2" role="region" aria-label="لوحة الأسئلة" tabIndex={0}>
        <div className="grid min-w-[760px] grid-cols-6 gap-2.5 md:gap-3">
          {s.categoryIds.map((cid) => {
            const cat = CATEGORIES.find((c) => c.id === cid)!
            return (
              <Poster key={cid} cat={cat} ratio="aspect-[3/2]" titleClass="text-[17px] md:text-[21px]" boxClass="min-h-0" className="rounded-2xl" />
            )
          })}
          {[0, 1, 2, 3, 4, 5].flatMap((row) =>
            s.categoryIds.map((cid) => {
              const q = s.questions.find((x) => x.categoryId === cid && x.row === row)!
              const done = q.state === 'answered'
              return (
                <motion.button
                  key={q.id}
                  disabled={done || !host}
                  onClick={() => dispatch({ type: 'openQuestion', id: q.id })}
                  whileHover={!done && host ? { y: -3 } : undefined}
                  whileTap={!done && host ? { scale: 0.97 } : undefined}
                  aria-label={done ? `${q.points} — تمت الإجابة` : `سؤال بـ ${q.points} نقطة`}
                  className={`grid h-[68px] place-items-center rounded-2xl border text-[30px] font-bold transition-colors md:h-[78px] ${
                    done ? 'border-white/5 bg-white/5 text-ivory/30' : 'border-stroke/70 bg-gradient-to-b from-[#fffdf8] to-[#f3e9d2] text-forest shadow-[0_8px_20px_rgba(0,0,0,.25)] hover:border-gold disabled:opacity-90'
                  }`}
                >
                  {done ? <Check size={26} strokeWidth={2.6} /> : <span className="num">{q.points}</span>}
                </motion.button>
              )
            }),
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span />
        {host && <button onClick={() => dispatch({ type: 'finish' })} className="h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-ivory/80 transition hover:bg-white/10">إنهاء اللعبة</button>}
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
    <div className={`relative grid shrink-0 place-items-center ${compact ? 'h-[112px] w-[112px] sm:h-[150px] sm:w-[150px] lg:h-[200px] lg:w-[200px]' : 'h-[190px] w-[190px]'} ${low ? 'animate-pulse' : ''}`} role="timer" aria-label={`${secs} ثانية`}>
      <svg viewBox="0 0 170 170" className="absolute inset-0 -rotate-90">
        <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
        <circle cx="85" cy="85" r={r} fill="none" stroke={low ? '#d9342b' : '#e7a72b'} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="text-center">
        <div className={`num font-bold leading-none ${compact ? 'text-[40px] sm:text-[50px] lg:text-[68px]' : 'text-[60px]'}`}>{toAr(secs)}</div>
        <div className="mt-1 text-xs text-ivory/50">{t.status === 'idle' ? 'جاهز' : t.status === 'running' ? 'شغّال' : t.status === 'paused' ? 'واقف' : 'خلص الوقت'}</div>
      </div>
    </div>
  )
}

function QuestionFeedback({ sessionId, qid }: { sessionId: string; qid: string }) {
  const { state, dispatch } = useStore()
  const key = `${sessionId}:${qid}`
  const done = state.feedback[key]
  const [burst, setBurst] = useState<'like' | 'dislike' | null>(null)
  const vote = (v: 'like' | 'dislike') => {
    if (done) return
    setBurst(v)
    dispatch({ type: 'feedback', key, vote: v, reward: 5 + Math.floor(Math.random() * 6) })
  }
  const btn = (v: 'like' | 'dislike', Icon: typeof ThumbsUp, label: string, on: string) => (
    <motion.button
      whileHover={done ? undefined : { y: -2, scale: 1.06 }}
      whileTap={done ? undefined : { scale: 0.9 }}
      animate={done?.vote === v ? { scale: [1, 1.3, 1], rotate: [0, v === 'like' ? -14 : 14, 0] } : undefined}
      transition={{ duration: 0.5 }}
      onClick={() => vote(v)}
      disabled={!!done}
      aria-label={label}
      aria-pressed={done?.vote === v}
      className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${done?.vote === v ? `${on} border-transparent text-white` : done ? 'border-white/10 text-white/30' : 'border-white/25 bg-white/10 text-white hover:bg-white/20'}`}
    >
      <Icon size={20} strokeWidth={2.2} fill={done?.vote === v ? 'currentColor' : 'none'} />
    </motion.button>
  )
  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#00241a]/75 p-1.5 ps-4 shadow-[0_10px_30px_rgba(0,0,0,.4)] backdrop-blur-md">
        {done ? (
          <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex flex-1 items-center gap-1.5 text-[14px] font-bold text-gold">
            <Coins size={16} /> شكرًا! <span className="num">+{toAr(done.reward)}</span> عملة
          </motion.span>
        ) : (
          <span className="flex flex-1 items-center gap-2 text-[14px] font-semibold text-ivory/90">
            عجبك السؤال؟
            <span className="num rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">+{toAr(5)}–{toAr(10)} عملة</span>
          </span>
        )}
        {btn('like', ThumbsUp, 'عجبني السؤال', 'bg-[#2fae6b]')}
        {btn('dislike', ThumbsDown, 'ما عجبنيش السؤال', 'bg-[#e0553f]')}
      </div>
      <AnimatePresence>
        {burst && (
          <motion.div key={burst + key} className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <motion.span
                key={i}
                initial={{ y: 0, x: 0, scale: 0.4, opacity: 1 }}
                animate={{ y: -50 - (i % 4) * 14, x: (i - 4.5) * 14, scale: 1, opacity: 0 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                className="absolute bottom-0 h-2.5 w-2.5 rounded-full"
                style={{ background: ['#e7a72b', '#6fd3a0', '#ff8fb1', '#fffdf8'][i % 4] }}
              />
            ))}
            <motion.span initial={{ y: 0, scale: 0.6 }} animate={{ y: -34, scale: 1.1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="num absolute bottom-0 font-display text-3xl text-gold drop-shadow-lg">
              +{toAr(state.feedback[key]?.reward ?? 0)}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QuestionView({ s, host }: { s: Session; host: boolean }) {
  const { dispatch } = useStore()
  const { t, ms } = useTimerMs()
  const q = s.questions.find((x) => x.id === s.activeQuestionId)!
  const cat = CATEGORIES.find((c) => c.id === q.categoryId)!
  const revealed = s.phase === 'answer'
  const photo = q.categoryId === 'football' ? FOOTBALL_Q[q.row] : QUESTION_PLACEHOLDER
  const [helpOpen, setHelpOpen] = useState(false)
  useEffect(() => {
    if (host && t?.status === 'running' && ms <= 0) dispatch({ type: 'timer', op: 'expire' })
  }, [ms, t?.status, host, dispatch])
  const ctl = 'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[16px] font-bold transition active:scale-[0.98] sm:h-14 sm:text-[17px]'

  const chips = (
    <div className="flex items-center gap-2.5">
      <span className="rounded-full px-3.5 py-1 text-sm font-semibold text-forest" style={{ background: cat.accent }}>{cat.name}</span>
      <span className="num rounded-full border border-gold/40 px-3.5 py-0.5 text-base font-bold text-gold sm:text-lg">{q.points}</span>
      <button onClick={() => setHelpOpen(true)} className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-ivory transition hover:bg-white/15 sm:h-11">
        <CircleHelp size={18} /> مساعدة
      </button>
    </div>
  )
  const prompt = (
    <h1 className={`font-display leading-[1.3] text-balance text-[clamp(24px,3.4vw,56px)]`}>{q.prompt}</h1>
  )
  const answer = (
    <AnimatePresence>
      {revealed && (
        <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }} className="rounded-[20px] bg-gradient-to-br from-gold to-[#c98a14] px-5 py-3 text-forest shadow-[0_16px_40px_rgba(231,167,43,.3)] sm:py-4">
          <div className="text-xs font-bold opacity-70 sm:text-sm">الإجابة</div>
          <div className="font-display text-[clamp(30px,4vw,44px)] leading-tight">{q.correctAnswer}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
  const actions = host && !revealed ? (
    <div className="grid min-w-0 flex-1 gap-2 sm:max-w-[320px] sm:gap-3 lg:max-w-[380px]">
      {t?.status === 'running' ? (
        <button onClick={() => dispatch({ type: 'timer', op: 'pause' })} className={`${ctl} bg-white/10 text-ivory hover:bg-white/15`}><Pause size={18} /> وقّف</button>
      ) : (
        <button onClick={() => dispatch({ type: 'timer', op: 'start' })} className={`${ctl} bg-gold text-forest hover:brightness-105`}><Play size={18} fill="currentColor" /> ابدأ الوقت</button>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:gap-3">
        <button onClick={() => dispatch({ type: 'reveal' })} className={`${ctl} btn-play whitespace-nowrap px-3`}><Eye size={18} /> إظهار الإجابة</button>
        <button onClick={() => dispatch({ type: 'timer', op: 'reset' })} aria-label="إعادة الوقت" title="إعادة الوقت" className={`${ctl} border border-white/15 px-0 text-ivory/85 hover:bg-white/5 w-12 sm:w-14`}><RotateCcw size={18} /></button>
      </div>
    </div>
  ) : null
  const award = host && revealed ? (
    <div className="grid w-full max-w-[520px] gap-2 sm:gap-3">
      <div className="font-display text-2xl sm:text-3xl">مين جاوب صح؟</div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {s.teams.map((tm, i) => (
          <button key={tm.id} onClick={() => dispatch({ type: 'award', questionId: q.id, teamId: tm.id })} className={ctl} style={{ background: TEAM_COLORS[i], color: '#0d2e1d' }}>
            <Trophy size={18} /> <span className="truncate">{tm.name}</span>
          </button>
        ))}
      </div>
      <button onClick={() => dispatch({ type: 'award', questionId: q.id, teamId: null })} className={`${ctl} h-11 border border-white/20 text-ivory hover:bg-white/5 sm:h-12`}><X size={18} /> ولا حد</button>
    </div>
  ) : null
  const back = host && !revealed ? <button onClick={() => dispatch({ type: 'backToBoard' })} className="text-sm text-ivory/50 underline-offset-4 hover:text-ivory hover:underline">رجوع للوحة</button> : null
  const guestNote = !host ? <p className="text-sm text-ivory/55">المضيف بيتحكم في الوقت والإجابة.</p> : null
  const wrap = 'mx-auto w-full px-4 pb-4 sm:px-6'

  return (
    <>
      <motion.div key="q" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }} className={`${wrap} flex max-w-[1240px] flex-col gap-3 pt-2 sm:grid sm:h-[calc(100dvh-118px)] sm:min-h-[420px] sm:grid-cols-[minmax(0,40%)_1fr] sm:gap-6 lg:grid-cols-[minmax(0,34%)_1fr] lg:gap-10`}>
        <div className="relative h-[clamp(150px,26dvh,260px)] w-full overflow-hidden rounded-[22px] border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,.45)] sm:h-full">
          <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: photo.pos }} />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#00241a]/70 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4"><QuestionFeedback sessionId={s.id} qid={q.id} /></div>
        </div>
        <div className="flex min-h-0 flex-col justify-center gap-3 sm:gap-5">
          {chips}
          {prompt}
          {answer}
          {!revealed && (
            <div className="flex items-center gap-3 sm:gap-6">
              <TimerRing compact />
              {actions}
            </div>
          )}
          {award}
          {back}
          {guestNote}
        </div>
      </motion.div>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="مساعدة">
        <div className="pt-2">
          <h2 className="font-display text-3xl">{cat.name}</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-forest/80">{cat.help}</p>
          <div className="mt-4 rounded-xl bg-gold/15 p-4 text-[15px]"><span className="text-xs font-bold text-forest/50">مثال</span><br />{cat.example}</div>
          <ul className="mt-4 space-y-2 text-[15px] text-forest/80">
            <li>١. المضيف يدوس «ابدأ الوقت» والفريقين يفكروا ٣٠ ثانية.</li>
            <li>٢. المضيف يدوس «إظهار الإجابة» لما يخلص الوقت.</li>
            <li>٣. المضيف يختار الفريق اللي جاوب صح وياخد النقط.</li>
          </ul>
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
          animate={{ x: `${(Math.sin(i * 12.9) * 0.5 + 0.5) * 100}vw`, y: `${95 + (i % 5) * 4}vh`, opacity: [1, 1, 0], rotate: 360 * ((i % 3) + 1) }}
          transition={{ duration: 2.2 + (i % 5) * 0.2, ease: [0.2, 0.8, 0.3, 1] }}
          className="absolute h-3 w-2 rounded-[2px]"
          style={{ background: colors[i % 5] }}
        />
      ))}
    </div>
  )
}

function Winner({ s, host }: { s: Session; host: boolean }) {
  const { dispatch } = useStore()
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
      <h1 className="mt-4 font-display text-[clamp(48px,9vw,96px)] leading-none">{tie ? 'تعادل!' : `مبروك يا ${win.name}!`}</h1>
      <div className="mt-10 grid w-full grid-cols-2 gap-4">
        {s.teams.map((t, i) => (
          <div key={t.id} className={`rounded-[22px] p-6 ${!tie && win.id === t.id ? 'bg-gradient-to-b from-gold to-[#c98a14] text-forest' : 'glass'}`}>
            <div className="text-sm opacity-70">{t.name}</div>
            <RollingNumber value={t.score} className="text-[64px] font-bold leading-none" />
            <span className="sr-only">{i}</span>
          </div>
        ))}
      </div>
      {host ? (
        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => dispatch({ type: 'replay', newCategories: false })} className="btn-play h-16 rounded-2xl px-10 text-[22px] font-bold">العبوا مرة تانية</button>
          <button onClick={() => { dispatch({ type: 'replay', newCategories: true }); nav('/play') }} className="h-16 rounded-2xl border border-white/20 px-8 text-lg font-semibold hover:bg-white/5">فئات جديدة</button>
        </div>
      ) : <Link to="/play" className="mt-10 text-gold underline">العب لعبتك</Link>}
    </div>
  )
}

export default function GamePage() {
  const { state, isHost } = useStore()
  const { sessionId } = useParams()
  const nav = useNavigate()
  const s = state.session
  useEffect(() => {
    if (!s || s.id !== sessionId) return
    const url = s.phase === 'question' || s.phase === 'answer' ? `/game/${s.id}/question/${s.activeQuestionId}${s.phase === 'answer' ? '?answer=1' : ''}` : s.phase === 'finished' ? `/game/${s.id}/results` : `/game/${s.id}`
    if (location.pathname + location.search !== url) nav(url, { replace: true })
  }, [s, sessionId, nav])

  if (!s || s.id !== sessionId || s.phase === 'lobby') {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-5xl">اللعبة مش موجودة</h1>
          <Link to="/play" className="btn-play mt-8 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold">العب الآن</Link>
        </div>
      </div>
    )
  }
  return (
    <div>
      {s.phase !== 'finished' && <ScoreBar s={s} host={isHost} />}
      <AnimatePresence mode="wait">
        {s.phase === 'board' && <Board key="b" s={s} host={isHost} />}
        {(s.phase === 'question' || s.phase === 'answer') && s.activeQuestionId && <QuestionView key="q" s={s} host={isHost} />}
        {s.phase === 'finished' && <Winner key="w" s={s} host={isHost} />}
      </AnimatePresence>
    </div>
  )
}
