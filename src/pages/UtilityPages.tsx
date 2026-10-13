import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, Clock, Coins, Copy, Gift, Landmark, MessageCircle, Receipt, ShieldCheck, Smartphone, Store } from 'lucide-react'
import { BUNDLES, toAr } from '../lib/data'
import { PROMOS, useStore } from '../lib/store'
import { PHOTO, LOGO } from '../lib/images'

const glass = 'glass rounded-[22px] p-6'

export function AccountPage() {
  const { state, dispatch } = useStore()
  const u = state.user
  if (!u)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center">
        <div>
          <h1 className="font-display text-5xl">سجّل دخولك</h1>
          <Link to="/auth/login" className="btn-play mt-8 inline-flex h-14 items-center rounded-2xl px-8 text-lg font-bold">دخول المضيف</Link>
        </div>
      </div>
    )
  return (
    <div className="reveal py-6">
      <h1 className="font-display text-5xl">أهلًا يا {u.name}</h1>
      <p dir="ltr" className="num mt-1 text-start text-ivory/55">{u.phone}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[22px] border border-gold/20 p-6 md:min-h-[300px]">
          <img src={PHOTO.coins} alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/75 to-[#0a2a1c]/0" />
          <div className="relative">
          <div className="text-sm text-ivory/70">رصيدك</div>
          <div className="mt-1 flex items-center gap-3"><span className="num text-6xl font-bold text-gold">{toAr(state.coins)}</span><Coins className="text-gold" /></div>
          <Link to="/tokens" className="btn-play mt-6 inline-flex h-12 items-center rounded-xl px-6 font-bold">اشتري الباقة</Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[22px] border border-gold/20 p-6">
          <img src={PHOTO.flow} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0a2a1c]/70" />
          <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-sm text-ivory/60"><Receipt size={16} /> آخر النشاط</div>
          {state.activity.length === 0 ? <p className="text-ivory/50">لسه مفيش نشاط.</p> : <ul className="space-y-2">{state.activity.map((a) => <li key={a.id} className="flex justify-between rounded-xl bg-black/30 px-4 py-3 backdrop-blur"><span>{a.text}</span><span className="num text-sm text-ivory/40">{new Date(a.at).toLocaleDateString('ar-EG')}</span></li>)}</ul>}
          </div>
        </div>
      </div>
      <button onClick={() => dispatch({ type: 'logout' })} className="mt-8 h-11 rounded-full border border-white/20 px-6 text-sm text-ivory/80 hover:bg-white/10">تسجيل خروج</button>
    </div>
  )
}

export function TokensPage() {
  const { state, dispatch } = useStore()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const gift = sp.get('tab') === 'gift'
  const [sel, setSel] = useState('b2')
  const [code, setCode] = useState('')
  const [promo, setPromo] = useState<string | undefined>()
  const [msg, setMsg] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const b = BUNDLES.find((x) => x.id === sel)!
  const disc = promo ? PROMOS[promo] : 0
  const total = Math.round(b.price * (1 - disc))

  const apply = () => {
    const c = code.trim().toUpperCase()
    if (PROMOS[c]) { setPromo(c); setMsg(`تم تطبيق ${toAr(Math.round(PROMOS[c] * 100))}٪ خصم`) }
    else { setPromo(undefined); setMsg('الكود ده مش شغال.') }
  }
  const buy = () => {
    if (!state.user) return nav('/auth/login')
    if (gift && !/^0?1[0125]\d{8}$/.test(phone.replace(/\s/g, ''))) return setMsg('اكتب رقم موبايل مصري صح للمستلم.')
    const id = Math.random().toString(36).slice(2, 8)
    dispatch({ type: 'order', order: { id, bundleId: sel, promo, gift: gift ? { phone, note } : undefined, status: 'review' } })
    nav(`/checkout/${id}`)
  }
  const tab = (on: boolean) => `h-11 rounded-full px-6 font-semibold transition ${on ? 'bg-gold text-forest' : 'text-ivory/75'}`
  return (
    <div className="reveal py-6">
      <div className="relative overflow-hidden rounded-[26px] border border-gold/20">
        <img src={PHOTO.comedy} alt="" className="h-[200px] w-full object-cover object-[50%_40%] md:h-[260px]" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/70 to-transparent" />
        <div className="absolute inset-y-0 start-0 flex items-center p-7 md:p-12">
          <h1 className="font-display text-5xl md:text-6xl">العملات</h1>
        </div>
      </div>
      <div className="glass mt-6 inline-flex rounded-full p-1">
        <button className={tab(!gift)} onClick={() => setSp({})}>اشتري</button>
        <button className={tab(gift)} onClick={() => setSp({ tab: 'gift' })}>إهداء</button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="الباقات">
        {BUNDLES.map((x) => (
          <button key={x.id} role="radio" aria-checked={sel === x.id} onClick={() => setSel(x.id)} className={`rounded-[22px] p-6 text-start transition ${sel === x.id ? 'paper ring-2 ring-gold' : 'glass hover:bg-white/10'}`}>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${sel === x.id ? 'bg-gold/30' : 'bg-white/10'}`}>{x.tag}</span>
            <div className="num mt-4 text-5xl font-bold">{toAr(x.coins)}</div>
            <div className={`text-sm ${sel === x.id ? 'text-forest/60' : 'text-ivory/55'}`}>عملة</div>
            <div className="num mt-4 text-xl font-bold">{toAr(x.price)} ج.م</div>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {gift && (
          <div className={glass}>
            <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="gp"><Gift size={16} /> رقم المستلم</label>
            <input id="gp" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num mt-2 h-12 w-full rounded-xl bg-white/10 px-4 text-start outline-none focus:ring-2 focus:ring-gold" />
            <label className="mt-4 block text-sm font-semibold" htmlFor="gn">رسالة</label>
            <input id="gn" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} className="mt-2 h-12 w-full rounded-xl bg-white/10 px-4 outline-none focus:ring-2 focus:ring-gold" />
          </div>
        )}
        <div className={glass}>
          <label className="text-sm font-semibold" htmlFor="pc">عندك كود خصم؟</label>
          <div className="mt-2 flex gap-2">
            <input id="pc" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAH20" className="h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 uppercase outline-none focus:ring-2 focus:ring-gold" />
            <button onClick={apply} className="h-12 rounded-xl bg-white/15 px-5 font-semibold hover:bg-white/25">تطبيق</button>
          </div>
          {msg && <p role="status" className="mt-2 text-sm text-gold">{msg}</p>}
        </div>
        <div className={`${glass} flex items-center justify-between`}>
          <div>
            <div className="text-sm text-ivory/60">الإجمالي</div>
            <div className="num text-4xl font-bold">{toAr(total)} ج.م</div>
            {promo && <div className="num text-sm text-ivory/40 line-through">{toAr(b.price)}</div>}
          </div>
          <button onClick={buy} className="btn-play h-14 rounded-2xl px-8 text-lg font-bold">{gift ? 'إهداء' : 'اشتري الباقة'}</button>
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
      'العملات بتتضاف لرصيدك أوتوماتيك خلال دقايق.',
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
      'احتفظ بإشعار الدفع لحد ما العملات توصلك.',
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
  if (!o) return <div className="py-20 text-center"><h1 className="font-display text-5xl">الطلب مش موجود</h1><Link to="/tokens" className="mt-6 inline-block text-gold underline">رجوع للعملات</Link></div>
  const b = BUNDLES.find((x) => x.id === o.bundleId)!
  const total = Math.round(b.price * (1 - (o.promo ? PROMOS[o.promo] : 0)))
  const ref = refFor(o.id)
  const m = METHODS.find((x) => x.id === method)!
  const copy = async () => {
    try { await navigator.clipboard.writeText(ref) } catch { /* ignore */ }
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
        <ol className="mb-7 flex items-center gap-2 text-xs font-semibold text-forest/60" aria-label="مراحل الدفع">
          {['اختار الطريقة', 'ادفع بالكود', 'تأكيد'].map((l, i) => (
            <li key={l} className="flex flex-1 items-center gap-2">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full num text-sm font-bold ${stage > i ? 'bg-forest text-ivory' : 'bg-forest/10'}`}>{toAr(i + 1)}</span>
              <span className={stage > i ? 'text-forest' : ''}>{l}</span>
              {i < 2 && <span className="h-px flex-1 bg-forest/15" />}
            </li>
          ))}
        </ol>

        {done ? (
          <div className="text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-forest"><Check size={34} strokeWidth={3} /></div>
            <h1 className="mt-4 font-display text-4xl">تم الدفع</h1>
            <p className="mt-2 text-forest/65">{o.gift ? 'الهدية اتسجلت.' : `اتضافت ${toAr(b.coins)} عملة لرصيدك.`}</p>
            <Link to="/play" className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold">العب الآن</Link>
          </div>
        ) : failed ? (
          <div className="text-center">
            <h1 className="font-display text-4xl">الدفع ما تمش</h1>
            <Link to="/tokens" className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold">حاول تاني</Link>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 border-b border-stroke pb-4">
              <div>
                <h1 className="font-display text-4xl leading-none">ادفع عن طريق فوري</h1>
                <p className="mt-2 text-sm text-forest/65"><span className="num font-bold">{toAr(b.coins)}</span> عملة{o.promo ? ` · كود ${o.promo}` : ''}</p>
              </div>
              <div className="num text-3xl font-bold">{toAr(total)} <span className="text-lg">ج.م</span></div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="طريقة الدفع">
              {METHODS.map(({ id, label, hint, Icon }) => (
                <button key={id} role="radio" aria-checked={method === id} onClick={() => setMethod(id)} className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-start transition ${method === id ? 'border-gold bg-gold/15' : 'border-stroke bg-white hover:border-gold/60'}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${method === id ? 'bg-forest text-ivory' : 'bg-forest/10'}`}><Icon size={20} /></span>
                  <span><span className="block text-[15px] font-bold leading-tight">{label}</span><span className="block text-xs text-forest/60">{hint}</span></span>
                </button>
              ))}
            </div>

            {!issued ? (
              <button onClick={() => setIssued(true)} className="btn-play mt-6 h-14 w-full rounded-2xl text-lg font-bold">اطلب كود فوري</button>
            ) : (
              <div className="mt-6">
                <div className="rounded-2xl bg-forest p-5 text-center text-ivory">
                  <p className="text-sm text-ivory/70">كود فوري بتاعك</p>
                  <div dir="ltr" className="num mt-1 text-[44px] font-bold leading-none tracking-[0.12em] text-gold">{ref.replace(/(\d{3})(?=\d)/g, '$1 ')}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-ivory/70">
                    <span className="inline-flex items-center gap-1.5"><Clock size={14} /> صالح ٢٤ ساعة</span>
                    <button onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 font-semibold text-ivory hover:bg-white/20">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'اتنسخ' : 'انسخ الكود'}</button>
                  </div>
                </div>

                <h2 className="mt-6 font-display text-2xl">خطوات الدفع — {m.label}</h2>
                <ol className="mt-3 space-y-2.5">
                  {m.steps.map((s, i) => (
                    <li key={s} className="flex gap-3 rounded-xl bg-white p-3.5 ring-1 ring-stroke">
                      <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-forest">{toAr(i + 1)}</span>
                      <span className="text-[15px] leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 rounded-2xl border-2 border-dashed border-gold/70 bg-gold/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} /> محاكاة للتجربة بس</p>
                  <p className="mt-1 text-xs leading-relaxed text-forest/65">الكود ده شكلي ومفيش فلوس بتتسحب. دوس الزرار بعد ما تخلص الخطوات عشان تشوف شكل التأكيد.</p>
                  <button disabled={waiting} onClick={() => dispatch({ type: 'order', order: { ...o, status: 'pending' } })} className="btn-play mt-3 h-12 w-full rounded-xl font-bold">{waiting ? 'بنستنى تأكيد فوري…' : 'دفعت — كمّل (محاكاة)'}</button>
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
        <img src={PHOTO.contact} alt="" className="absolute inset-0 h-full w-full object-cover object-left" />
        <div className="absolute inset-0 bg-[#0a2a1c]/55 md:bg-transparent" />
        <div className="relative px-7 py-16 md:px-16 md:py-24">
          <img src={LOGO.wordmark} alt="" className="mb-5 h-20 w-auto" />
          <h1 className="font-display text-[clamp(44px,7vw,80px)] leading-none">محتاج مساعدة؟</h1>
          <a href="https://wa.me/201000000000" target="_blank" rel="noreferrer" className="btn-play mt-8 inline-flex h-16 items-center gap-3 rounded-2xl px-10 text-xl font-bold"><MessageCircle size={22} /> كلمنا على واتساب</a>
        </div>
      </div>
    </div>
  )
}
