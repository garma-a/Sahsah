import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, animate } from 'motion/react'
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useLang } from '../lib/i18n'

export function Toast() {
  const { state } = useStore()
  const [shown, setShown] = useState<{ id: number; text: string } | null>(null)
  useEffect(() => {
    if (!state.toast) return
    setShown(state.toast)
    const t = setTimeout(() => setShown(null), 2500)
    return () => clearTimeout(t)
  }, [state.toast])
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ y: 40, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="rounded-full bg-gold px-6 py-3 text-[15px] font-semibold text-forest shadow-[0_14px_40px_rgba(0,0,0,.4)]"
          >
            {shown.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  tone = 'paper',
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  tone?: 'paper' | 'glass'
  wide?: boolean
}) {
  const { t } = useLang()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])',
        )
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      prev?.focus()
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-[#00110c]/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-[22px] p-6 outline-none ${wide ? 'max-w-3xl' : 'max-w-md'} ${tone === 'paper' ? 'paper' : 'glass'}`}
          >
            <button
              onClick={onClose}
              aria-label={t('إغلاق', 'E2fel')}
              className="absolute end-3 top-3 grid h-11 w-11 place-items-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100"
            >
              <X size={20} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Full-screen image viewer with zoom (buttons, wheel, double-click) and drag-to-pan. */
export function Lightbox({
  src,
  alt,
  onClose,
  imgStyle,
}: {
  src: string | null
  alt: string
  onClose: () => void
  /** Same crop / filter as the in-game image, so zooming never reveals more than the round allows. */
  imgStyle?: React.CSSProperties
}) {
  const { t } = useLang()
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const zoom = useCallback((delta: number) => {
    setScale((s) => {
      const next = Math.min(5, Math.max(1, +(s + delta).toFixed(2)))
      if (next === 1) setPos({ x: 0, y: 0 })
      return next
    })
  }, [])
  useEffect(() => {
    if (!src) return
    setScale(1)
    setPos({ x: 0, y: 0 })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoom(0.5)
      if (e.key === '-') zoom(-0.5)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [src, onClose, zoom])
  const tool =
    'grid h-12 w-12 place-items-center rounded-full bg-white/10 text-ivory transition hover:bg-white/20 disabled:opacity-35'
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[90] flex flex-col bg-[#00110c]/95 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between gap-2 p-3">
            <div className="flex items-center gap-2">
              <button className={tool} onClick={() => zoom(0.5)} disabled={scale >= 5} aria-label={t('تكبير', 'Kabbar')}>
                <Plus size={20} />
              </button>
              <span className="num w-14 text-center text-sm text-ivory/70">{Math.round(scale * 100)}%</span>
              <button className={tool} onClick={() => zoom(-0.5)} disabled={scale <= 1} aria-label={t('تصغير', 'Sagghar')}>
                <Minus size={20} />
              </button>
              <button
                className={tool}
                onClick={() => {
                  setScale(1)
                  setPos({ x: 0, y: 0 })
                }}
                aria-label={t('رجّع الحجم', 'Rag3 el 7agm')}
              >
                <RotateCcw size={18} />
              </button>
            </div>
            <button className={tool} onClick={onClose} aria-label={t('إغلاق', 'E2fel')}>
              <X size={22} />
            </button>
          </div>
          <div
            className={`relative min-h-0 flex-1 touch-none overflow-hidden ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
            onWheel={(e) => zoom(e.deltaY < 0 ? 0.25 : -0.25)}
            onDoubleClick={() => (scale > 1 ? (setScale(1), setPos({ x: 0, y: 0 })) : setScale(2.5))}
            onPointerDown={(e) => {
              if (scale === 1) return
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (d) setPos({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })
            }}
            onPointerUp={() => (drag.current = null)}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain p-2 transition-transform duration-100"
              style={{ ...imgStyle, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Image that opens in the Lightbox; contained inside a fixed max box so small images stay small. */
export function ZoomableImage({
  src,
  alt,
  className = '',
  imgClassName = '',
  style,
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  style?: React.CSSProperties
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block cursor-zoom-in ${className}`}
        aria-label={t('كبّر الصورة', 'Kabbar el soora')}
      >
        <img src={src} alt={alt} draggable={false} className={imgClassName} style={style} />
        <span className="pointer-events-none absolute bottom-2 end-2 grid h-9 w-9 place-items-center rounded-full bg-deep/75 text-gold opacity-80 backdrop-blur transition group-hover:opacity-100">
          <Maximize2 size={16} />
        </span>
      </button>
      <Lightbox src={open ? src : null} alt={alt} imgStyle={style} onClose={() => setOpen(false)} />
    </>
  )
}

/** Shrinks its text until it fits the parent box (the box must have a bounded height). */
export function FitText({
  children,
  max = 56,
  min = 16,
  className = '',
}: {
  children: ReactNode
  max?: number
  min?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const fit = useCallback(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    let lo = min
    let hi = max
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      i.style.fontSize = `${mid}px`
      if (i.scrollHeight <= b.clientHeight && i.scrollWidth <= b.clientWidth) lo = mid
      else hi = mid
    }
    i.style.fontSize = `${lo}px`
  }, [max, min])
  useLayoutEffect(fit, [fit, children])
  useEffect(() => {
    const b = box.current
    if (!b) return
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    void document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [fit])
  return (
    <div ref={box} className="h-full min-h-0 w-full overflow-hidden">
      <div ref={inner} className={className}>
        {children}
      </div>
    </div>
  )
}

/** Horizontal snap carousel with arrows, dots and optional autoplay. */
export function Carousel({
  children,
  label,
  autoplay = 0,
  slideClass = 'w-[82%] sm:w-[46%] lg:w-[31%]',
  className = '',
  dots = true,
}: {
  children: ReactNode
  label: string
  autoplay?: number
  slideClass?: string
  className?: string
  dots?: boolean
}) {
  const { t, ar } = useLang()
  const track = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const go = useCallback((i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined
    const tr = track.current
    if (!el || !tr) return
    // Works in both RTL and LTR, where scrollLeft has opposite signs.
    const delta =
      el.getBoundingClientRect().left +
      el.clientWidth / 2 -
      (tr.getBoundingClientRect().left + tr.clientWidth / 2)
    tr.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])
  useEffect(() => {
    const tr = track.current
    if (!tr) return
    const onScroll = () => {
      const mid = tr.getBoundingClientRect().left + tr.clientWidth / 2
      let best = 0
      let dist = Infinity
      Array.from(tr.children).forEach((c, i) => {
        const r = c.getBoundingClientRect()
        const d = Math.abs(r.left + r.width / 2 - mid)
        if (d < dist) {
          dist = d
          best = i
        }
      })
      setActive(best)
    }
    tr.addEventListener('scroll', onScroll, { passive: true })
    return () => tr.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!autoplay || paused || items.length < 2) return
    const id = setInterval(() => go((active + 1) % items.length), autoplay)
    return () => clearInterval(id)
  }, [autoplay, paused, active, items.length, go])
  const arrow =
    'absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-gold/30 bg-deep/80 text-gold backdrop-blur transition hover:bg-deep md:grid'
  const Prev = ar ? ChevronRight : ChevronLeft
  const Next = ar ? ChevronLeft : ChevronRight
  return (
    <div
      className={`relative ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1">
        {items.map((child, i) => (
          <div
            key={i}
            className={`shrink-0 snap-center ${slideClass}`}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${items.length}`}
          >
            {child}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button
            className={`${arrow} start-2`}
            onClick={() => go(Math.max(0, active - 1))}
            aria-label={t('السابق', 'El Sabe2')}
          >
            <Prev size={22} />
          </button>
          <button
            className={`${arrow} end-2`}
            onClick={() => go(Math.min(items.length - 1, active + 1))}
            aria-label={t('التالي', 'El Tale')}
          >
            <Next size={22} />
          </button>
          {dots && (
            <div className="mt-4 flex justify-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`${i + 1}`}
                  aria-current={i === active}
                  className={`h-2.5 rounded-full transition-all ${i === active ? 'w-8 bg-gold' : 'w-2.5 bg-ivory/25 hover:bg-ivory/45'}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function RollingNumber({ value, className = '' }: { value: number; className?: string }) {
  const [v, setV] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (x) => setV(Math.round(x)),
    })
    prev.current = value
    return () => c.stop()
  }, [value])
  return <span className={`num ${className}`}>{v}</span>
}

export function useTimerMs() {
  const { state } = useStore()
  const t = state.session?.timer
  const [, tick] = useState(0)
  useEffect(() => {
    if (t?.status !== 'running') return
    const i = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(i)
  }, [t?.status])
  if (!t) return { ms: 0, t: null }
  const ms =
    t.status === 'running' && t.startedAt
      ? Math.max(0, t.remainingMs - (Date.now() - t.startedAt))
      : t.remainingMs
  return { ms, t }
}
