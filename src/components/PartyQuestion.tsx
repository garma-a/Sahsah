import { useEffect, useState } from 'react'
import { Brain, Eye, EyeOff, ScanFace, Timer, Sparkles } from 'lucide-react'
import type { DemoPictureQuestion, MemoryQuestion } from '../lib/game-types'
import { toAr } from '../lib/data'
import { useStore } from '../lib/store'

export default function PartyQuestion({
  question: q,
  host,
  revealed,
}: {
  question: DemoPictureQuestion | MemoryQuestion
  host: boolean
  revealed: boolean
}) {
  const { dispatch, busy } = useStore()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (q.type !== 'IMAGE_MEMORY' || q.memoryPhase !== 'viewing' || revealed) return
    const tick = setInterval(() => setNow(Date.now()), 80)
    return () => clearInterval(tick)
  }, [q.type, q.type === 'IMAGE_MEMORY' ? q.memoryPhase : null, revealed])
  const memory = q.type === 'IMAGE_MEMORY' ? q : undefined
  const remaining = memory ? Math.max(0, (memory.memoryEndsAt ?? now) - now) : 0
  const visible = revealed || !memory || (memory.memoryPhase === 'viewing' && remaining > 0)
  const crop =
    q.type === 'IMAGE_PERSON' && !revealed
      ? q.crop === 'lower'
        ? 'inset(42% 15% 27% 15%)'
        : q.crop === 'center'
          ? 'inset(27% 18% 38% 18%)'
          : 'inset(27% 12% 48% 12%)'
      : undefined
  return (
    <div className="flex min-w-0 flex-col gap-3" data-game-mode={q.type}>
      <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-[24px] border border-gold/25 bg-[#0b2a20] shadow-[0_24px_60px_rgba(0,0,0,.4)] sm:min-h-[440px] lg:min-h-[500px]">
        {visible ? (
          <div className="relative aspect-[4/3] w-full">
            <img
              src={q.imageUrl}
              alt={revealed ? 'الصورة كاملة بعد كشف الإجابة' : 'صورة التحدي'}
              draggable={false}
              className="h-full w-full object-contain transition-[filter,clip-path] duration-700"
              style={{
                filter: q.type === 'IMAGE_COLOR' && !revealed ? 'grayscale(1)' : undefined,
                clipPath: crop,
              }}
            />
            {crop && (
              <div className="pointer-events-none absolute inset-x-[10%] top-[25%] h-[50%] rounded-2xl border border-dashed border-gold/35" />
            )}
          </div>
        ) : (
          <div className="flex max-w-sm flex-col items-center px-6 py-12 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full border border-gold/25 bg-gold/10 text-gold">
              {memory?.memoryPhase === 'ready' ? (
                <Brain size={42} strokeWidth={1.5} />
              ) : (
                <EyeOff size={42} strokeWidth={1.5} />
              )}
            </div>
            <h2 className="mt-5 font-display text-4xl text-ivory">
              {memory?.memoryPhase === 'ready' ? 'عيونك معانا؟' : 'الصورة اختفت!'}
            </h2>
            <p className="mt-2 text-sm leading-7 text-ivory/65">
              {memory?.memoryPhase === 'ready'
                ? `قدامك ${toAr(memory.memorySeconds)} ثواني تحفظ فيها الألوان والتفاصيل. السؤال هيظهر بعدها.`
                : 'افتكر التفاصيل اللي شفتها… وجاوب السؤال من ذاكرتك.'}
            </p>
            {host && memory?.memoryPhase === 'ready' && (
              <button
                disabled={busy}
                onClick={() => dispatch({ type: 'startMemory' })}
                className="btn-play mt-7 inline-flex min-h-14 items-center gap-2 rounded-2xl px-7 text-lg font-bold disabled:opacity-50"
              >
                <Eye size={19} /> اعرض الصورة
              </button>
            )}
            {!host && memory?.memoryPhase === 'ready' && (
              <p className="mt-5 text-xs text-gold">المضيف هيعرض الصورة للشلة</p>
            )}
          </div>
        )}
        {!memory && !revealed && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-deep/90 to-transparent pb-4 pt-8">
            <span className="flex items-center gap-2 rounded-full border border-gold/20 bg-deep/80 px-4 py-2 text-xs text-gold backdrop-blur">
              {q.type === 'IMAGE_PERSON' ? (
                <ScanFace size={16} />
              ) : q.type === 'IMAGE_COLOR' ? (
                <Eye size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {q.type === 'IMAGE_PERSON'
                ? 'جزء صغير… اسم كبير'
                : q.type === 'IMAGE_COLOR'
                  ? 'افتكر اللون الأصلي'
                  : 'كل تفصيلة في الرسمة ليها معنى'}
            </span>
          </div>
        )}
        {memory && !revealed && memory.memoryPhase === 'viewing' && remaining > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-deep/95 px-5 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm text-gold">
              <span className="inline-flex items-center gap-2">
                <Timer size={16} /> ركز في التفاصيل
              </span>
              <span className="num font-bold" role="timer" aria-label="وقت حفظ الصورة">
                {toAr(Math.ceil(remaining / 1000))}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" dir="ltr">
              <div
                className="h-full rounded-full bg-gold transition-[width]"
                style={{ width: `${(remaining / (memory.memorySeconds * 1000)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {memory && !revealed && host && memory.memoryPhase !== 'ready' && (
        <button
          disabled={busy}
          onClick={() =>
            dispatch({ type: memory.memoryPhase === 'viewing' ? 'hideMemory' : 'resetMemory' })
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-ivory/70 hover:bg-white/5 disabled:opacity-50"
        >
          {memory.memoryPhase === 'viewing' ? <EyeOff size={16} /> : <Eye size={16} />}
          {memory.memoryPhase === 'viewing' ? 'خلاص، اسألني' : 'عرض الصورة من جديد'}
        </button>
      )}
      {memory && !revealed && (
        <div className="flex items-center justify-center gap-2 text-xs text-ivory/50">
          {['احفظ الصورة', 'جاوب من ذاكرتك', 'اكشف الإجابة'].map((step, index) => (
            <span
              key={step}
              className={`rounded-full px-2 py-1 ${index === (memory.memoryPhase === 'recall' ? 1 : 0) ? 'bg-gold/10 text-gold' : ''}`}
            >
              {toAr(index + 1)}. {step}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
