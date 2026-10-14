import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Check, CircleHelp, Users, Copy, Sparkles, Flame } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { CATEGORIES, DEMO_CATEGORY_IDS, SECTIONS, toAr } from '../lib/data'
import { DEMO_MODE } from '../lib/runtime'
import { useStore } from '../lib/store'
import { CategoryArt, Poster } from '../components/art'
import { PHOTO, LOGO } from '../lib/images'
import { Modal } from '../components/ui'

function Ring({ n }: { n: number }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#e7a72b"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - n / 6)}
        transform="rotate(-90 26 26)"
        style={{
          transition: 'stroke-dashoffset 300ms cubic-bezier(.22,1,.36,1)',
        }}
      />
      <text
        x="26"
        y="31"
        textAnchor="middle"
        fontFamily="Reem Kufi"
        fontWeight="700"
        fontSize="16"
        fill="#fffdf8"
      >
        {n}
      </text>
    </svg>
  )
}

function CategoryCard({ id, i }: { id: string; i: number }) {
  const { state, dispatch } = useStore()
  const [, setParams] = useSearchParams()
  const cat = CATEGORIES.find((c) => c.id === id)!
  const on = state.selected.includes(id)
  const full = state.selected.length >= 6 && !on
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(i * 0.03, 0.18),
        duration: 0.26,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={full ? undefined : { y: -4 }}
      className="relative"
    >
      <button
        onClick={() => dispatch({ type: 'toggleCategory', id })}
        aria-pressed={on}
        aria-label={`${cat.name}${on ? ' — مختارة' : ''}`}
        className={`group block w-full rounded-[18px] text-start transition-[box-shadow,opacity] duration-200 ${
          on
            ? 'shadow-[0_0_0_3px_#e7a72b,0_18px_40px_rgba(231,167,43,.25)]'
            : 'shadow-[0_0_0_1px_rgba(255,240,200,.16),0_10px_24px_rgba(0,0,0,.25)]'
        } ${full ? 'opacity-45' : ''}`}
      >
        {cat.instruction && (
          <span className="absolute end-2 top-2 rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-forest">
            جديد
          </span>
        )}
        <Poster
          cat={cat}
          selected={on}
          titleClass="text-[19px] sm:text-[20px] lg:text-[22px]"
          className="rounded-[18px]"
        />
        {cat.instruction && (
          <span className="block min-h-12 px-3 py-3 text-center text-[11px] leading-5 text-ivory/60">
            {cat.instruction}
          </span>
        )}
        <motion.span
          initial={false}
          animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-gold text-forest shadow-lg"
        >
          <Check size={16} strokeWidth={3} />
        </motion.span>
      </button>
      <button
        onClick={() => setParams({ help: id })}
        aria-label={`تفاصيل سريعة عن ${cat.name}`}
        className="absolute start-0 top-0 grid h-11 w-11 place-items-center rounded-full text-white/80 transition hover:text-white"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-black/35 backdrop-blur">
          <CircleHelp size={16} />
        </span>
      </button>
    </motion.div>
  )
}

function Lobby() {
  const { state, dispatch, isHost, busy } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const s = state.session!
  const [names, setNames] = useState<[string, string]>([s.teams[0].name, s.teams[1].name])
  const link = `${location.origin}/join/${s.code}`
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const start = async () => {
    for (const idx of [0, 1] as const)
      if (!(await dispatch({ type: 'rename', idx, name: names[idx].trim() }))) return
    if (state.tokens < 1) return nav('/tokens?returnTo=' + encodeURIComponent('/play?step=room'))
    if (await dispatch({ type: 'startGame' })) nav(`/game/${s.id}`)
  }
  return (
    <section className="reveal mx-auto grid max-w-[980px] gap-6 pt-6 md:grid-cols-[1fr_380px]">
      <div className="glass rounded-[22px] p-6 md:p-8">
        <p className="text-sm font-medium text-gold">الخطوة الأخيرة</p>
        <h1 className="mt-1 font-display text-[40px] leading-tight">سمّوا الفريقين</h1>
        <div className="mt-6 grid gap-4">
          {s.teams.map((t, i) => (
            <label key={t.id} className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-ivory/70">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    i ? 'bg-[#46aa78] text-forest' : 'bg-gold text-forest'
                  }`}
                >
                  {i ? 'ب' : 'أ'}
                </span>
                {i ? 'الفريق الثاني' : 'الفريق الأول'}
              </span>
              <input
                value={names[i]}
                maxLength={18}
                onChange={(e) =>
                  setNames(
                    (previous) =>
                      previous.map((name, index) => (index === i ? e.target.value : name)) as [
                        string,
                        string,
                      ],
                  )
                }
                className="h-14 w-full rounded-2xl border border-white/15 bg-black/20 px-5 text-xl font-semibold text-ivory outline-none transition placeholder:text-ivory/30 focus:border-gold focus:bg-black/30"
                placeholder={i ? 'الجدعان' : 'الفراعنة'}
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm text-ivory/60">
          <Users size={16} />
          {s.guests.length
            ? `${toAr(s.guests.length)} متصل: ${s.guests.map((g) => g.name).join('، ')}`
            : 'لسه محدش دخل — ابعتوا الكود للشلة'}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm">
          <span className="font-semibold text-gold">اللعبة بتكلف ١ توكن</span>
          <span className="text-ivory/65">
            رصيدك: <span className="num">{toAr(state.tokens)}</span> توكن
          </span>
        </div>
        <button
          disabled={!isHost || busy || names.some((name) => !name.trim())}
          onClick={start}
          className="btn-play mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-[22px] font-bold"
        >
          {state.tokens >= 1 ? 'ابدأ اللعبة' : 'اشتري توكن وابدأ'}
          <ArrowLeft size={22} strokeWidth={2.6} />
        </button>
      </div>
      <div className="paper flex flex-col items-center rounded-[22px] p-6 text-center">
        <p className="text-sm font-semibold text-forest/60">كود اللعبة</p>
        <div className="num mt-1 text-[64px] font-bold leading-none tracking-[0.18em] text-forest">
          {toAr(s.code)}
        </div>
        <button
          onClick={() => setParams({ invite: '1' })}
          className="mt-5 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-stroke transition hover:scale-[1.02]"
          aria-label="كبّر الـQR"
        >
          <QRCodeSVG value={link} size={168} fgColor="#0d2e1d" bgColor="#ffffff" />
        </button>
        <p className="mt-4 text-sm text-forest/70">ادخل بكود أو QR</p>
        <button
          onClick={copy}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-stroke bg-white px-5 text-sm font-semibold text-forest transition hover:border-gold"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'اتنسخ' : 'انسخ الرابط'}
        </button>
      </div>
      <Modal
        open={params.get('invite') === '1'}
        onClose={() => setParams({ step: 'room' })}
        title="دعوة اللاعبين"
      >
        <div className="flex flex-col items-center pt-4 text-center">
          <h2 className="font-display text-3xl">امسح وادخل</h2>
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-stroke">
            <QRCodeSVG value={link} size={240} fgColor="#0d2e1d" />
          </div>
          <div className="num mt-4 text-5xl font-bold tracking-[0.2em]">{toAr(s.code)}</div>
          <button
            onClick={copy}
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-forest px-6 font-semibold text-ivory"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'اتنسخ' : 'انسخ الرابط'}
          </button>
        </div>
      </Modal>
    </section>
  )
}

export default function PlayPage() {
  const { state, dispatch, busy } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const gallery = useRef<HTMLDivElement>(null)
  const n = state.selected.length
  const step = params.get('step')
  const help = CATEGORIES.find((c) => c.id === params.get('help'))
  const prevN = useRef(n)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (n === 6 && prevN.current < 6) {
      setPulse(true)
      setTimeout(() => setPulse(false), 1000)
    }
    prevN.current = n
  }, [n])

  if (step === 'room' && state.session && state.session.phase === 'lobby') return <Lobby />

  const go = async () => {
    if (n < 6)
      return gallery.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    if (await dispatch({ type: 'createRoom', names: ['الفراعنة', 'الجدعان'] }))
      setParams({ step: 'room' })
  }
  const quickDemo = async () => {
    if (
      await dispatch({
        type: 'createRoom',
        names: ['الفراعنة', 'الجدعان'],
        categoryIds: DEMO_CATEGORY_IDS,
      })
    )
      setParams({ step: 'room' })
  }

  return (
    <div>
      <section className="reveal relative mt-2 overflow-hidden rounded-[28px] border border-gold/20 bg-[#0a2a1c] shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <img
          src={PHOTO.herowide}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-left"
        />
        <div className="absolute inset-0 bg-[#0a2a1c]/55 md:bg-transparent" aria-hidden />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a2a1c]/90 to-transparent md:hidden"
          aria-hidden
        />
        <div className="relative flex min-h-[560px] items-end px-7 pb-10 pt-64 md:min-h-[580px] md:items-center md:px-16 md:py-16">
          <div className="max-w-xl md:ms-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[13px] font-semibold text-gold">
              <Sparkles size={14} /> لعبة الشلة المصرية
            </span>
            <h1 className="mt-5 font-display text-[clamp(44px,5.4vw,76px)] leading-[1.08] text-ivory text-balance">
              اختار <span className="num text-gold">٦</span> فئات
              <br />
              والعب فورًا
            </h1>
            <button
              onClick={go}
              className={`btn-play sheen mt-8 inline-flex h-[68px] items-center gap-3 rounded-2xl px-10 text-[26px] font-bold ${
                pulse ? 'pulse-once' : ''
              }`}
            >
              العب الآن
              <ArrowLeft size={26} strokeWidth={2.8} />
            </button>
            {DEMO_MODE && (
              <button
                disabled={busy}
                onClick={quickDemo}
                className="mt-4 flex min-h-12 items-center gap-2 rounded-2xl border border-gold/40 bg-deep/75 px-6 text-sm font-semibold text-gold backdrop-blur transition hover:bg-gold/15 disabled:opacity-50"
              >
                <Sparkles size={17} /> جرّب الألعاب الجديدة
              </button>
            )}
          </div>
        </div>
      </section>

      <section ref={gallery} className="scroll-mt-24 pb-48 pt-12 md:pb-32">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <img src={LOGO.divider} alt="" aria-hidden className="mb-3 h-3 w-auto opacity-80" />
            <h2 className="font-display text-[34px] leading-none md:text-[44px]">اختار فئاتك</h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-ivory/60 sm:flex">
            <Ring n={n} />{' '}
            <span>
              <span className="num">{toAr(n)}</span> من <span className="num">{toAr(6)}</span>
            </span>
          </div>
        </div>
        <div className="space-y-12 pt-4">
          {SECTIONS.map((sec, si) => (
            <div
              key={sec.id}
              id={`sec-${sec.id}`}
              className="relative rounded-[28px] border border-white/10 bg-white/[0.035] px-3 pb-6 pt-11 sm:px-5 lg:px-6"
            >
              <div
                className={`absolute inset-x-0 -top-5 mx-auto flex w-max items-center gap-2 whitespace-nowrap rounded-full px-6 py-2 font-display text-[22px] leading-none shadow-[0_10px_26px_rgba(0,0,0,.35)] sm:text-[26px] ${
                  si === 0
                    ? 'bg-gradient-to-b from-[#f4bd45] to-[#d9941c] text-forest'
                    : 'bg-[#123d2a] text-gold ring-1 ring-gold/40'
                }`}
              >
                {si === 0 && <Flame size={20} fill="currentColor" strokeWidth={1.5} />}
                {sec.name}
              </div>
              <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-5 min-[600px]:gap-3 lg:gap-4">
                {sec.ids.map((id) => (
                  <CategoryCard key={id} id={id} i={CATEGORIES.findIndex((c) => c.id === id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 md:bottom-6">
        <motion.div
          initial={false}
          animate={{ y: n > 0 ? 0 : 140, opacity: n > 0 ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className={`glass pointer-events-auto flex w-full max-w-xl items-center gap-2.5 rounded-[24px] p-2.5 ps-4 sm:gap-4 sm:p-3 sm:ps-5 `}
        >
          <Ring n={n} />
          <div className="min-w-0 flex-1 whitespace-nowrap text-[14px] font-semibold leading-tight sm:text-[15px] text-ivory/85">
            {n < 6 ? (
              <>
                باقي <span className="num text-[20px] font-bold text-gold">{toAr(6 - n)}</span> فئات
              </>
            ) : (
              'جاهزين! يلا نبدأ'
            )}
          </div>
          <div>
            <button
              onClick={go}
              disabled={n < 6}
              className={`btn-play sheen inline-flex h-14 items-center gap-2 rounded-2xl px-5 text-[19px] sm:h-[60px] sm:px-8 sm:text-[21px] font-bold ${
                n === 6 ? 'cta-ready' : ''
              }`}
            >
              ابدأ اللعبة
              <ArrowLeft size={22} strokeWidth={2.8} />
            </button>
          </div>
        </motion.div>
      </div>

      <Modal open={!!help} onClose={() => setParams({})} title={help?.name ?? ''}>
        {help && (
          <div className="pt-2">
            <CategoryArt cat={help} className="mb-4 h-32 rounded-2xl" />
            <h2 className="font-display text-3xl">{help.name}</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-forest/80">{help.help}</p>
            <div className="mt-4 rounded-xl bg-gold/15 p-4 text-[15px]">
              <span className="text-xs font-bold text-forest/50">مثال</span>
              <br />
              {help.example}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
