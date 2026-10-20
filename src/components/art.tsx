import { LOGO, PHOTO } from '../lib/images'
import type { Category } from '../lib/data'
import { useLang } from '../lib/i18n'

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

// Posters use A4 portrait proportions (210 × 297).
export function Poster({ cat, selected = false, titleClass = 'text-[22px]', ratio = 'aspect-[210/297]', className = '', boxClass = 'min-h-[3.5rem] lg:min-h-[3rem]' }: { cat: Category; selected?: boolean; titleClass?: string; ratio?: string; className?: string; boxClass?: string }) {
  const { t } = useLang()
  return (
    <div className={`flex flex-col overflow-hidden rounded-[16px] bg-[#0c2a1d] ${className}`}>
      <CategoryArt cat={cat} className={`${ratio} w-full`} />
      <div className={`flex items-center justify-center border-t-[3px] px-2 py-1.5 text-center ${boxClass} transition-colors duration-200 ${selected ? 'border-[#c98a14] bg-gold text-forest' : 'border-gold/70 bg-[#0c2a1d] text-ivory'}`}>
        <div className={`font-display leading-tight ${titleClass}`}>{t(cat.name, cat.nameEn)}</div>
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

// Brand marks (lucide no longer ships brand icons).
type IconProps = { size?: number; className?: string }
export function InstagramIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
export function TikTokIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.5 3c.3 2.2 1.6 3.7 3.8 3.9v3a7 7 0 0 1-3.8-1.2v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.8 2.5V3h2.9Z" />
    </svg>
  )
}
export function YouTubeIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  )
}
export function FacebookIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  )
}

/** Placeholder social handles — swap for the real accounts once decided. */
export const SOCIALS = [
  { id: 'instagram', label: 'Instagram', href: 'https://instagram.com/', Icon: InstagramIcon },
  { id: 'tiktok', label: 'TikTok', href: 'https://tiktok.com/', Icon: TikTokIcon },
  { id: 'youtube', label: 'YouTube', href: 'https://youtube.com/', Icon: YouTubeIcon },
  { id: 'facebook', label: 'Facebook', href: 'https://facebook.com/', Icon: FacebookIcon },
] as const
