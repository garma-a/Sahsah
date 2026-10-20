import { Brain, Eye, EyeOff } from 'lucide-react'
import type { DemoPictureQuestion, MemoryQuestion } from '../lib/game-types'
import { useStore } from '../lib/store'
import { useLang } from '../lib/i18n'
import { ZoomableImage } from './ui'

/**
 * Template 1.1 — question image → answer image (person / colour / proverb rounds).
 * Template 4 — "Rakez M3aya": picture → question → answer, fully host-controlled.
 * The media fills its parent box; the image keeps a fixed max size and smaller images stay small.
 */
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
  const { t } = useLang()
  const memory = q.type === 'IMAGE_MEMORY' ? q : undefined
  const visible = revealed || !memory || memory.memoryPhase === 'viewing'
  const src = revealed ? q.answer?.imageUrl || q.imageUrl : q.imageUrl
  const crop =
    q.type === 'IMAGE_PERSON' && !revealed
      ? q.crop === 'lower'
        ? 'inset(42% 15% 27% 15%)'
        : q.crop === 'center'
          ? 'inset(27% 18% 38% 18%)'
          : 'inset(27% 12% 48% 12%)'
      : undefined
  const style = {
    filter: q.type === 'IMAGE_COLOR' && !revealed ? 'grayscale(1)' : undefined,
    clipPath: crop,
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-game-mode={q.type}>
      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[22px] border border-gold/25 bg-[#0b2a20]">
        {visible ? (
          <ZoomableImage
            key={src}
            src={src}
            alt={revealed ? t('صورة الإجابة', 'Soret el egaba') : t('صورة التحدي', 'Soret el ta7addy')}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain transition-[filter,clip-path] duration-700"
            style={style}
          />
        ) : (
          <div className="flex max-w-sm flex-col items-center px-5 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border border-gold/25 bg-gold/10 text-gold short:h-14 short:w-14">
              {memory?.memoryPhase === 'ready' ? <Brain size={36} strokeWidth={1.5} /> : <EyeOff size={36} strokeWidth={1.5} />}
            </div>
            <p className="mt-3 font-display text-3xl text-ivory short:text-2xl">
              {memory?.memoryPhase === 'ready' ? t('عيونك معانا؟', '3eneek ma3ana?') : t('الصورة اختفت!', 'El soora e5tafet!')}
            </p>
            {host && memory?.memoryPhase === 'ready' && (
              <button
                disabled={busy}
                onClick={() => dispatch({ type: 'startMemory' })}
                className="btn-play mt-4 inline-flex min-h-14 items-center gap-2 rounded-2xl px-7 text-lg font-bold disabled:opacity-50"
              >
                <Eye size={19} /> {t('اعرض الصورة', 'E3red el soora')}
              </button>
            )}
            {!host && memory?.memoryPhase === 'ready' && (
              <p className="mt-3 text-xs text-gold">{t('المضيف هيعرض الصورة', 'El host hay3red el soora')}</p>
            )}
          </div>
        )}
      </div>
      {/* Template 4: the host decides when to hide the picture and can always go back to it. */}
      {memory && !revealed && host && memory.memoryPhase !== 'ready' && (
        <button
          disabled={busy}
          onClick={() => dispatch({ type: memory.memoryPhase === 'viewing' ? 'hideMemory' : 'resetMemory' })}
          className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-[16px] font-bold transition disabled:opacity-50 ${
            memory.memoryPhase === 'viewing' ? 'bg-gold text-forest hover:brightness-105' : 'border border-white/20 text-ivory hover:bg-white/5'
          }`}
        >
          {memory.memoryPhase === 'viewing' ? <EyeOff size={18} /> : <Eye size={18} />}
          {memory.memoryPhase === 'viewing'
            ? t('حفظناها — اسألنا', '7afaznaha — es2alna')
            : t('ارجع للصورة', 'Erga3 lel soora')}
        </button>
      )}
    </div>
  )
}
