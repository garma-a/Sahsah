import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Users,
  Copy,
  Sparkles,
  Flame,
  Gift,
  Plus,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { CATEGORIES, DEMO_CATEGORY_IDS, GIFT_DISCOUNT, SECTIONS, toAr } from '../lib/data'
import { DEMO_MODE } from '../lib/runtime'
import { useStore, type TeamMembers } from '../lib/store'
import { CategoryArt, Poster } from '../components/art'
import { PHOTO, LOGO } from '../lib/images'
import { Carousel, Modal } from '../components/ui'
import { useLang } from '../lib/i18n'

/** Marketing pop-up poster (Seen Jeem style). Set to false to rely on the hero banner only. */
const PROMO_POPUP = true
const POPUP_KEY = 'sahsah.promo-popup.seen'

function Ring({ n, size = 52 }: { n: number; size?: number }) {
  const r = size * 0.38
  const c = 2 * Math.PI * r
  const half = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={half} cy={half} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={size * 0.08} />
      <circle
        cx={half}
        cy={half}
        r={r}
        fill="none"
        stroke={n === 6 ? '#6fd3a0' : '#e7a72b'}
        strokeWidth={size * 0.08}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - n / 6)}
        transform={`rotate(-90 ${half} ${half})`}
        style={{ transition: 'stroke-dashoffset 300ms cubic-bezier(.22,1,.36,1)' }}
      />
      <text
        x={half}
        y={half + size * 0.12}
        textAnchor="middle"
        fontFamily="Reem Kufi"
        fontWeight="700"
        fontSize={size * 0.34}
        fill="#fffdf8"
      >
        {toAr(n)}
      </text>
    </svg>
  )
}

function CategoryCard({ id, i }: { id: string; i: number }) {
  const { state, dispatch } = useStore()
  const { t } = useLang()
  const [, setParams] = useSearchParams()
  const cat = CATEGORIES.find((c) => c.id === id)!
  const on = state.selected.includes(id)
  const full = state.selected.length >= 6 && !on
  const name = t(cat.name, cat.nameEn)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.18), duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      whileHover={full ? undefined : { y: -4 }}
      className="relative"
    >
      <button
        onClick={() => dispatch({ type: 'toggleCategory', id })}
        aria-pressed={on}
        aria-label={`${name}${on ? t(' — مختارة', ' — mo5tara') : ''}`}
        className={`group block w-full rounded-[16px] text-start transition-[box-shadow,opacity] duration-200 ${
          on
            ? 'shadow-[0_0_0_3px_#e7a72b,0_18px_40px_rgba(231,167,43,.25)]'
            : 'shadow-[0_0_0_1px_rgba(255,240,200,.16),0_10px_24px_rgba(0,0,0,.25)]'
        } ${full ? 'opacity-45' : ''}`}
      >
        <Poster
          cat={cat}
          selected={on}
          titleClass="text-[14px] min-[600px]:text-[18px] lg:text-[21px]"
          boxClass="min-h-[2.75rem] lg:min-h-[3rem]"
          className="rounded-[16px]"
        />
        {cat.fresh && !on && (
          <span className="absolute end-2 top-2 rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-forest">
            {t('جديد', 'Gdeed')}
          </span>
        )}
        <motion.span
          initial={false}
          animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-gold text-forest shadow-lg"
        >
          <Check size={18} strokeWidth={3} />
        </motion.span>
      </button>
      <button
        onClick={() => setParams({ help: id })}
        aria-label={t(`تفاصيل سريعة عن ${cat.name}`, `Tafaseel 3an ${cat.nameEn}`)}
        className="absolute start-0 top-0 grid h-11 w-11 place-items-center rounded-full text-white/80 transition hover:text-white"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-black/40 backdrop-blur">
          <CircleHelp size={16} />
        </span>
      </button>
    </motion.div>
  )
}

/** Team members: typed once here, shown again on the winners screen and in history. */
function MemberInput({
  members,
  onChange,
  color,
}: {
  members: string[]
  onChange: (next: string[]) => void
  color: string
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState('')
  const add = () => {
    const name = draft.trim().slice(0, 18)
    if (!name || members.length >= 8) return
    onChange([...members, name])
    setDraft('')
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {members.map((m, i) => (
          <span
            key={`${m}-${i}`}
            className="inline-flex h-9 items-center gap-1 rounded-full ps-3 pe-1 text-sm font-semibold text-forest"
            style={{ background: color }}
          >
            {m}
            <button
              onClick={() => onChange(members.filter((_, j) => j !== i))}
              aria-label={t(`شيل ${m}`, `Sheel ${m}`)}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/10"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          maxLength={18}
          placeholder={t('اسم لاعب (اختياري)', 'Esm la3eb (e5tyary)')}
          aria-label={t('أضف اسم لاعب', 'Daif esm la3eb')}
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-4 text-[15px] text-ivory outline-none placeholder:text-ivory/35 focus:border-gold"
        />
        <button
          onClick={add}
          disabled={!draft.trim() || members.length >= 8}
          aria-label={t('أضف', 'Daif')}
          className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}

function Lobby() {
  const { state, dispatch, isHost, busy } = useStore()
  const { t, ar } = useLang()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const s = state.session!
  const [names, setNames] = useState<[string, string]>([s.teams[0].name, s.teams[1].name])
  const [members, setMembers] = useState<TeamMembers>(state.teamMembers[s.id] ?? [[], []])
  const link = `${location.origin}/join/${s.code}`
  const [copied, setCopied] = useState(false)
  const Arrow = ar ? ArrowLeft : ArrowRight
  const cats = s.categoryIds.map((id) => CATEGORIES.find((c) => c.id === id)!).filter(Boolean)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  const saveMembers = (next: TeamMembers) => {
    setMembers(next)
    dispatch({ type: 'setMembers', sessionId: s.id, members: next })
  }
  const start = async () => {
    for (const idx of [0, 1] as const)
      if (!(await dispatch({ type: 'rename', idx, name: names[idx].trim() }))) return
    if (state.tokens < 1) return nav('/tokens?returnTo=' + encodeURIComponent('/play?step=room'))
    if (await dispatch({ type: 'startGame' })) nav(`/game/${s.id}`)
  }
  return (
    <section className="reveal mx-auto max-w-[1100px] pt-6">
      {/* The six chosen categories, large */}
      <p className="text-sm font-medium text-gold">{t('فئاتكم', 'Fe2atkom')}</p>
      <div className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3">
        {cats.map((cat) => (
          <Poster key={cat.id} cat={cat} titleClass="text-[13px] sm:text-[16px] lg:text-[18px]" boxClass="min-h-[2.5rem]" className="rounded-[14px]" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="glass rounded-[22px] p-6 md:p-8">
          <p className="text-sm font-medium text-gold">{t('الخطوة الأخيرة', 'El 5atwa el akheera')}</p>
          <h1 className="mt-1 font-display text-[40px] leading-tight">{t('سمّوا الفريقين', 'Sammo el fare2een')}</h1>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {s.teams.map((team, i) => (
              <div key={team.id}>
                <label className="block" htmlFor={`team-${i}`}>
                  <span className="mb-1.5 flex items-center gap-2 text-sm text-ivory/70">
                    <span className={`h-3 w-3 rounded-full ${i ? 'bg-[#6fd3a0]' : 'bg-gold'}`} />
                    {i ? t('الفريق الثاني', 'El fare2 el tany') : t('الفريق الأول', 'El fare2 el awel')}
                  </span>
                </label>
                <input
                  id={`team-${i}`}
                  value={names[i]}
                  maxLength={18}
                  onChange={(e) =>
                    setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)) as [string, string])
                  }
                  className="h-14 w-full rounded-2xl border border-white/15 bg-black/20 px-5 text-xl font-semibold text-ivory outline-none transition placeholder:text-ivory/30 focus:border-gold focus:bg-black/30"
                  placeholder={i ? t('الجدعان', 'El Ged3an') : t('الفراعنة', 'El Fara3na')}
                />
                <MemberInput
                  members={members[i]}
                  color={i ? '#6fd3a0' : '#e7a72b'}
                  onChange={(next) =>
                    saveMembers((i ? [members[0], next] : [next, members[1]]) as TeamMembers)
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-ivory/60">
            <Users size={16} />
            {s.guests.length
              ? t(
                  `${toAr(s.guests.length)} متصل: ${s.guests.map((g) => g.name).join('، ')}`,
                  `${s.guests.length} connected: ${s.guests.map((g) => g.name).join(', ')}`,
                )
              : t('لسه محدش دخل — ابعتوا الكود للشلة', 'Lessa ma7adsh da5al — eb3ato el code lel shella')}
          </div>
          <button
            disabled={!isHost || busy || names.some((name) => !name.trim())}
            onClick={start}
            className="btn-play sheen mt-6 flex h-[72px] w-full items-center justify-center gap-3 rounded-2xl text-[26px] font-bold"
          >
            {state.tokens >= 1 ? t('ابدأ اللعبة', 'Ebda2 el le3ba') : t('اشتري توكن وابدأ', 'Eshtery token w ebda2')}
            <Arrow size={24} strokeWidth={2.6} />
          </button>
          <p className="mt-2 text-center text-xs text-ivory/50">{t('اللعبة بتكلف ١ توكن', 'El le3ba btekallef 1 token')}</p>
        </div>
        <div className="paper flex flex-col items-center rounded-[22px] p-6 text-center">
          <p className="text-sm font-semibold text-forest/60">{t('كود اللعبة', 'Code el le3ba')}</p>
          <div className="num mt-1 text-[64px] font-bold leading-none tracking-[0.18em] text-forest">{toAr(s.code)}</div>
          <button
            onClick={() => setParams({ step: 'room', invite: '1' })}
            className="mt-5 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-stroke transition hover:scale-[1.02]"
            aria-label={t('كبّر الـQR', 'Kabbar el QR')}
          >
            <QRCodeSVG value={link} size={168} fgColor="#0d2e1d" bgColor="#ffffff" />
          </button>
          <p className="mt-4 text-sm text-forest/70">{t('ادخل بكود أو QR', 'Odkhol bel code aw el QR')}</p>
          <button
            onClick={copy}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-stroke bg-white px-5 text-sm font-semibold text-forest transition hover:border-gold"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('اتنسخ', 'Etnasa5') : t('انسخ الرابط', 'Ensa5 el link')}
          </button>
        </div>
      </div>
      <Modal open={params.get('invite') === '1'} onClose={() => setParams({ step: 'room' })} title={t('دعوة اللاعبين', 'Da3wet el la3eebeen')}>
        <div className="flex flex-col items-center pt-4 text-center">
          <h2 className="font-display text-3xl">{t('امسح وادخل', 'Emsa7 w odkhol')}</h2>
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stroke">
            <QRCodeSVG value={link} size={240} fgColor="#0d2e1d" />
          </div>
          <div className="num mt-4 text-5xl font-bold tracking-[0.2em]">{toAr(s.code)}</div>
        </div>
      </Modal>
    </section>
  )
}

function PromoPopup() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!PROMO_POPUP) return
    try {
      if (sessionStorage.getItem(POPUP_KEY)) return
    } catch {
      return
    }
    const id = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(id)
  }, [])
  const close = () => {
    setOpen(false)
    try {
      sessionStorage.setItem(POPUP_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  const discount = toAr(Math.round(GIFT_DISCOUNT * 100))
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] grid place-items-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={t('عرض', '3ard')}
        >
          <div className="absolute inset-0 bg-[#00110c]/75 backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ scale: 0.9, rotate: -2 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative aspect-[210/297] w-[min(86vw,380px)] overflow-hidden rounded-[22px] border-4 border-gold shadow-[0_30px_80px_rgba(0,0,0,.6)]"
          >
            <img src={PHOTO.coins} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a2a1c] via-[#0a2a1c]/50 to-transparent" />
            <button
              onClick={close}
              aria-label={t('إغلاق', 'E2fel')}
              className="absolute end-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-deep/80 text-ivory"
            >
              <X size={20} />
            </button>
            <div className="absolute inset-x-0 bottom-0 p-6 text-center">
              <span className="rounded-full bg-play px-4 py-1.5 text-sm font-bold text-white">
                {t(`خصم ${discount}٪`, `${discount}% off`)}
              </span>
              <p className="mt-4 font-display text-[40px] leading-none">{t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba')}</p>
              <Link
                to="/tokens?tab=gift"
                onClick={close}
                className="btn-play mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl text-xl font-bold"
              >
                <Gift size={20} /> {t('اهدي دلوقتي', 'Ehdy delwa2ty')}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Banner({
  image,
  position = 'object-left',
  kicker,
  title,
  children,
}: {
  image: string
  position?: string
  kicker: string
  title: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-gold/20 bg-[#0a2a1c] shadow-[0_30px_80px_rgba(0,0,0,.45)]">
      <img src={image} alt="" fetchPriority="high" className={`absolute inset-0 h-full w-full object-cover ${position}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a2a1c]/90 via-[#0a2a1c]/45 to-transparent md:bg-none" aria-hidden />
      <div className="relative flex min-h-[460px] items-end px-7 pb-10 pt-40 md:min-h-[540px] md:items-center md:px-16 md:py-16">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-deep/60 px-4 py-1.5 text-[13px] font-semibold text-gold backdrop-blur">
            <Sparkles size={14} /> {kicker}
          </span>
          <h1 className="mt-5 font-display text-[clamp(44px,5.4vw,76px)] leading-[1.08] text-ivory text-balance">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function PlayPage() {
  const { state, dispatch, busy } = useStore()
  const { t, ar } = useLang()
  const [params, setParams] = useSearchParams()
  const gallery = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLDivElement>(null)
  const n = state.selected.length
  const step = params.get('step')
  const help = CATEGORIES.find((c) => c.id === params.get('help'))
  const prevN = useRef(n)
  const [pulse, setPulse] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const Arrow = ar ? ArrowLeft : ArrowRight
  useEffect(() => {
    if (n === 6 && prevN.current < 6) {
      setPulse(true)
      setTimeout(() => setPulse(false), 1000)
    }
    prevN.current = n
  }, [n])
  // The start bar appears as soon as the visitor scrolls past the banner, to show how to start.
  useEffect(() => {
    const el = hero.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setPastHero(e.intersectionRatio < 0.35), {
      threshold: [0, 0.35, 1],
    })
    io.observe(el)
    return () => io.disconnect()
  }, [step])

  if (step === 'room' && state.session && state.session.phase === 'lobby') return <Lobby />

  const scrollToGallery = () => gallery.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const go = async () => {
    if (n < 6) {
      if (pastHero)
        dispatch({
          type: 'toast',
          text: t(`اختار ${toAr(6 - n)} فئات كمان`, `Ekhtar ${6 - n} fe2at kaman`),
        })
      return scrollToGallery()
    }
    if (await dispatch({ type: 'createRoom', names: [t('الفراعنة', 'El Fara3na'), t('الجدعان', 'El Ged3an')] }))
      setParams({ step: 'room' })
  }
  const quickDemo = async () => {
    if (
      await dispatch({
        type: 'createRoom',
        names: [t('الفراعنة', 'El Fara3na'), t('الجدعان', 'El Ged3an')],
        categoryIds: DEMO_CATEGORY_IDS,
      })
    )
      setParams({ step: 'room' })
  }
  const discount = toAr(Math.round(GIFT_DISCOUNT * 100))
  const showBar = pastHero || n > 0

  return (
    <div>
      <PromoPopup />
      {/* Marketing hero banner */}
      <div ref={hero} className="reveal mt-2">
        <Carousel label={t('العروض', 'El 3orood')} autoplay={7000} slideClass="w-full">
          <Banner
            image={PHOTO.herowide}
            kicker={t('لعبة الشلة المصرية', 'Le3bet el shella el masreya')}
            title={
              <>
                {t('اختار', 'Ekhtar')} <span className="num text-gold">{toAr(6)}</span> {t('فئات', 'fe2at')}
                <br />
                {t('والعب فورًا', 'w el3ab 3al tool')}
              </>
            }
          >
            <button
              onClick={go}
              className={`btn-play sheen mt-8 inline-flex h-[76px] items-center gap-3 rounded-2xl px-12 text-[30px] font-bold ${pulse ? 'pulse-once' : ''}`}
            >
              {t('العب الآن', 'El3ab delwa2ty')}
              <Arrow size={28} strokeWidth={2.8} />
            </button>
            {DEMO_MODE && (
              <button
                disabled={busy}
                onClick={quickDemo}
                className="mt-4 flex min-h-12 items-center gap-2 rounded-2xl border border-gold/40 bg-deep/75 px-6 text-sm font-semibold text-gold backdrop-blur transition hover:bg-gold/15 disabled:opacity-50"
              >
                <Sparkles size={17} /> {t('جرّب الألعاب الجديدة', 'Garrab el al3ab el gdeeda')}
              </button>
            )}
          </Banner>
          <Banner
            image={PHOTO.coins}
            position="object-[75%_center]"
            kicker={t(`خصم ${discount}٪ على الهدايا`, `${discount}% off el hadaya`)}
            title={t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba')}
          >
            <Link
              to="/tokens?tab=gift"
              className="btn-play sheen mt-8 inline-flex h-[76px] items-center gap-3 rounded-2xl px-12 text-[28px] font-bold"
            >
              <Gift size={26} /> {t('اهدي دلوقتي', 'Ehdy delwa2ty')}
            </Link>
          </Banner>
        </Carousel>
      </div>

      <section ref={gallery} className="scroll-mt-32 pb-48 pt-12 md:pb-36">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <img src={LOGO.divider} alt="" aria-hidden className="mb-3 h-3 w-auto opacity-80" />
            <h2 className="font-display text-[34px] leading-none md:text-[48px]">{t('اختار فئاتك', 'Ekhtar fe2atak')}</h2>
          </div>
          {/* Game counter */}
          <div className="glass flex items-center gap-3 rounded-[22px] p-2 pe-5" aria-live="polite">
            <Ring n={n} size={72} />
            <span className="text-[17px] font-semibold text-ivory/80">
              <span className="num text-[26px] font-bold text-gold">{toAr(n)}</span> {t('من', 'men')}{' '}
              <span className="num">{toAr(6)}</span>
            </span>
          </div>
        </div>
        <div className="space-y-12 pt-4">
          {SECTIONS.map((sec, si) => (
            <div
              key={sec.id}
              id={`sec-${sec.id}`}
              className="relative rounded-[28px] border border-white/10 bg-white/[0.035] px-2.5 pb-5 pt-11 sm:px-5 lg:px-6"
            >
              <div
                className={`absolute inset-x-0 -top-5 mx-auto flex w-max items-center gap-2 whitespace-nowrap rounded-full px-6 py-2 font-display text-[22px] leading-none shadow-[0_10px_26px_rgba(0,0,0,.35)] sm:text-[26px] ${
                  si === 0
                    ? 'bg-gradient-to-b from-[#f4bd45] to-[#d9941c] text-forest'
                    : 'bg-[#123d2a] text-gold ring-1 ring-gold/40'
                }`}
              >
                {si === 0 && <Flame size={20} fill="currentColor" strokeWidth={1.5} />}
                {t(sec.name, sec.nameEn)}
              </div>
              <div className="grid grid-cols-3 gap-2 min-[600px]:grid-cols-5 min-[600px]:gap-3 lg:gap-4">
                {sec.ids.map((id) => (
                  <CategoryCard key={id} id={id} i={CATEGORIES.findIndex((c) => c.id === id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Start bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-3 md:bottom-6">
        <motion.div
          initial={false}
          animate={{ y: showBar ? 0 : 160, opacity: showBar ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-[26px] border border-gold/35 bg-deep/95 p-2.5 ps-3 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur sm:gap-5 sm:p-3 sm:ps-4"
        >
          <Ring n={n} size={64} />
          <div className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-ivory/90 sm:text-[19px]">
            {n === 0 ? (
              t('اختار ٦ فئات', 'Ekhtar 6 fe2at')
            ) : n < 6 ? (
              <>
                {t('باقي', 'Fadel')} <span className="num text-[24px] font-bold text-gold">{toAr(6 - n)}</span>{' '}
                {t('فئات', 'fe2at')}
              </>
            ) : (
              t('جاهزين! يلا نبدأ', 'Gahzeen! Yalla nebda2')
            )}
          </div>
          {/* Red until the six are picked, then green — never a faded grey. */}
          <button
            onClick={go}
            className={`sheen inline-flex h-16 shrink-0 items-center gap-2 rounded-2xl px-6 text-[20px] font-bold text-white transition-colors sm:h-[72px] sm:px-10 sm:text-[24px] ${
              n === 6
                ? 'cta-ready bg-[#46aa78] shadow-[0_14px_34px_rgba(70,170,120,.5)] hover:brightness-110'
                : 'btn-play'
            }`}
          >
            {t('ابدأ اللعبة', 'Ebda2 el le3ba')}
            <Arrow size={24} strokeWidth={2.8} />
          </button>
        </motion.div>
      </div>

      <Modal open={!!help} onClose={() => setParams({})} title={help ? t(help.name, help.nameEn) : ''}>
        {help && (
          <div className="pt-2">
            <CategoryArt cat={help} className="mb-4 h-32 rounded-2xl" />
            <h2 className="font-display text-3xl">{t(help.name, help.nameEn)}</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-forest/80">{t(help.help, help.helpEn)}</p>
            <div className="mt-4 rounded-xl bg-gold/15 p-4 text-[15px]">
              <span className="text-xs font-bold text-forest/50">{t('مثال', 'Masalan')}</span>
              <br />
              {t(help.example, help.exampleEn)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
