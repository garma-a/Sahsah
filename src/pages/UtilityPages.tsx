import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Check,
  Clock,
  Coins,
  Copy,
  Gift,
  Landmark,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Minus,
  Plus,
} from 'lucide-react'
import { PROMOS, TOKEN_PRICE, TOKEN_PRESETS, toAr } from '../lib/data'
import { useStore } from '../lib/store'
import {
  gameReturnPath,
  MAX_TOKEN_QUANTITY,
  orderTotal,
  parseTokenQuantity,
} from '../lib/token-economy'
import { PHOTO, LOGO } from '../lib/images'

const glass = 'glass min-w-0 rounded-[22px] p-6'

export function AccountPage() {
  const { state, dispatch } = useStore()
  const u = state.user
  if (!u)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-display text-5xl">سجّل دخولك</h1>
          <Link
            to="/auth/login"
            className="btn-play mt-8 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold"
          >
            دخول المضيف
          </Link>
        </div>
      </div>
    )
  return (
    <div className="reveal py-6">
      <h1 className="font-display text-5xl">أهلًا يا {u.name}</h1>
      <p dir="ltr" className="num mt-1 text-start text-ivory/55">
        {u.phone}
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[22px] border border-gold/20 p-6 md:min-h-[300px]">
          <img
            src={PHOTO.coins}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[75%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/75 to-[#0a2a1c]/0" />
          <div className="relative">
            <div className="text-sm text-ivory/70">رصيد التوكنز</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="num text-6xl font-bold text-gold">{toAr(state.tokens)}</span>
              <Coins className="text-gold" />
            </div>
            <p className="mt-3 text-sm text-ivory/70">
              <span className="num">{toAr(state.tokens)}</span> توكن ={' '}
              <span className="num">{toAr(state.tokens)}</span> لعبة
            </p>
            <p className="mt-1 text-xs text-gold">توكن واحد لكل لعبة</p>
            <Link
              to="/tokens"
              className="btn-play mt-6 inline-flex h-12 items-center rounded-xl px-6 font-bold"
            >
              اشتري توكنز
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[22px] border border-gold/20 p-6">
          <img src={PHOTO.flow} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0a2a1c]/70" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-sm text-ivory/60">
              <Receipt size={16} /> آخر النشاط
            </div>
            {state.activity.length === 0 ? (
              <p className="text-ivory/50">لسه مفيش نشاط.</p>
            ) : (
              <ul className="space-y-2">
                {state.activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between rounded-xl bg-black/30 px-4 py-3 backdrop-blur"
                  >
                    <span>{a.text}</span>
                    <span className="num text-sm text-ivory/40">
                      {new Date(a.at).toLocaleDateString('ar-EG')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => dispatch({ type: 'logout' })}
        className="mt-8 h-11 rounded-full border border-white/20 px-6 text-sm text-ivory/80 hover:bg-white/10"
      >
        تسجيل خروج
      </button>
    </div>
  )
}

export function TokensPage() {
  const { state, dispatch, isHost } = useStore()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const gift = sp.get('tab') === 'gift'
  const [draft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('sahsah.token-draft') || '{}')
    } catch {
      return {}
    }
  })
  const [amount, setAmount] = useState(
    String(parseTokenQuantity(sp.get('amount') ?? draft.amount ?? '1') ?? 1),
  )
  const [code, setCode] = useState<string>(draft.code ?? '')
  const [promo, setPromo] = useState<string | undefined>(draft.promo)
  const [msg, setMsg] = useState('')
  const [phone, setPhone] = useState<string>(draft.phone ?? '')
  const [note, setNote] = useState<string>(draft.note ?? '')
  const quantity = parseTokenQuantity(amount)
  const subtotal = (quantity ?? 0) * TOKEN_PRICE
  const total = orderTotal({ quantity: quantity ?? 0, unitPrice: TOKEN_PRICE, promo })
  const returnTo =
    gameReturnPath(sp.get('returnTo')) ??
    (isHost && state.session
      ? state.session.phase === 'lobby'
        ? '/play?step=room'
        : `/game/${state.session.id}${state.session.phase === 'finished' ? '/results' : ''}`
      : undefined)
  const setTab = (nextGift: boolean) => {
    const next = new URLSearchParams(sp)
    if (nextGift) next.set('tab', 'gift')
    else next.delete('tab')
    setSp(next)
  }

  const apply = () => {
    const c = code.trim().toUpperCase()
    if (PROMOS[c]) {
      setPromo(c)
      setMsg(`تم تطبيق ${toAr(Math.round(PROMOS[c] * 100))}٪ خصم`)
    } else {
      setPromo(undefined)
      setMsg('الكود ده مش شغال.')
    }
  }
  const buy = async () => {
    if (!quantity) return
    if (gift && !/^0?1[0125]\d{8}$/.test(phone.replace(/\s/g, '')))
      return setMsg('اكتب رقم موبايل مصري صح للمستلم.')
    if (!state.user) {
      sessionStorage.setItem(
        'sahsah.token-draft',
        JSON.stringify({ amount, code, promo, phone, note }),
      )
      const next = new URLSearchParams(sp)
      next.set('amount', String(quantity))
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
  const tab = (on: boolean) =>
    `h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition sm:px-6 sm:text-base ${on ? 'bg-gold text-forest' : 'text-ivory/75'}`
  return (
    <div className="reveal py-6">
      <div className="relative overflow-hidden rounded-[26px] border border-gold/20">
        <img
          src={PHOTO.comedy}
          alt=""
          className="h-[240px] w-full object-cover object-[50%_40%] md:h-[260px]"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/70 to-transparent" />
        <div className="absolute inset-y-0 start-0 flex items-center p-7 md:p-12">
          <div>
            <h1 className="font-display text-4xl md:text-6xl">توكن واحد = لعبة واحدة</h1>
            <p className="mt-3 text-sm text-ivory/75">
              اختار عدد الألعاب اللي عايز تلعبها، واشتري نفس العدد من التوكنز.
            </p>
          </div>
        </div>
      </div>
      <div className="glass mt-6 inline-flex rounded-full p-1">
        <button className={tab(!gift)} onClick={() => setTab(false)}>
          اشتري لنفسك
        </button>
        <button className={tab(gift)} onClick={() => setTab(true)}>
          إهداء ألعاب
        </button>
      </div>
      <div
        className="mt-6 grid grid-cols-3 gap-2 sm:gap-4"
        role="radiogroup"
        aria-label="عدد التوكنز"
      >
        {TOKEN_PRESETS.map((count) => (
          <button
            key={count}
            role="radio"
            aria-label={`${count} توكن`}
            aria-checked={quantity === count}
            onClick={() => setAmount(String(count))}
            className={`rounded-[22px] p-3 text-center transition sm:p-6 ${quantity === count ? 'paper ring-2 ring-gold' : 'glass hover:bg-white/10'}`}
          >
            <Coins
              size={20}
              className={`mx-auto ${quantity === count ? 'text-forest/60' : 'text-gold'}`}
            />
            <div className="num mt-3 text-4xl font-bold sm:text-5xl">{toAr(count)}</div>
            <div
              className={`text-xs sm:text-sm ${quantity === count ? 'text-forest/60' : 'text-ivory/55'}`}
            >
              توكن = {toAr(count)} لعبة
            </div>
            <div className="num mt-4 text-base font-bold sm:text-xl">
              {toAr(count * TOKEN_PRICE)} ج.م
            </div>
          </button>
        ))}
      </div>
      <div
        className={`${glass} mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div>
          <label htmlFor="token-amount" className="font-display text-2xl">
            عايز عدد تاني؟
          </label>
          <p className="mt-1 text-sm text-ivory/60">
            سعر التوكن <span className="num">{toAr(TOKEN_PRICE)}</span> ج.م — لعبة كاملة.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-3">
            <button
              aria-label="تقليل عدد التوكنز"
              disabled={quantity === 1}
              onClick={() => setAmount(String(Math.max(1, (quantity ?? 1) - 1)))}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-30"
            >
              <Minus size={20} />
            </button>
            <input
              id="token-amount"
              aria-label="عدد التوكنز"
              inputMode="numeric"
              dir="ltr"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              maxLength={4}
              aria-invalid={!quantity}
              className="num h-14 w-24 rounded-xl border border-gold/40 bg-black/20 px-3 text-center text-3xl font-bold text-gold outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              aria-label="زيادة عدد التوكنز"
              disabled={quantity === MAX_TOKEN_QUANTITY}
              onClick={() => setAmount(String(Math.min(MAX_TOKEN_QUANTITY, (quantity ?? 0) + 1)))}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-30"
            >
              <Plus size={20} />
            </button>
          </div>
          {!quantity && (
            <p role="alert" className="mt-2 text-center text-xs text-[#ffb1aa]">
              اختار عدد صحيح من ١ إلى {toAr(MAX_TOKEN_QUANTITY)}.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {gift && (
          <div className={glass}>
            <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="gp">
              <Gift size={16} /> رقم المستلم
            </label>
            <input
              id="gp"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="num mt-2 h-12 w-full rounded-xl bg-white/10 px-4 text-start outline-none focus:ring-2 focus:ring-gold"
            />
            <label className="mt-4 block text-sm font-semibold" htmlFor="gn">
              رسالة
            </label>
            <input
              id="gn"
              value={note}
              maxLength={80}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl bg-white/10 px-4 outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
        )}
        <div className={glass}>
          <label className="text-sm font-semibold" htmlFor="pc">
            عندك كود خصم؟
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="pc"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SAH20"
              className="h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 uppercase outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              onClick={apply}
              className="h-12 rounded-xl bg-white/15 px-5 font-semibold hover:bg-white/25"
            >
              تطبيق
            </button>
          </div>
          {msg && (
            <p role="status" className="mt-2 text-sm text-gold">
              {msg}
            </p>
          )}
        </div>
        <div className={`${glass} flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <p className="mb-2 text-sm text-gold">
              {quantity ? `${toAr(quantity)} توكن = ${toAr(quantity)} لعبة` : 'اختار عدد التوكنز'}
            </p>
            <div className="text-sm text-ivory/60">الإجمالي</div>
            <div className="num text-4xl font-bold">{quantity ? toAr(total) : '—'} ج.م</div>
            {promo && quantity && (
              <div className="num text-sm text-ivory/40 line-through">{toAr(subtotal)}</div>
            )}
          </div>
          <button
            disabled={!quantity}
            onClick={buy}
            className="btn-play h-14 rounded-2xl px-6 text-lg font-bold"
          >
            {gift ? 'إهداء التوكنز' : 'اشتري توكنز'}
          </button>
        </div>
      </div>
    </div>
  )
}

const METHODS = [
  {
    id: 'shop',
    label: 'منفذ فوري',
    hint: 'كاش في أي محل',
    Icon: Store,
    steps: [
      'روح أقرب منفذ فوري: سوبر ماركت، صيدلية، كشك أو ماكينة فوري.',
      'قول للكاشير إنك عايز تدفع "بكود فوري" وادّيله الكود اللي فوق.',
      'اتأكد إن الاسم "صح صح" والمبلغ ظاهرين على الشاشة.',
      'ادفع المبلغ كاش واستلم الإيصال.',
      'التوكنز بتتضاف لرصيدك بعد تأكيد الدفع — توكن واحد لكل لعبة.',
    ],
  },
  {
    id: 'wallet',
    label: 'محفظة إلكترونية',
    hint: 'فودافون كاش، أورنج، e&، وي باي',
    Icon: Smartphone,
    steps: [
      'افتح تطبيق محفظتك: فودافون كاش، أورنج كاش، e& money أو وي باي.',
      'اختار "دفع فواتير" أو "فوري" من القايمة.',
      'اكتب كود فوري اللي فوق.',
      'راجع المبلغ واسم التاجر "صح صح".',
      'أكّد بالرقم السري للمحفظة وانتظر رسالة التأكيد.',
    ],
  },
  {
    id: 'bank',
    label: 'تطبيق البنك',
    hint: 'أو ماكينة ATM',
    Icon: Landmark,
    steps: [
      'افتح تطبيق البنك أو روح ماكينة ATM بتدعم خدمة فوري.',
      'اختار "مدفوعات" أو "دفع فواتير" ثم "فوري".',
      'اكتب كود فوري اللي فوق.',
      'راجع المبلغ وأكّد العملية.',
      'احتفظ بإشعار الدفع لحد ما التوكنز توصلك.',
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
  const o = orderId ? state.orders[orderId] : undefined
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('shop')
  const [issued, setIssued] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (o?.status !== 'pending') return
    const t = setTimeout(() => dispatch({ type: 'settle', orderId: o.id, ok: true }), 2200)
    return () => clearTimeout(t)
  }, [o?.status, o?.id, dispatch])
  if (!o)
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-5xl">الطلب مش موجود</h1>
        <Link to="/tokens" className="mt-6 inline-block text-gold underline">
          رجوع للتوكنز
        </Link>
      </div>
    )
  const total = orderTotal(o)
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
  return (
    <div className="grid min-h-[70dvh] place-items-center py-8">
      <div className="paper reveal w-full max-w-2xl rounded-[26px] p-6 md:p-9">
        <ol
          className="mb-7 flex items-center gap-2 text-xs font-semibold text-forest/60"
          aria-label="مراحل الدفع"
        >
          {['اختار الطريقة', 'ادفع بالكود', 'تأكيد'].map((l, i) => (
            <li key={l} className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full num text-sm font-bold ${stage > i ? 'bg-forest text-ivory' : 'bg-forest/10'}`}
              >
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
            <h1 className="mt-4 font-display text-4xl">تم الدفع</h1>
            <p className="mt-2 text-forest/65">
              {o.gift
                ? `اتسجلت هدية ${toAr(o.quantity)} توكن · ${toAr(o.quantity)} لعبة.`
                : `اتضاف ${toAr(o.quantity)} توكن لرصيدك.`}
            </p>
            <p className="mt-2 text-sm font-semibold text-forest">
              رصيدك: {toAr(state.tokens)} توكن = {toAr(state.tokens)} لعبة
            </p>
            <Link
              to={gameReturnPath(o.returnTo) ?? '/play'}
              className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold"
            >
              {o.returnTo ? 'كمّل لعبتك' : 'العب الآن'}
            </Link>
          </div>
        ) : failed ? (
          <div className="text-center">
            <h1 className="font-display text-4xl">الدفع ما تمش</h1>
            <Link
              to="/tokens"
              className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold"
            >
              حاول تاني
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 border-b border-stroke pb-4">
              <div>
                <h1 className="font-display text-4xl leading-none">ادفع عن طريق فوري</h1>
                <p className="mt-2 text-sm text-forest/65">
                  <span className="num font-bold">{toAr(o.quantity)}</span> توكن ={' '}
                  <span className="num font-bold">{toAr(o.quantity)}</span> لعبة
                  {o.promo ? ` · كود ${o.promo}` : ''}
                </p>
              </div>
              <div className="num text-3xl font-bold">
                {toAr(total)} <span className="text-lg">ج.م</span>
              </div>
            </div>

            <div
              className="mt-5 grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="طريقة الدفع"
            >
              {METHODS.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-start transition ${method === id ? 'border-gold bg-gold/15' : 'border-stroke bg-white hover:border-gold/60'}`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${method === id ? 'bg-forest text-ivory' : 'bg-forest/10'}`}
                  >
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold leading-tight">{label}</span>
                    <span className="block text-xs text-forest/60">{hint}</span>
                  </span>
                </button>
              ))}
            </div>

            {!issued ? (
              <button
                onClick={() => setIssued(true)}
                className="btn-play mt-6 h-14 w-full rounded-2xl text-lg font-bold"
              >
                اطلب كود فوري
              </button>
            ) : (
              <div className="mt-6">
                <div className="rounded-2xl bg-forest p-5 text-center text-ivory">
                  <p className="text-sm text-ivory/70">كود فوري بتاعك</p>
                  <div
                    dir="ltr"
                    className="num mt-1 text-[clamp(24px,5vw,44px)] font-bold leading-none tracking-[0.08em] text-gold"
                  >
                    {ref.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-ivory/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} /> صالح ٢٤ ساعة
                    </span>
                    <button
                      onClick={copy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 font-semibold text-ivory hover:bg-white/20"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'اتنسخ' : 'انسخ الكود'}
                    </button>
                  </div>
                </div>

                <h2 className="mt-6 font-display text-2xl">خطوات الدفع — {m.label}</h2>
                <ol className="mt-3 space-y-2.5">
                  {m.steps.map((s, i) => (
                    <li key={s} className="flex gap-3 rounded-xl bg-white p-3.5 ring-1 ring-stroke">
                      <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-forest">
                        {toAr(i + 1)}
                      </span>
                      <span className="text-[15px] leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 rounded-2xl border-2 border-dashed border-gold/70 bg-gold/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck size={16} /> محاكاة للتجربة بس
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-forest/65">
                    الكود ده شكلي ومفيش فلوس بتتسحب. دوس الزرار بعد ما تخلص الخطوات عشان تشوف شكل
                    التأكيد.
                  </p>
                  <button
                    disabled={waiting}
                    onClick={() => dispatch({ type: 'order', order: { ...o, status: 'pending' } })}
                    className="btn-play mt-3 h-12 w-full rounded-xl font-bold"
                  >
                    {waiting ? 'بنستنى تأكيد فوري…' : 'دفعت — كمّل (محاكاة)'}
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

export function ContactPage() {
  return (
    <div className="reveal py-6">
      <div className="relative overflow-hidden rounded-[28px] border border-gold/20">
        <img
          src={PHOTO.contact}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left"
        />
        <div className="absolute inset-0 bg-[#0a2a1c]/55 md:bg-transparent" />
        <div className="relative px-7 py-16 md:px-16 md:py-24">
          <img src={LOGO.wordmark} alt="" className="mb-5 h-20 w-auto" />
          <h1 className="font-display text-[clamp(44px,7vw,80px)] leading-none">محتاج مساعدة؟</h1>
          <a
            href="https://wa.me/201000000000"
            target="_blank"
            rel="noreferrer"
            className="btn-play mt-8 inline-flex h-16 items-center gap-3 rounded-2xl px-10 text-xl font-bold"
          >
            <MessageCircle size={22} /> كلمنا على واتساب
          </a>
        </div>
      </div>
    </div>
  )
}
