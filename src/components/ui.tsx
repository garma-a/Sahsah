import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, animate } from 'motion/react'
import { X } from 'lucide-react'
import { useStore } from '../lib/store'

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
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4" role="status" aria-live="polite">
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

export function Modal({ open, onClose, title, children, tone = 'paper' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tone?: 'paper' | 'glass' }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,a,input,[tabindex]:not([tabindex="-1"])')
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
        <motion.div className="fixed inset-0 z-[70] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
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
            className={`relative w-full max-w-md rounded-[22px] p-6 outline-none ${tone === 'paper' ? 'paper' : 'glass'}`}
          >
            <button onClick={onClose} aria-label="إغلاق" className="absolute top-3 start-3 grid h-11 w-11 place-items-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100">
              <X size={20} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function RollingNumber({ value, className = '' }: { value: number; className?: string }) {
  const [v, setV] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(Math.round(x)) })
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
  const ms = t.status === 'running' && t.startedAt ? Math.max(0, t.remainingMs - (Date.now() - t.startedAt)) : t.remainingMs
  return { ms, t }
}
