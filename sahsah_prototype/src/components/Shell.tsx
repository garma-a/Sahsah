import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { Coins, Gift, Headset, House, Play, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo, Arch, SOCIALS } from './art'
import { useStore } from '../lib/store'
import { toAr } from '../lib/data'
import { Toast } from './ui'
import { PHOTO } from '../lib/images'
import { DEMO_MODE } from '../lib/runtime'
import { useLang } from '../lib/i18n'

function Background({ decorated = true }: { decorated?: boolean }) {
  if (!decorated)
    return <div className="pointer-events-none fixed inset-0 -z-10 mesh grain" aria-hidden />
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden mesh grain" aria-hidden>
      <div className="absolute -top-40 start-[-10%] h-[620px] w-[620px] rounded-full bg-[#e7a72b]/10 blur-[110px]" />
      <div className="absolute bottom-[-20%] end-[-10%] h-[560px] w-[560px] rounded-full bg-[#46aa78]/15 blur-[120px]" />
      <img
        src={PHOTO.hero}
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.07] blur-3xl"
      />
      <Arch className="absolute start-1/2 top-24 h-[760px] -translate-x-1/2 text-gold opacity-[0.13]" />
    </div>
  )
}

export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={`glass grid h-12 min-w-12 place-items-center rounded-full px-3 text-[15px] font-bold text-ivory transition hover:border-gold/50 ${className}`}
      aria-label={t('Switch to English (Franco)', 'غيّر للعربي')}
      lang={lang === 'ar' ? 'en' : 'ar'}
    >
      {lang === 'ar' ? 'EN' : 'عربي'}
    </button>
  )
}

/** Promotions ticker — marketing copy lives here so it can change without touching layouts. */
function Ticker() {
  const { t } = useLang()
  const items = [
    t('خصم ١٠٪ على كل الهدايا', '10% off kol el hadaya'),
    t('تابعونا على السوشيال @sa7sa7', 'Tab3oona 3al social @sa7sa7'),
    t('اختار ٦ فئات من آلاف الأسئلة… مستني مين؟', 'Ekhtar 6 fe2at men alaf el as2ela… mestanny meen?'),
    t('تحديات جديدة كل شهر', 'Ta7adyat gdeeda kol shahr'),
  ]
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((x) => (
        <span key={x} className="flex items-center whitespace-nowrap px-6">
          {x}
          <span className="ms-12 opacity-50" aria-hidden>
            ✦
          </span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="overflow-hidden bg-gold text-[13px] font-bold text-forest" aria-label={t('عروض', 'El 3orood')}>
      <div className="marquee py-1.5">
        {row}
        <div aria-hidden className="flex">
          {row}
        </div>
      </div>
    </div>
  )
}

function IconLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  const { pathname, search } = useLocation()
  // Links with a query (e.g. the gift section) are only active on that exact section.
  const [path, query] = to.split('?')
  const active = pathname === path && (!query || search === `?${query}`) && !(path === '/tokens' && !query && search.includes('tab=gift'))
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`group relative grid h-12 w-12 place-items-center rounded-full transition ${active ? 'bg-gold text-forest' : 'glass text-ivory hover:border-gold/50 hover:text-gold'}`}
    >
      {children}
      <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-lg bg-deep px-2.5 py-1 text-xs font-semibold text-ivory opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </Link>
  )
}

export function TokenPill({ large = true }: { large?: boolean }) {
  const { state } = useStore()
  const { t } = useLang()
  return (
    <Link
      to="/tokens"
      className={`glass flex items-center gap-2.5 rounded-full ps-4 pe-1.5 transition hover:border-gold/50 ${large ? 'h-14' : 'h-12'}`}
      aria-label={t(`رصيدك ${state.tokens} توكن`, `Rasidak ${state.tokens} token`)}
    >
      <span className={`num font-bold text-gold ${large ? 'text-[26px]' : 'text-[20px]'}`}>
        {toAr(state.tokens)}
      </span>
      <span className="text-xs font-semibold text-ivory/70">{t('توكن', 'Token')}</span>
      <span
        className={`grid place-items-center rounded-full bg-gold text-forest ${large ? 'h-11 w-11' : 'h-9 w-9'}`}
      >
        <Coins size={large ? 22 : 18} strokeWidth={2.4} />
      </span>
    </Link>
  )
}

export function Header() {
  const { t } = useLang()
  const big = 'inline-flex h-14 items-center gap-2 rounded-2xl px-6 text-[19px] font-bold transition'
  return (
    <header className="sticky top-0 z-40 bg-deep/80 backdrop-blur-md">
      <Ticker />
      <div className="mx-auto grid h-20 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-24 md:px-8">
        {/* Main funnels: home and play */}
        <nav className="hidden items-center gap-2.5 justify-self-start md:flex" aria-label={t('التنقل الرئيسي', 'El tan2ol')}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${big} ${isActive ? 'bg-ivory text-forest' : 'glass text-ivory hover:border-gold/50'}`
            }
          >
            <House size={20} /> {t('الرئيسية', 'El Re2eseya')}
          </NavLink>
          <NavLink
            to="/play"
            className={({ isActive }) =>
              `${big} btn-play px-8 text-[21px] ${isActive ? 'ring-2 ring-gold ring-offset-2 ring-offset-deep' : ''}`
            }
          >
            <Play size={20} fill="currentColor" /> {t('العب', 'El3ab')}
          </NavLink>
        </nav>
        <div className="md:hidden">
          <LangToggle />
        </div>
        <Link to="/" className="col-start-2 shrink-0 justify-self-center rounded-xl" aria-label={t('الرئيسية', 'El Re2eseya')}>
          <Logo size={64} />
          {DEMO_MODE && (
            <span className="mt-0.5 block text-center text-[9px] text-gold/80">
              {t('نسخة تجريبية', 'Noskha tagreebeya')}
            </span>
          )}
        </Link>
        {/* Secondary destinations as icons beside the token counter */}
        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          <div className="hidden items-center gap-2 lg:flex">
            <IconLink to="/tokens?tab=gift" label={t('اهدي توكنز', 'Ehdy tokens')}>
              <Gift size={20} />
            </IconLink>
            <IconLink to="/account" label={t('حسابي', '7esaby')}>
              <UserRound size={20} />
            </IconLink>
            <IconLink to="/contact" label={t('تواصل معنا', 'Kalemna')}>
              <Headset size={20} />
            </IconLink>
            <LangToggle />
          </div>
          <div className="hidden md:block">
            <TokenPill />
          </div>
          <div className="md:hidden">
            <TokenPill large={false} />
          </div>
        </div>
      </div>
      {/* Tablet: the icon row moves under the bar */}
      <div className="mx-auto hidden max-w-[1280px] justify-end gap-2 px-8 pb-3 md:flex lg:hidden">
        <IconLink to="/tokens?tab=gift" label={t('اهدي توكنز', 'Ehdy tokens')}>
          <Gift size={20} />
        </IconLink>
        <IconLink to="/account" label={t('حسابي', '7esaby')}>
          <UserRound size={20} />
        </IconLink>
        <IconLink to="/contact" label={t('تواصل معنا', 'Kalemna')}>
          <Headset size={20} />
        </IconLink>
        <LangToggle />
      </div>
    </header>
  )
}

function MobileNav() {
  const { t } = useLang()
  const { pathname, search } = useLocation()
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${isActive ? 'text-gold' : 'text-ivory/75'}`
  return (
    <nav
      className="glass fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-center rounded-2xl p-1.5 md:hidden"
      aria-label={t('التنقل', 'El tan2ol')}
    >
      <NavLink to="/" end className={item}>
        <House size={20} />
        {t('الرئيسية', 'Re2eseya')}
      </NavLink>
      <Link to="/tokens?tab=gift" className={item({ isActive: pathname === '/tokens' && search.includes('tab=gift') })}>
        <Gift size={20} />
        {t('اهدي', 'Ehdy')}
      </Link>
      <NavLink
        to="/play"
        className="btn-play -mt-7 grid h-[70px] w-[70px] place-items-center justify-self-center rounded-full text-[15px] font-bold ring-4 ring-deep"
      >
        <span className="flex flex-col items-center leading-none">
          <Play size={22} fill="currentColor" />
          <span className="mt-1">{t('العب', 'El3ab')}</span>
        </span>
      </NavLink>
      <NavLink to="/account" className={item}>
        <UserRound size={20} />
        {t('حسابي', '7esaby')}
      </NavLink>
      <NavLink to="/contact" className={item}>
        <Headset size={20} />
        {t('تواصل', 'Kalemna')}
      </NavLink>
    </nav>
  )
}

function Footer() {
  const { t } = useLang()
  const link = 'text-sm text-ivory/65 transition hover:text-gold'
  return (
    <footer className="mt-10 border-t border-white/10 bg-deep/60 pb-28 pt-10 md:pb-10">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo size={56} />
          <p className="mt-3 max-w-xs text-sm leading-7 text-ivory/60">
            {t(
              'بنجمع الثقافة اللي بتخلينا مصريين ونحولها للعب بيجمع الأجيال.',
              'Bengama3 el sa2afa elly btekhaleena masreyeen w n7awelha le la3b beygama3 el agyal.',
            )}
          </p>
          <div className="mt-4 flex gap-2">
            {SOCIALS.map(({ id, label, href, Icon }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="glass grid h-11 w-11 place-items-center rounded-full text-ivory transition hover:text-gold"
              >
                <Icon size={19} />
              </a>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-2.5">
          <p className="font-display text-xl text-gold">{t('العب', 'El3ab')}</p>
          <Link className={link} to="/play">
            {t('ابدأ لعبة', 'Ebda2 le3ba')}
          </Link>
          <Link className={link} to="/tokens">
            {t('التوكنز', 'El Tokens')}
          </Link>
          <Link className={link} to="/tokens?tab=gift">
            {t('اهدي صاحبك', 'Ehdy sa7bak')}
          </Link>
        </div>
        <div className="grid content-start gap-2.5">
          <p className="font-display text-xl text-gold">{t('صح صح', 'Sa7Sa7')}</p>
          <a className={link} href="/#mission">
            {t('رسالتنا ورؤيتنا', 'Resaletna w Ro2yetna')}
          </a>
          <a className={link} href="/#team">
            {t('فريق العمل', 'El Team')}
          </a>
          <Link className={link} to="/contact?tab=business">
            {t('بيزنس ووظائف', 'Business w Wazayef')}
          </Link>
        </div>
        <div className="grid content-start gap-2.5">
          <p className="font-display text-xl text-gold">{t('مساعدة', 'Mosa3da')}</p>
          <Link className={link} to="/contact">
            {t('تواصل معنا', 'Kalemna')}
          </Link>
          <Link className={link} to="/contact?tab=experience">
            {t('شاركنا تجربتك', 'Sharekna tagrobtak')}
          </Link>
          <Link className={link} to="/admin">
            {t('مركز التحكم (للفريق)', 'Control Center (lel team)')}
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-[1280px] px-4 text-xs text-ivory/40 md:px-8">
        © {toAr(new Date().getFullYear())} {t('صح صح', 'Sa7Sa7')}
      </p>
    </footer>
  )
}

export default function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="relative isolate min-h-dvh text-ivory">
      <Background />
      <Header />
      <main className="mx-auto max-w-[1280px] px-4 pb-10 md:px-8">
        <Outlet />
      </main>
      {pathname !== '/play' && <Footer />}
      {pathname === '/play' && <div className="h-28 md:h-6" />}
      <MobileNav />
      <Toast />
    </div>
  )
}

export function FullScreenFrame() {
  return (
    <div className="relative isolate min-h-dvh text-ivory">
      <Background decorated={false} />
      <Outlet />
      <Toast />
    </div>
  )
}
