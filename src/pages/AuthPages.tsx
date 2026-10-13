import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Pencil } from 'lucide-react'
import { useStore } from '../lib/store'
import { Logo } from '../components/art'

const KEY = 'sahsah.pending'
const DEMO_CODE = '123456'

const normalize = (raw: string) => raw.replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '')
const valid = (raw: string) => /^1[0125]\d{8}$/.test(normalize(raw))
const fmt = (raw: string) => {
  const n = normalize(raw).slice(0, 10)
  return n ? '0' + n.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : ''
}

function Card({ children, title, sub }: { children: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="grid min-h-[calc(100dvh-5rem)] place-items-center py-8">
      <div className="paper reveal w-full max-w-md rounded-[26px] p-7">
        <div className="text-center">
          <span className="inline-grid place-items-center rounded-[20px] bg-forest p-2.5"><Logo size={72} variant="square" /></span>
          <h1 className="mt-4 font-display text-[40px] leading-none">{title}</h1>
          {sub ? <p className="mt-2 text-sm text-forest/65">{sub}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}

const field = 'mt-1.5 h-12 w-full rounded-xl border-2 border-stroke bg-white px-4 outline-none focus:border-gold'

export function LoginPage() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setErr('اكتب اسمك.')
    if (!valid(phone)) return setErr('رقم موبايل مصري مش صح. مثال: ٠١٢٠ ٠٠٠ ٠٠٠٠')
    sessionStorage.setItem(KEY, JSON.stringify({ name: name.trim(), phone: '+20' + normalize(phone), at: Date.now() }))
    nav('/auth/verify')
  }
  return (
    <Card title="دخول المضيف">
      <form onSubmit={submit} className="mt-6" noValidate>
        <label htmlFor="n" className="text-sm font-semibold">الاسم</label>
        <input id="n" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} className={field} autoComplete="name" />
        <label htmlFor="p" className="mt-4 block text-sm font-semibold">رقم الموبايل</label>
        <input id="p" dir="ltr" inputMode="tel" value={phone} onChange={(e) => { setPhone(fmt(e.target.value)); setErr('') }} placeholder="010 000 0000" className={`${field} num text-start text-lg`} autoComplete="tel" />
        {err && <p role="alert" className="mt-3 text-sm font-semibold text-play">{err}</p>}
        <button className="btn-play mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold"><MessageCircle size={20} /> ابعت الكود على واتساب</button>
        <p className="mt-3 text-center text-xs text-forest/55">نسخة تجريبية: مفيش رسالة هتتبعت فعلًا.</p>
      </form>
    </Card>
  )
}

export function VerifyPage() {
  const nav = useNavigate()
  const { dispatch } = useStore()
  const pending = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null } })()
  const [d, setD] = useState<string[]>(Array(6).fill(''))
  const [err, setErr] = useState('')
  const [wait, setWait] = useState(30)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  if (!pending) return <Card title="انتهت الجلسة"><Link to="/auth/login" className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold">رجوع</Link></Card>

  const set = (i: number, v: string) => {
    const x = v.replace(/\D/g, '')
    if (x.length > 1) { setD(x.slice(0, 6).padEnd(6, ' ').split('').map((c) => c.trim())); return }
    setErr('')
    setD((p) => p.map((c, j) => (j === i ? x : c)))
    if (x && i < 5) refs.current[i + 1]?.focus()
  }
  const code = d.join('')
  const confirm = () => {
    if (code !== DEMO_CODE) return setErr('الكود مش صح. جرّب الكود التجريبي المكتوب فوق.')
    dispatch({ type: 'login', user: { name: pending.name, phone: pending.phone } })
    sessionStorage.removeItem(KEY)
    dispatch({ type: 'toast', text: `أهلًا يا ${pending.name}` })
    nav('/account')
  }
  return (
    <Card title="اكتب الكود">
      <div className="-mt-3 text-center">
        <button onClick={() => nav('/auth/login')} className="inline-flex items-center gap-1.5 text-sm text-forest/70 hover:underline"><Pencil size={14} /> <span dir="ltr" className="num">{pending.phone}</span> — تعديل الرقم</button>
        <div className="mt-4 rounded-xl bg-gold/20 px-3 py-2 text-sm font-semibold">وضع تجريبي: الكود هو <span className="num font-bold">{DEMO_CODE}</span></div>
      </div>
      <div dir="ltr" className="mt-6 flex justify-center gap-2">
        {d.map((c, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el }} value={c} inputMode="numeric" autoComplete="one-time-code" aria-label={`رقم ${i + 1}`} onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Backspace' && !c && i > 0) refs.current[i - 1]?.focus() }} className="num h-14 w-11 rounded-xl border-2 border-stroke bg-white text-center text-2xl font-bold outline-none focus:border-gold" />
        ))}
      </div>
      {err && <p role="alert" className="mt-3 text-center text-sm font-semibold text-play">{err}</p>}
      <button disabled={code.length < 6} onClick={confirm} className="btn-play mt-6 h-14 w-full rounded-2xl text-lg font-bold">تأكيد والدخول</button>
      <button disabled={wait > 0} onClick={() => setWait(30)} className="mt-3 h-11 w-full text-sm font-semibold text-forest/70 disabled:opacity-50">{wait > 0 ? `إعادة الإرسال بعد ${wait} ث` : 'إعادة إرسال الكود'}</button>
    </Card>
  )
}
