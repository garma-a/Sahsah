import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Briefcase,
  Check,
  Clock,
  Coins,
  Copy,
  Gift,
  Landmark,
  Mail,
  MessageCircle,
  Pencil,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trophy,
  Wrench,
} from 'lucide-react'
import { GIFT_DISCOUNT, PROMOS, TOKEN_PRICE, TOKEN_PRESETS, toAr } from '../lib/data'
import { useStore, type GameRecord } from '../lib/store'
import { gameReturnPath, listTotal, orderTotal } from '../lib/token-economy'
import { PHOTO, LOGO } from '../lib/images'
import { Modal } from '../components/ui'
import { useLang } from '../lib/i18n'

const glass = 'glass min-w-0 rounded-[22px] p-6'

function GameRow({ g }: { g: GameRecord }) {
  const { state, resumeGame } = useStore()
  const { t } = useLang()
  const nav = useNavigate()
  const done = g.phase === 'finished'
  const [a, b] = g.teams
  const tie = a.score === b.score
  const winner = a.score > b.score ? a : b
  const members = state.teamMembers[g.id]
  const open = async () => {
    if (await resumeGame(g)) nav(done ? `/game/${g.id}/results` : g.phase === 'lobby' ? '/play?step=room' : `/game/${g.id}`)
  }
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
      <div className="flex -space-x-3 rtl:space-x-reverse">
        {g.categoryIds.slice(0, 4).map((id) => (
          <img key={id} src={PHOTO[id]} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-deep" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold">
          {a.name} <span className="num text-gold">{toAr(a.score)}</span> —{' '}
          <span className="num text-gold">{toAr(b.score)}</span> {b.name}
        </p>
        <p className="mt-0.5 text-xs text-ivory/50">
          <span className="num">{new Date(g.updatedAt).toLocaleDateString(t('ar-EG', 'en-GB'))}</span>
          {members && (members[0].length || members[1].length)
            ? ` · ${[...members[0], ...members[1]].join('، ')}`
            : ''}
        </p>
      </div>
      {done ? (
        <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gold/15 px-4 text-sm font-bold text-gold">
          <Trophy size={16} /> {tie ? t('تعادل', 'Ta3adol') : winner.name}
        </span>
      ) : (
        <button onClick={open} className="btn-play inline-flex h-12 items-center gap-2 rounded-xl px-5 font-bold">
          <Play size={16} fill="currentColor" /> {t('كمّل اللعبة', 'Kammel el le3ba')}
        </button>
      )}
      {done && (
        <button onClick={open} className="h-10 rounded-full border border-white/15 px-4 text-sm text-ivory/75 hover:bg-white/5">
          {t('النتيجة', 'El nateega')}
        </button>
      )}
    </li>
  )
}

function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const { t } = useLang()
  const u = state.user!
  const [name, setName] = useState(u.name)
  const [email, setEmail] = useState(u.email ?? '')
  const [err, setErr] = useState('')
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setErr(t('اكتب اسمك.', 'Ekteb esmak.'))
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setErr(t('الإيميل مش صح.', 'El email mesh sa7.'))
    dispatch({ type: 'updateProfile', user: { ...u, name: name.trim(), email: email.trim() || undefined } })
    dispatch({ type: 'toast', text: t('اتحفظ', 'Et7afaz') })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={t('تعديل البيانات', 'Ta3deel el bayanat')}>
      <form onSubmit={save} className="pt-3" noValidate>
        <h2 className="font-display text-3xl">{t('تعديل البيانات', 'Ta3deel el bayanat')}</h2>
        <label className="mt-4 block text-sm font-semibold" htmlFor="pn">
          {t('اسم المستخدم', 'Esm el user')}
        </label>
        <input id="pn" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border-2 border-stroke bg-white px-4 outline-none focus:border-gold" />
        <label className="mt-4 block text-sm font-semibold" htmlFor="pe">
          {t('الإيميل', 'El email')}
        </label>
        <input id="pe" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border-2 border-stroke bg-white px-4 text-start outline-none focus:border-gold" />
        <p className="mt-4 text-xs text-forest/60">
          {t('رقم الموبايل بيتغير بتسجيل دخول جديد.', 'Raqam el mobile beyetghayar b login gdeed.')}
        </p>
        {err && <p role="alert" className="mt-3 text-sm font-semibold text-play">{err}</p>}
        <button className="btn-play mt-5 h-12 w-full rounded-xl font-bold">{t('حفظ', '7fz')}</button>
      </form>
    </Modal>
  )
}

export function AccountPage() {
  const { state, dispatch } = useStore()
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  const u = state.user
  const history = state.history
  const unfinished = history.filter((g) => g.phase !== 'finished')
  const finished = history.filter((g) => g.phase === 'finished')
  return (
    <div className="reveal py-6">
      {u ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl">{t(`أهلًا يا ${u.name}`, `Ahlan ya ${u.name}`)}</h1>
            <p dir="ltr" className="num mt-1 text-start text-ivory/55">
              {u.phone}
              {u.email ? ` · ${u.email}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm hover:bg-white/10">
              <Pencil size={15} /> {t('تعديل البيانات', 'Ta3deel el bayanat')}
            </button>
            <button onClick={() => dispatch({ type: 'logout' })} className="h-11 rounded-full border border-white/20 px-5 text-sm text-ivory/80 hover:bg-white/10">
              {t('تسجيل خروج', 'Khoroog')}
            </button>
          </div>
          <ProfileEditor key={String(editing)} open={editing} onClose={() => setEditing(false)} />
        </div>
      ) : (
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6">
          <div>
            <h1 className="font-display text-4xl">{t('سجّل دخولك', 'Sagel dokhoolak')}</h1>
            <p className="mt-1 text-sm text-ivory/60">{t('عشان رصيدك وألعابك يفضلوا معاك.', '3ashan rasidak w al3abak yefdalo ma3ak.')}</p>
          </div>
          <Link to="/auth/login" className="btn-play inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold">
            {t('دخول المضيف', 'Dokhool el host')}
          </Link>
        </div>
      )}

      {/* Game history replaces past purchases: unfinished games can be reopened here. */}
      <section className="mt-8">
        <h2 className="font-display text-3xl">{t('ألعابك', 'Al3abak')}</h2>
        {history.length === 0 ? (
          <div className="glass mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[22px] p-6">
            <p className="text-ivory/60">{t('لسه ملعبتش. أول لعبة هتظهر هنا.', 'Lessa mal3ebtsh. Awel le3ba hatezhar hena.')}</p>
            <Link to="/play" className="btn-play inline-flex h-12 items-center rounded-xl px-6 font-bold">
              {t('العب الآن', 'El3ab delwa2ty')}
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-6">
            {unfinished.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gold">{t('ألعاب لسه مخلصتش', 'Al3ab lessa makhlesetsh')}</p>
                <ul className="grid gap-2">
                  {unfinished.map((g) => (
                    <GameRow key={g.id} g={g} />
                  ))}
                </ul>
              </div>
            )}
            {finished.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-ivory/60">{t('خلصت', 'Khelset')}</p>
                <ul className="grid gap-2">
                  {finished.map((g) => (
                    <GameRow key={g.id} g={g} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function PackageCard({
  count,
  gift,
  promo,
  onBuy,
}: {
  count: number
  gift: boolean
  promo?: string
  onBuy: (count: number) => void
}) {
  const { t } = useLang()
  const full = count * TOKEN_PRICE
  const price = orderTotal({ quantity: count, unitPrice: TOKEN_PRICE, promo, gift: gift ? { phone: '', note: '' } : undefined })
  const featured = count === 2
  return (
    <div className={`relative flex flex-col items-center rounded-[24px] p-5 text-center sm:p-7 ${featured ? 'paper ring-4 ring-gold' : 'glass'}`}>
      {featured && (
        <span className="absolute -top-3 rounded-full bg-gold px-3 py-1 text-xs font-bold text-forest">
          {t('الأكثر طلبًا', 'El aktar talaban')}
        </span>
      )}
      <Coins size={26} className={featured ? 'text-forest/60' : 'text-gold'} />
      <div className="num mt-2 text-6xl font-bold">{toAr(count)}</div>
      <div className={`text-sm font-semibold ${featured ? 'text-forest/65' : 'text-ivory/65'}`}>
        {count === 1 ? t('لعبة', 'Le3ba') : t('ألعاب', 'Al3ab')}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="num text-3xl font-bold">{toAr(price)}</span>
        <span className="text-sm">{t('ج.م', 'EGP')}</span>
        {price < full && <span className="num text-sm line-through opacity-50">{toAr(full)}</span>}
      </div>
      <button
        onClick={() => onBuy(count)}
        className="btn-play sheen mt-5 inline-flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-[22px] font-bold"
      >
        {gift ? <Gift size={22} /> : null}
        {gift ? t('اهدي', 'Ehdy') : t('اشتري', 'Eshtery')}
      </button>
    </div>
  )
}

export function TokensPage() {
  const { state, dispatch, isHost } = useStore()
  const { t } = useLang()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const giftRef = useRef<HTMLElement>(null)
  const [draft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('sahsah.token-draft') || '{}')
    } catch {
      return {}
    }
  })
  const [code, setCode] = useState<string>(draft.code ?? '')
  const [promo, setPromo] = useState<string | undefined>(draft.promo)
  const [showCode, setShowCode] = useState(!!draft.promo)
  const [msg, setMsg] = useState('')
  const [phone, setPhone] = useState<string>(draft.phone ?? '')
  const [note, setNote] = useState<string>(draft.note ?? '')
  const [giftErr, setGiftErr] = useState('')
  const returnTo =
    gameReturnPath(sp.get('returnTo')) ??
    (isHost && state.session
      ? state.session.phase === 'lobby'
        ? '/play?step=room'
        : `/game/${state.session.id}${state.session.phase === 'finished' ? '/results' : ''}`
      : undefined)
  const discount = toAr(Math.round(GIFT_DISCOUNT * 100))
  useEffect(() => {
    if (sp.get('tab') === 'gift') giftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sp])

  const apply = () => {
    const c = code.trim().toUpperCase()
    if (PROMOS[c]) {
      setPromo(c)
      setMsg(t(`تم تطبيق ${toAr(Math.round(PROMOS[c] * 100))}٪ خصم`, `${Math.round(PROMOS[c] * 100)}% discount applied`))
    } else {
      setPromo(undefined)
      setMsg(t('الكود ده مش شغال.', 'El code da mesh shaghal.'))
    }
  }
  const buy = async (quantity: number, gift: boolean) => {
    if (gift && !/^0?1[0125]\d{8}$/.test(phone.replace(/\s/g, ''))) {
      setGiftErr(t('اكتب رقم موبايل مصري صح للمستلم.', 'Ekteb raqam mobile masry sa7 lel mostalem.'))
      return giftRef.current?.querySelector<HTMLInputElement>('#gp')?.focus()
    }
    if (!state.user) {
      sessionStorage.setItem('sahsah.token-draft', JSON.stringify({ code, promo, phone, note }))
      const next = new URLSearchParams(sp)
      next.set('amount', String(quantity))
      if (gift) next.set('tab', 'gift')
      return nav(`/auth/login?next=${encodeURIComponent('/tokens?' + next.toString())}`)
    }
    const id = crypto.randomUUID()
    if (
      await dispatch({
        type: 'order',
        order: {
          id,
          quantity,
          unitPrice: TOKEN_PRICE,
          promo,
          returnTo,
          gift: gift ? { phone, note } : undefined,
          status: 'review',
        },
      })
    ) {
      sessionStorage.removeItem('sahsah.token-draft')
      nav(`/checkout/${id}`)
    }
  }
  return (
    <div className="reveal space-y-10 py-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <img src={LOGO.divider} alt="" aria-hidden className="mb-3 h-3 w-auto opacity-80" />
            <h1 className="font-display text-[clamp(38px,5vw,60px)] leading-none">{t('توكن واحد = لعبة واحدة', 'Token wa7ed = le3ba wa7da')}</h1>
          </div>
          <div className="glass flex items-center gap-2 rounded-full px-5 py-2.5 text-sm">
            {t('رصيدك', 'Rasidak')} <span className="num text-xl font-bold text-gold">{toAr(state.tokens)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-5" role="list" aria-label={t('الباقات', 'El ba2at')}>
          {TOKEN_PRESETS.map((count) => (
            <PackageCard key={count} count={count} gift={false} promo={promo} onBuy={(q) => buy(q, false)} />
          ))}
        </div>
        <div className="mt-4">
          {!showCode ? (
            <button onClick={() => setShowCode(true)} className="text-sm font-semibold text-gold underline-offset-4 hover:underline">
              {t('عندك كود خصم؟', '3andak code khasm?')}
            </button>
          ) : (
            <div className="flex max-w-md flex-wrap gap-2">
              <label htmlFor="pc" className="sr-only">
                {t('كود الخصم', 'Code el khasm')}
              </label>
              <input
                id="pc"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SAH20"
                className="h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 uppercase outline-none focus:ring-2 focus:ring-gold"
              />
              <button onClick={apply} className="h-12 rounded-xl bg-white/15 px-5 font-semibold hover:bg-white/25">
                {t('تطبيق', 'Tatbee2')}
              </button>
              {msg && (
                <p role="status" className="w-full text-sm text-gold">
                  {msg}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Gift tokens: always discounted */}
      <section ref={giftRef} id="gift" className="scroll-mt-32 overflow-hidden rounded-[28px] border border-gold/30">
        <div className="relative">
          <img src={PHOTO.coins} alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/85 to-[#0a2a1c]/30" />
          <div className="relative flex flex-wrap items-center justify-between gap-4 p-7 md:p-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-play px-4 py-1.5 text-sm font-bold text-white">
                <Sparkles size={15} /> {t(`خصم ${discount}٪ على كل الهدايا`, `${discount}% off kol el hadaya`)}
              </span>
              <h2 className="mt-4 font-display text-[clamp(38px,5vw,64px)] leading-none">{t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba')}</h2>
              <p className="mt-2 max-w-md text-ivory/75">
                {t('التوكنز بتوصل للمستلم على رقم موبايله.', 'El tokens btewsal lel mostalem 3ala raqam mobailo.')}
              </p>
            </div>
            <Gift size={96} strokeWidth={1.2} className="text-gold max-md:hidden" />
          </div>
        </div>
        <div className="grid gap-4 bg-deep/60 p-5 md:grid-cols-[1fr_1.6fr] md:p-8">
          <div className="grid content-start gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="gp">
              <Smartphone size={16} /> {t('رقم المستلم', 'Raqam el mostalem')}
            </label>
            <input
              id="gp"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setGiftErr('')
              }}
              placeholder="010 000 0000"
              aria-invalid={!!giftErr}
              className="num h-14 w-full rounded-xl bg-white/10 px-4 text-start text-lg outline-none focus:ring-2 focus:ring-gold"
            />
            {giftErr && (
              <p role="alert" className="text-sm font-semibold text-[#ffb1aa]">
                {giftErr}
              </p>
            )}
            <label className="mt-1 block text-sm font-semibold" htmlFor="gn">
              {t('رسالة (اختياري)', 'Resala (e5tyary)')}
            </label>
            <input
              id="gn"
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              className="h-14 w-full rounded-xl bg-white/10 px-4 outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOKEN_PRESETS.map((count) => (
              <PackageCard key={count} count={count} gift promo={promo} onBuy={(q) => buy(q, true)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

const METHODS = [
  {
    id: 'shop',
    label: ['منفذ فوري', 'Manfaz Fawry'],
    hint: ['كاش في أي محل', 'Cash fe ay ma7al'],
    Icon: Store,
    steps: [
      ['روح أقرب منفذ فوري: سوبر ماركت، صيدلية، كشك أو ماكينة فوري.', 'Roo7 a2rab manfaz Fawry: supermarket, saydaleya, koshk aw makinet Fawry.'],
      ['قول للكاشير إنك عايز تدفع "بكود فوري" وادّيله الكود اللي فوق.', 'Ool lel cashier enak 3ayez tedfa3 "b code Fawry" w eddeeh el code elly fo2.'],
      ['اتأكد إن الاسم "صح صح" والمبلغ ظاهرين على الشاشة.', 'Et2akked en el esm "Sa7Sa7" wel mablagh zahreen 3al shasha.'],
      ['ادفع المبلغ كاش واستلم الإيصال.', 'Edfa3 el mablagh cash w estalem el esal.'],
      ['التوكنز بتتضاف لرصيدك بعد تأكيد الدفع.', 'El tokens btetdaf le rasidak ba3d ta2keed el daf3.'],
    ],
  },
  {
    id: 'wallet',
    label: ['محفظة إلكترونية', 'Ma7faza electroneya'],
    hint: ['فودافون كاش، أورنج، e&، وي باي', 'Vodafone Cash, Orange, e&, WE Pay'],
    Icon: Smartphone,
    steps: [
      ['افتح تطبيق محفظتك: فودافون كاش، أورنج كاش، e& money أو وي باي.', 'Efta7 app ma7faztak: Vodafone Cash, Orange Cash, e& money aw WE Pay.'],
      ['اختار "دفع فواتير" أو "فوري" من القايمة.', 'Ekhtar "Daf3 fawateer" aw "Fawry" men el 2ayma.'],
      ['اكتب كود فوري اللي فوق.', 'Ekteb code Fawry elly fo2.'],
      ['راجع المبلغ واسم التاجر "صح صح".', 'Rage3 el mablagh w esm el tager "Sa7Sa7".'],
      ['أكّد بالرقم السري للمحفظة وانتظر رسالة التأكيد.', 'Akked bel raqam el serry w estanna resalet el ta2keed.'],
    ],
  },
  {
    id: 'bank',
    label: ['تطبيق البنك', 'App el bank'],
    hint: ['أو ماكينة ATM', 'Aw makinet ATM'],
    Icon: Landmark,
    steps: [
      ['افتح تطبيق البنك أو روح ماكينة ATM بتدعم خدمة فوري.', 'Efta7 app el bank aw roo7 ATM beyed3am Fawry.'],
      ['اختار "مدفوعات" أو "دفع فواتير" ثم "فوري".', 'Ekhtar "Madfoo3at" aw "Daf3 fawateer" ba3deen "Fawry".'],
      ['اكتب كود فوري اللي فوق.', 'Ekteb code Fawry elly fo2.'],
      ['راجع المبلغ وأكّد العملية.', 'Rage3 el mablagh w akked el 3amaleya.'],
      ['احتفظ بإشعار الدفع لحد ما التوكنز توصلك.', 'E7tafez b esh3ar el daf3 le7ad ma el tokens tewsalak.'],
    ],
  },
] as const

const refFor = (id: string) => {
  let h = 7
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 900000000
  return String(h + 100000000)
}

export function CheckoutPage() {
  const { orderId } = useParams()
  const { state, dispatch } = useStore()
  const { t, ar } = useLang()
  const o = orderId ? state.orders[orderId] : undefined
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('shop')
  const [issued, setIssued] = useState(false)
  const [copied, setCopied] = useState(false)
  const L = (pair: readonly [string, string]) => (ar ? pair[0] : pair[1])
  useEffect(() => {
    if (o?.status !== 'pending') return
    const id = setTimeout(() => dispatch({ type: 'settle', orderId: o.id, ok: true }), 2200)
    return () => clearTimeout(id)
  }, [o?.status, o?.id, dispatch])
  if (!o)
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-5xl">{t('الطلب مش موجود', 'El talab mesh mawgood')}</h1>
        <Link to="/tokens" className="mt-6 inline-block text-gold underline">
          {t('رجوع للتوكنز', 'Rogoo3 lel tokens')}
        </Link>
      </div>
    )
  const total = orderTotal(o)
  const before = o.quantity * o.unitPrice
  const ref = refFor(o.id)
  const m = METHODS.find((x) => x.id === method)!
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  const done = o.status === 'success'
  const failed = o.status === 'failed'
  const waiting = o.status === 'pending'
  const stage = done ? 3 : issued ? 2 : 1
  const games = o.quantity === 1 ? t('لعبة', 'le3ba') : t('ألعاب', 'al3ab')
  return (
    <div className="grid min-h-[70dvh] place-items-center py-8">
      <div className="paper reveal w-full max-w-2xl rounded-[26px] p-6 md:p-9">
        <ol className="mb-7 flex items-center gap-2 text-xs font-semibold text-forest/60" aria-label={t('مراحل الدفع', 'Marahel el daf3')}>
          {[t('اختار الطريقة', 'Ekhtar el taree2a'), t('ادفع بالكود', 'Edfa3 bel code'), t('تأكيد', 'Ta2keed')].map((l, i) => (
            <li key={l} className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row">
              <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${stage > i ? 'bg-forest text-ivory' : 'bg-forest/10'}`}>
                {toAr(i + 1)}
              </span>
              <span className={stage > i ? 'text-forest' : ''}>{l}</span>
              {i < 2 && <span className="hidden h-px flex-1 bg-forest/15 sm:block" />}
            </li>
          ))}
        </ol>

        {done ? (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-forest">
              <Check size={34} strokeWidth={3} />
            </div>
            <h1 className="mt-4 font-display text-4xl">{o.gift ? t('الهدية اتبعتت!', 'El hedeya etba3atet!') : t('تم الدفع', 'Tamm el daf3')}</h1>
            <p className="mt-2 text-forest/65">
              {o.gift
                ? t(`${toAr(o.quantity)} ${games} في الطريق لصاحبك.`, `${o.quantity} ${games} fel taree2 le sa7bak.`)
                : t(`اتضاف ${toAr(o.quantity)} ${games} لرصيدك.`, `Et7at ${o.quantity} ${games} le rasidak.`)}
            </p>
            <Link
              to={gameReturnPath(o.returnTo) ?? '/play'}
              className="btn-play mt-6 flex h-16 items-center justify-center rounded-2xl text-xl font-bold"
            >
              {o.returnTo ? t('كمّل لعبتك', 'Kammel le3betak') : t('العب الآن', 'El3ab delwa2ty')}
            </Link>
          </div>
        ) : failed ? (
          <div className="text-center">
            <h1 className="font-display text-4xl">{t('الدفع ما تمش', 'El daf3 matammesh')}</h1>
            <Link to="/tokens" className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold">
              {t('حاول تاني', '7awel tany')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 border-b border-stroke pb-4">
              <div>
                <h1 className="font-display text-4xl leading-none">{t('ادفع عن طريق فوري', 'Edfa3 b Fawry')}</h1>
                <p className="mt-2 text-sm text-forest/65">
                  <span className="num font-bold">{toAr(o.quantity)}</span> {games}
                  {o.gift ? t(' · هدية', ' · hedeya') : ''}
                  {o.promo ? ` · ${o.promo}` : ''}
                </p>
              </div>
              <div className="text-end">
                <div className="num text-3xl font-bold">
                  {toAr(total)} <span className="text-lg">{t('ج.م', 'EGP')}</span>
                </div>
                {total < before && <div className="num text-sm text-forest/45 line-through">{toAr(listTotal({ ...o, gift: undefined }))}</div>}
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('طريقة الدفع', 'Taree2et el daf3')}>
              {METHODS.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-start transition ${method === id ? 'border-gold bg-gold/15' : 'border-stroke bg-white hover:border-gold/60'}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${method === id ? 'bg-forest text-ivory' : 'bg-forest/10'}`}>
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold leading-tight">{L(label)}</span>
                    <span className="block text-xs text-forest/60">{L(hint)}</span>
                  </span>
                </button>
              ))}
            </div>

            {!issued ? (
              <button onClick={() => setIssued(true)} className="btn-play mt-6 h-16 w-full rounded-2xl text-xl font-bold">
                {t('اطلب كود فوري', 'Otlob code Fawry')}
              </button>
            ) : (
              <div className="mt-6">
                <div className="rounded-2xl bg-forest p-5 text-center text-ivory">
                  <p className="text-sm text-ivory/70">{t('كود فوري بتاعك', 'Code Fawry beta3ak')}</p>
                  <div dir="ltr" className="num mt-1 text-[clamp(24px,5vw,44px)] font-bold leading-none tracking-[0.08em] text-gold">
                    {ref.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-ivory/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} /> {t('صالح ٢٤ ساعة', 'Sale7 24 sa3a')}
                    </span>
                    <button onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 font-semibold text-ivory hover:bg-white/20">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('اتنسخ', 'Etnasa5') : t('انسخ الكود', 'Ensa5 el code')}
                    </button>
                  </div>
                </div>

                <h2 className="mt-6 font-display text-2xl">
                  {t('خطوات الدفع', 'Khatawat el daf3')} — {L(m.label)}
                </h2>
                <ol className="mt-3 space-y-2.5">
                  {m.steps.map((step, i) => (
                    <li key={step[0]} className="flex gap-3 rounded-xl bg-white p-3.5 ring-1 ring-stroke">
                      <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-forest">
                        {toAr(i + 1)}
                      </span>
                      <span className="text-[15px] leading-relaxed">{L(step)}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 rounded-2xl border-2 border-dashed border-gold/70 bg-gold/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck size={16} /> {t('محاكاة للتجربة بس', 'Mo7akah lel tagroba bas')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-forest/65">
                    {t(
                      'الكود ده شكلي ومفيش فلوس بتتسحب. دوس الزرار بعد ما تخلص الخطوات عشان تشوف شكل التأكيد.',
                      'El code da shakly w mafeesh feloos btetseheb. Doos el zorar ba3d ma tekhallas 3ashan teshoof el ta2keed.',
                    )}
                  </p>
                  <button
                    disabled={waiting}
                    onClick={() => dispatch({ type: 'order', order: { ...o, status: 'pending' } })}
                    className="btn-play mt-3 h-12 w-full rounded-xl font-bold"
                  >
                    {waiting ? t('بنستنى تأكيد فوري…', 'Mestanyeen ta2keed Fawry…') : t('دفعت — كمّل (محاكاة)', 'Dafa3t — kammel (mo7akah)')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type Funnel = 'support' | 'experience' | 'business'
const CONTACT_KEY = 'sahsah.contact.v1'

/** Contact: three email funnels (support, experience, business) each ending on a thank-you screen. */
export function ContactPage() {
  const { t } = useLang()
  const [sp, setSp] = useSearchParams()
  const tab = (['support', 'experience', 'business'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'support') as Funnel
  const [sent, setSent] = useState<Funnel | null>(null)
  const [form, setForm] = useState({ reason: 'technical', kind: 'business', name: '', email: '', handle: '', message: '', rating: 0 })
  const [err, setErr] = useState('')
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErr('')
  }
  const field = 'mt-1.5 h-13 w-full rounded-xl border-2 border-stroke bg-white px-4 py-3 text-forest outline-none focus:border-gold'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (tab !== 'experience' && !/^\S+@\S+\.\S+$/.test(form.email))
      return setErr(t('اكتب إيميل صحيح عشان نرد عليك.', 'Ekteb email sa7 3ashan nerod 3aleek.'))
    if (tab === 'experience' && !form.rating && !form.message.trim())
      return setErr(t('قيّم التجربة أو اكتب رأيك.', 'Qayyem el tagroba aw ekteb ra2yak.'))
    if (tab !== 'experience' && form.message.trim().length < 5)
      return setErr(t('اكتب رسالتك.', 'Ekteb resaltak.'))
    // Demo: saved in this browser. In production this posts to the support inbox.
    try {
      const all = JSON.parse(localStorage.getItem(CONTACT_KEY) || '[]')
      all.push({ funnel: tab, ...form, at: Date.now() })
      localStorage.setItem(CONTACT_KEY, JSON.stringify(all.slice(-50)))
    } catch {
      /* ignore */
    }
    setSent(tab)
  }
  const tabs: [Funnel, string, typeof Wrench][] = [
    ['support', t('عندك مشكلة؟', '3andak moshkela?'), Wrench],
    ['experience', t('شاركنا تجربتك', 'Sharekna tagrobtak'), MessageCircle],
    ['business', t('بيزنس ومؤثرين', 'Business w Influencers'), Briefcase],
  ]
  if (sent)
    return (
      <div className="grid min-h-[60dvh] place-items-center py-10">
        <div className="paper reveal w-full max-w-lg rounded-[26px] p-8 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold text-forest">
            <Check size={40} strokeWidth={3} />
          </div>
          <h1 className="mt-5 font-display text-5xl leading-none">
            {sent === 'experience' ? t('رأيك فرق معانا!', 'Ra2yak fere2 ma3ana!') : t('هنتواصل معاك قريب', 'Hanetwasal ma3ak 2orayeb')}
          </h1>
          <p className="mt-3 text-forest/65">
            {sent === 'experience'
              ? t('شكرًا إنك جزء من صح صح.', 'Shokran enak goz2 men Sa7Sa7.')
              : t('هنرد على إيميلك في أقرب وقت.', 'Hanrod 3ala emailak fe a2rab wa2t.')}
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/play" className="btn-play inline-flex h-14 items-center justify-center rounded-2xl px-8 text-lg font-bold">
              {t('العب الآن', 'El3ab delwa2ty')}
            </Link>
            <button
              onClick={() => {
                setSent(null)
                set({ message: '', rating: 0 })
              }}
              className="h-14 rounded-2xl border-2 border-stroke px-6 font-semibold text-forest"
            >
              {t('رسالة تانية', 'Resala tanya')}
            </button>
          </div>
        </div>
      </div>
    )
  return (
    <div className="reveal grid gap-6 py-6 md:grid-cols-[1fr_1.3fr]">
      <div className="relative overflow-hidden rounded-[28px] border border-gold/20 max-md:min-h-[220px]">
        <img src={PHOTO.contact} alt="" className="absolute inset-0 h-full w-full object-cover object-left" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2a1c] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-7">
          <h1 className="font-display text-[clamp(40px,5vw,64px)] leading-none">{t('كلمنا', 'Kalemna')}</h1>
          <p className="mt-2 text-sm text-ivory/75">{t('كل رسالة بتوصل لفريق صح صح.', 'Kol resala btewsal le team Sa7Sa7.')}</p>
          <a
            href="https://wa.me/201000000000"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold hover:bg-white/10"
          >
            <MessageCircle size={16} /> {t('أو واتساب', 'Aw WhatsApp')}
          </a>
        </div>
      </div>
      <div>
        <div className="glass grid grid-cols-3 gap-1 rounded-2xl p-1" role="tablist">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setSp(id === 'support' ? {} : { tab: id })
                setErr('')
              }}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[13px] font-bold transition sm:flex-row sm:text-[15px] ${tab === id ? 'bg-gold text-forest' : 'text-ivory/75 hover:bg-white/5'}`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} noValidate className="paper mt-4 rounded-[24px] p-6 md:p-8">
          {tab === 'support' && (
            <>
              <p className="text-sm font-semibold">{t('نوع المشكلة', 'No3 el moshkela')}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup">
                {[
                  ['technical', t('مشكلة تقنية', 'Moshkela te2neya')],
                  ['purchase', t('مشكلة في الشراء', 'Moshkela fel shera2')],
                  ['account', t('مشكلة في الحساب', 'Moshkela fel 7esab')],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    role="radio"
                    aria-checked={form.reason === id}
                    onClick={() => set({ reason: id })}
                    className={`h-12 rounded-xl border-2 text-[15px] font-semibold transition ${form.reason === id ? 'border-gold bg-gold/20' : 'border-stroke bg-white hover:border-gold/60'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'experience' && (
            <>
              <p className="text-sm font-semibold">{t('إيه رأيك في صح صح؟', 'Eh ra2yak fe Sa7Sa7?')}</p>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t('التقييم', 'El taqyeem')}>
                {['😕', '😐', '🙂', '😄', '🤩'].map((face, i) => (
                  <button
                    type="button"
                    key={face}
                    role="radio"
                    aria-checked={form.rating === i + 1}
                    aria-label={`${i + 1}/5`}
                    onClick={() => set({ rating: i + 1 })}
                    className={`grid h-14 flex-1 place-items-center rounded-xl border-2 text-2xl transition ${form.rating === i + 1 ? 'border-gold bg-gold/20' : 'border-stroke bg-white'}`}
                  >
                    {face}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-forest/55">
                {t('ساعدنا نعمل اللعبة اللي بتحبها — إنت جزء من رسالتنا.', 'Sa3edna ne3mel el le3ba elly bet7ebbaha — enta goz2 men resaletna.')}
              </p>
            </>
          )}
          {tab === 'business' && (
            <>
              <p className="text-sm font-semibold">{t('إنت…', 'Enta…')}</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
                {[
                  ['business', t('شركة / مكان', 'Sherka / makan')],
                  ['influencer', t('مؤثر / صانع محتوى', 'Influencer / content creator')],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    role="radio"
                    aria-checked={form.kind === id}
                    onClick={() => set({ kind: id })}
                    className={`h-12 rounded-xl border-2 text-[15px] font-semibold transition ${form.kind === id ? 'border-gold bg-gold/20' : 'border-stroke bg-white hover:border-gold/60'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {t('الاسم', 'El esm')}
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={field} autoComplete="name" />
            </label>
            <label className="block text-sm font-semibold">
              {t('الإيميل', 'El email')}
              {tab === 'experience' && <span className="font-normal text-forest/50">{t(' (اختياري)', ' (e5tyary)')}</span>}
              <input dir="ltr" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={`${field} text-start`} autoComplete="email" />
            </label>
            {tab === 'business' && (
              <label className="block text-sm font-semibold sm:col-span-2">
                {form.kind === 'influencer' ? t('حسابك على السوشيال', 'Account el social') : t('اسم الشركة', 'Esm el sherka')}
                <input value={form.handle} onChange={(e) => set({ handle: e.target.value })} className={field} />
              </label>
            )}
            <label className="block text-sm font-semibold sm:col-span-2">
              {tab === 'experience' ? t('رأيك (اختياري)', 'Ra2yak (e5tyary)') : t('رسالتك', 'Resaltak')}
              <textarea
                value={form.message}
                onChange={(e) => set({ message: e.target.value })}
                rows={4}
                maxLength={1000}
                className="mt-1.5 w-full rounded-xl border-2 border-stroke bg-white px-4 py-3 text-forest outline-none focus:border-gold"
              />
            </label>
          </div>
          {err && (
            <p role="alert" className="mt-3 text-sm font-semibold text-play">
              {err}
            </p>
          )}
          <button className="btn-play sheen mt-5 inline-flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold">
            <Mail size={20} /> {t('ابعت', 'Eb3at')}
          </button>
        </form>
      </div>
    </div>
  )
}

