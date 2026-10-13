import { LOGO, PHOTO } from '../lib/images'
import type { Category } from '../lib/data'

export function Logo({ size = 40, mark = false, variant }: { size?: number; mark?: boolean; variant?: keyof typeof LOGO }) {
  const v = variant ?? (mark ? 'badge' : 'plaque')
  return <img src={LOGO[v]} alt="صح صح" height={size} style={{ height: size, width: 'auto' }} className="block select-none drop-shadow-[0_4px_14px_rgba(0,0,0,.35)]" draggable={false} />
}

export function CategoryArt({ cat, className = '' }: { cat: Category; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#0a2a1c] ${className}`} aria-hidden>
      <img src={PHOTO[cat.id]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
    </div>
  )
}

export function Poster({ cat, selected = false, titleClass = 'text-[22px]', ratio = 'aspect-[4/5]', className = '', boxClass = 'min-h-[3.5rem] lg:min-h-[3rem]' }: { cat: Category; selected?: boolean; titleClass?: string; ratio?: string; className?: string; boxClass?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-[16px] bg-[#0c2a1d] ${className}`}>
      <CategoryArt cat={cat} className={`${ratio} w-full`} />
      <div className={`flex items-center justify-center border-t-[3px] px-2 py-1.5 text-center ${boxClass} transition-colors duration-200 ${selected ? 'border-[#c98a14] bg-gold text-forest' : 'border-gold/70 bg-[#0c2a1d] text-ivory'}`}>
        <div className={`font-display leading-tight ${titleClass}`}>{cat.name}</div>
      </div>
    </div>
  )
}

export function Arch({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 520" className={className} aria-hidden fill="none" stroke="currentColor">
      <path d="M20 520V200C20 100 100 20 200 20s180 80 180 180v320" strokeWidth="2" />
      <path d="M60 520V210C60 126 120 60 200 60s140 66 140 150v310" strokeWidth="1" />
      <path d="M200 20v-14M170 28l-8-10M230 28l8-10" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
