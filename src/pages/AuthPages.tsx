import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, Pencil } from 'lucide-react'
import { useStore } from '../lib/store'
import { Logo } from '../components/art'
import { useLang } from '../lib/i18n'

const KEY = 'sahsah.pending'
const DEMO_CODE = '123456'

const normalize = (raw: string) => raw.replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '')
const valid = (raw: string) => /^1[0125]\d{8}$/.test(normalize(raw))
const fmt = (raw: string) => {
  const n = normalize(raw).slice(0, 10)
  return n
    ? '0' +
        n.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) =>
          [a, b, c].filter(Boolean).join(' '),
        )
    : ''
}

function Card({
  children,
  title,
  sub,
}: {
  children: React.ReactNode
  title: string
  sub?: string
}) {
  return (
    <div className="grid min-h-[calc(100dvh-5rem)] place-items-center py-8">
      <div className="paper reveal w-full max-w-md rounded-[26px] p-7">
        <div className="text-center">
          <span className="inline-grid place-items-center rounded-[20px] bg-forest p-2.5">
            <Logo size={72} variant="square" />
          </span>
          <h1 className="mt-4 font-display text-[40px] leading-none">{title}</h1>
          {sub ? <p className="mt-2 text-sm text-forest/65">{sub}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}

const field =
  'mt-1.5 h-12 w-full rounded-xl border-2 border-stroke bg-white px-4 outline-none focus:border-gold'

export function LoginPage() {
  const { t } = useLang()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setErr(t('اكتب اسمك.', 'Ekteb esmak.'))
    if (!valid(phone)) return setErr(t('رقم موبايل مصري مش صح. مثال: ٠١٢٠ ٠٠٠ ٠٠٠٠', 'Raqam mobile masry mesh sa7. Masalan: 0120 000 0000'))
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        name: name.trim(),
        phone: '+20' + normalize(phone),
        at: Date.now(),
        next: next && /^\/tokens(?:\?|$)/.test(next) ? next : undefined,
      }),
    )
    nav('/auth/verify')
  }
  return (
    <Card title={t('دخول المضيف', 'Dokhool el host')}>
      <form onSubmit={submit} className="mt-6" noValidate>
        <label htmlFor="n" className="text-sm font-semibold">
          {t('الاسم', 'El esm')}
        </label>
        <input
          id="n"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setErr('')
          }}
          className={field}
          autoComplete="name"
        />
        <label htmlFor="p" className="mt-4 block text-sm font-semibold">
          {t('رقم الموبايل', 'Raqam el mobile')}
        </label>
        <input
          id="p"
          dir="ltr"
          inputMode="tel"
          value={phone}
          onChange={(e) => {
            setPhone(fmt(e.target.value))
            setErr('')
          }}
          placeholder="010 000 0000"
          className={`${field} num text-start text-lg`}
          autoComplete="tel"
        />
        {err && (
          <p role="alert" className="mt-3 text-sm font-semibold text-play">
            {err}
          </p>
        )}
        <button className="btn-play mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold">
          <MessageCircle size={20} /> {t('ابعت الكود على واتساب', 'Eb3at el code 3al WhatsApp')}
        </button>
        <p className="mt-3 text-center text-xs text-forest/55">
          {t('نسخة تجريبية: مفيش رسالة هتتبعت فعلًا.', 'Noskha tagreebeya: mafeesh resala hatetb3et.')}
        </p>
      </form>
    </Card>
  )
}

export function VerifyPage() {
  const { t } = useLang()
  const nav = useNavigate()
  const { dispatch } = useStore()
  const pending = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || 'null')
    } catch {
      return null
    }
  })()
  const [d, setD] = useState<string[]>(Array(6).fill(''))
  const [err, setErr] = useState('')
  const [wait, setWait] = useState(30)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  if (!pending)
    return (
      <Card title={t('انتهت الجلسة', 'El session khelset')}>
        <Link
          to="/auth/login"
          className="btn-play mt-6 flex h-14 items-center justify-center rounded-2xl text-lg font-bold"
        >
          {t('رجوع', 'Rogoo3')}
        </Link>
      </Card>
    )

  const set = (i: number, v: string) => {
    const x = v.replace(/\D/g, '')
    if (x.length > 1) {
      setD(
        x
          .slice(0, 6)
          .padEnd(6, ' ')
          .split('')
          .map((c) => c.trim()),
      )
      return
    }
    setErr('')
    setD((p) => p.map((c, j) => (j === i ? x : c)))
    if (x && i < 5) refs.current[i + 1]?.focus()
  }
  const code = d.join('')
  const confirm = () => {
    if (code !== DEMO_CODE)
      return setErr(t('الكود مش صح. جرّب الكود التجريبي المكتوب فوق.', 'El code mesh sa7. Garrab el code el tagreeby elly fo2.'))
    dispatch({ type: 'login', user: { name: pending.name, phone: pending.phone } })
    sessionStorage.removeItem(KEY)
    dispatch({ type: 'toast', text: t(`أهلًا يا ${pending.name}`, `Ahlan ya ${pending.name}`) })
    nav(pending.next && /^\/tokens(?:\?|$)/.test(pending.next) ? pending.next : '/account')
  }
  return (
    <Card title={t('اكتب الكود', 'Ekteb el code')}>
      <div className="-mt-3 text-center">
        <button
          onClick={() =>
            nav('/auth/login' + (pending.next ? '?next=' + encodeURIComponent(pending.next) : ''))
          }
          className="inline-flex items-center gap-1.5 text-sm text-forest/70 hover:underline"
        >
          <Pencil size={14} />{' '}
          <span dir="ltr" className="num">
            {pending.phone}
          </span>{' '}
          — {t('تعديل الرقم', 'Ghayar el raqam')}
        </button>
        <div className="mt-4 rounded-xl bg-gold/20 px-3 py-2 text-sm font-semibold">
          {t('وضع تجريبي: الكود هو', 'Wad3 tagreeby: el code howa')} <span className="num font-bold">{DEMO_CODE}</span>
        </div>
      </div>
      <div dir="ltr" className="mt-6 flex justify-center gap-2">
        {d.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={c}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={t(`رقم ${i + 1}`, `Raqam ${i + 1}`)}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !c && i > 0) refs.current[i - 1]?.focus()
            }}
            className="num h-14 min-w-0 w-full max-w-11 flex-1 rounded-xl border-2 border-stroke bg-white text-center text-2xl font-bold outline-none focus:border-gold"
          />
        ))}
      </div>
      {err && (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-play">
          {err}
        </p>
      )}
      <button
        disabled={code.length < 6}
        onClick={confirm}
        className="btn-play mt-6 h-14 w-full rounded-2xl text-lg font-bold"
      >
        {t('تأكيد والدخول', 'Akked w odkhol')}
      </button>
      <button
        disabled={wait > 0}
        onClick={() => setWait(30)}
        className="mt-3 h-11 w-full text-sm font-semibold text-forest/70 disabled:opacity-50"
      >
        {wait > 0
          ? t(`إعادة الإرسال بعد ${wait} ث`, `Eb3at tany ba3d ${wait}s`)
          : t('إعادة إرسال الكود', 'Eb3at el code tany')}
      </button>
    </Card>
  )
}
