import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { Coins, Play } from 'lucide-react'
import { Logo, Arch } from './art'
import { useStore } from '../lib/store'
import { toAr } from '../lib/data'
import { Toast } from './ui'
import { PHOTO } from '../lib/images'

const NAV = [
  { to: '/play', label: 'العب' },
  { to: '/account', label: 'حسابي' },
  { to: '/tokens', label: 'العملات' },
  { to: '/contact', label: 'تواصل معنا' },
]

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden mesh grain" aria-hidden>
      <div className="absolute -top-40 start-[-10%] h-[620px] w-[620px] rounded-full bg-[#e7a72b]/10 blur-[110px]" />
      <div className="absolute bottom-[-20%] end-[-10%] h-[560px] w-[560px] rounded-full bg-[#46aa78]/15 blur-[120px]" />
      <img src={PHOTO.hero} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.07] blur-3xl" />
      <Arch className="absolute start-1/2 top-24 h-[760px] -translate-x-1/2 text-gold opacity-[0.13]" />
    </div>
  )
}

export function Header() {
  const { state } = useStore()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto grid h-20 max-w-[1216px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-8">
        <Link to="/play" className="shrink-0 justify-self-start rounded-xl" aria-label="الرئيسية">
          <Logo size={54} />
        </Link>
        <nav className="glass col-start-2 hidden items-center gap-1 rounded-full p-1.5 md:flex" aria-label="التنقل الرئيسي">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `relative rounded-full px-5 py-2 text-[17px] font-semibold transition-colors duration-150 ${isActive ? 'bg-white/10 text-gold' : 'text-ivory/80 hover:bg-white/5 hover:text-ivory'}`
              }
            >
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <span className="absolute inset-x-5 -bottom-0.5 h-0.5 rounded-full bg-gold" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          {pathname !== '/play' && (
            <Link to="/play" className="btn-play hidden h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold lg:inline-flex">
              <Play size={16} fill="currentColor" /> العب الآن
            </Link>
          )}
          <Link to="/tokens" className="glass flex h-11 items-center gap-2 rounded-full ps-4 pe-3 transition hover:border-gold/50" aria-label={`رصيدك ${state.coins} عملة`}>
            <span className="num text-[18px] font-bold text-gold">{toAr(state.coins)}</span>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-forest">
              <Coins size={15} strokeWidth={2.4} />
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

function MobileNav() {
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl p-1.5 md:hidden" aria-label="التنقل">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => `grid h-12 place-items-center rounded-xl text-[14px] font-semibold ${isActive ? 'bg-gold text-forest' : 'text-ivory/80'}`}>
          {n.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Shell() {
  return (
    <div className="relative min-h-dvh">
      <Background />
      <Header />
      <main className="mx-auto max-w-[1216px] px-4 pb-28 md:px-8 md:pb-16">
        <Outlet />
      </main>
      <MobileNav />
      <Toast />
    </div>
  )
}

export function FullScreenFrame() {
  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-0 -z-10 mesh grain" aria-hidden />
      <Outlet />
      <Toast />
    </div>
  )
}
