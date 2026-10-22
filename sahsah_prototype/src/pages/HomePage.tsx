import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CirclePlay,
  Gift,
  Handshake,
  Quote,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { CATEGORIES, GIFT_DISCOUNT, SECTIONS, toAr } from '../lib/data'
import { PHOTO, LOGO } from '../lib/images'
import { Carousel } from '../components/ui'
import { Poster, SOCIALS } from '../components/art'
import { useLang } from '../lib/i18n'

// The home page is a frame for the launch content: every block is a self-contained
// section (carousels, embeds, sub-pages) so copy and media can be dropped in later.

function Soon() {
  const { t } = useLang()
  return (
    <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold">
      {t('قريبًا', '2orayeban')}
    </span>
  )
}

function SectionTitle({ id, title, action, soon }: { id?: string; title: string; action?: ReactNode; soon?: boolean }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-28 flex-wrap items-end justify-between gap-3">
      <div>
        <img src={LOGO.divider} alt="" aria-hidden className="mb-3 h-3 w-auto opacity-80" />
        <h2 className="flex items-center gap-3 font-display text-[32px] leading-none md:text-[42px]">
          {title} {soon && <Soon />}
        </h2>
      </div>
      {action}
    </div>
  )
}

function HeroSlide({
  image,
  kicker,
  title,
  cta,
  to,
  position = 'object-left',
}: {
  image: string
  kicker: string
  title: ReactNode
  cta: string
  to: string
  position?: string
}) {
  const { ar } = useLang()
  const Arrow = ar ? ArrowLeft : ArrowRight
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-gold/20 bg-[#0a2a1c] shadow-[0_30px_80px_rgba(0,0,0,.45)]">
      <img src={image} alt="" className={`absolute inset-0 h-full w-full object-cover ${position}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a2a1c] via-[#0a2a1c]/55 to-transparent md:bg-gradient-to-l md:from-[#0a2a1c]/90 md:via-[#0a2a1c]/40" />
      <div className="relative flex min-h-[460px] items-end p-7 md:min-h-[520px] md:items-center md:p-16">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[13px] font-semibold text-gold">
            <Sparkles size={14} /> {kicker}
          </span>
          <h1 className="mt-5 font-display text-[clamp(40px,5vw,70px)] leading-[1.08] text-balance">{title}</h1>
          <Link
            to={to}
            className="btn-play sheen mt-8 inline-flex h-[68px] items-center gap-3 rounded-2xl px-10 text-[24px] font-bold"
          >
            {cta} <Arrow size={24} strokeWidth={2.8} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { t, ar } = useLang()
  const Arrow = ar ? ArrowLeft : ArrowRight
  const discount = toAr(Math.round(GIFT_DISCOUNT * 100))
  const posters = SECTIONS.flatMap((s) => s.ids)
    .map((id) => CATEGORIES.find((c) => c.id === id)!)
    .filter(Boolean)
  return (
    <div className="reveal space-y-16 pt-4 md:space-y-24">
      {/* Marketing hero banner */}
      <Carousel label={t('العروض', 'El 3orood')} autoplay={6000} slideClass="w-full">
        <HeroSlide
          image={PHOTO.herowide}
          kicker={t('لعبة الشلة المصرية', 'Le3bet el shella el masreya')}
          title={
            <>
              {t('اختار', 'Ekhtar')} <span className="num text-gold">{toAr(6)}</span> {t('فئات', 'fe2at')}
              <br />
              {t('والعب فورًا', 'w el3ab 3al tool')}
            </>
          }
          cta={t('العب الآن', 'El3ab delwa2ty')}
          to="/play"
        />
        <HeroSlide
          image={PHOTO.coins}
          position="object-[75%_center]"
          kicker={t(`خصم ${discount}٪ على الهدايا`, `${discount}% off el hadaya`)}
          title={t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba')}
          cta={t('اهدي دلوقتي', 'Ehdy delwa2ty')}
          to="/tokens?tab=gift"
        />
        <HeroSlide
          image={PHOTO.comedy}
          position="object-[50%_40%]"
          kicker={t('تحديات جديدة', 'Ta7adyat gdeeda')}
          title={t('صور وأصوات وألغاز… جربها مع الشلة', 'Sowar w aswat w alghaz… garrabha ma3 el shella')}
          cta={t('جرّب التحديات', 'Garrab el ta7adyat')}
          to="/play"
        />
      </Carousel>

      {/* Short introduction + how to play */}
      <section className="grid items-center gap-8 md:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionTitle title={t('يعني إيه صح صح؟', 'Ya3ny eh Sa7Sa7?')} />
          <p className="text-[17px] leading-8 text-ivory/75">
            {t(
              'لعبة أسئلة للشلة والعيلة عن كل حاجة بتخلينا مصريين: سينما، طرب، كورة، أكل، وذكريات. فريقين، ٣٦ سؤال، وشاشة واحدة.',
              'Le3bet as2ela lel shella wel 3eila 3an kol 7aga btekhaleena masreyeen: cinema, tarab, kora, akl, w zekrayat. Fare2een, 36 so2al, w shasha wa7da.',
            )}
          </p>
          <Link
            to="/play"
            className="btn-play sheen mt-7 inline-flex h-16 items-center gap-3 rounded-2xl px-9 text-[22px] font-bold"
          >
            {t('العب الآن', 'El3ab delwa2ty')} <Arrow size={22} strokeWidth={2.8} />
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            [t('اختار ٦ فئات', 'Ekhtar 6 fe2at'), t('من المكتبة الكبيرة', 'Men el maktaba el kebeera')],
            [t('سمّوا الفريقين', 'Sammo el fare2een'), t('والشلة تدخل بالـQR', 'W el shella tedkhol bel QR')],
            [t('العبوا واكسبوا', 'El3abo w eksabo'), t('٣٦ سؤال والأعلى نقط يكسب', '36 so2al wel a3la no2at yeksab')],
          ].map(([title, sub], i) => (
            <li key={title} className="glass rounded-[22px] p-5">
              <span className="num grid h-10 w-10 place-items-center rounded-full bg-gold text-lg font-bold text-forest">
                {toAr(i + 1)}
              </span>
              <p className="mt-4 font-display text-2xl">{title}</p>
              <p className="mt-1 text-sm text-ivory/60">{sub}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Category posters */}
      <section>
        <SectionTitle
          title={t('الفئات', 'El Fe2at')}
          action={
            <Link to="/play" className="inline-flex h-12 items-center gap-2 rounded-full border border-gold/40 px-5 font-semibold text-gold hover:bg-gold/10">
              {t('اختار فئاتك', 'Ekhtar fe2atak')} <Arrow size={18} />
            </Link>
          }
        />
        <Carousel label={t('الفئات', 'El Fe2at')} slideClass="w-[44%] sm:w-[30%] lg:w-[18%]" dots={false}>
          {posters.map((cat) => (
            <Link key={cat.id} to="/play" className="block rounded-[18px] transition hover:-translate-y-1">
              <Poster cat={cat} titleClass="text-[18px] lg:text-[20px]" className="rounded-[18px]" />
            </Link>
          ))}
        </Carousel>
      </section>

      {/* Videos of people playing (YouTube) */}
      <section>
        <SectionTitle title={t('شوف الناس بتلعب', 'Shoof el nas betel3ab')} soon />
        <Carousel label={t('فيديوهات', 'Videos')}>
          {[PHOTO.cinema, PHOTO.football, PHOTO.music, PHOTO.ramadan].map((img, i) => (
            <div key={i} className="relative aspect-video overflow-hidden rounded-[22px] border border-white/10">
              <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
              <div className="absolute inset-0 grid place-items-center">
                <CirclePlay size={64} strokeWidth={1.4} className="text-gold" />
              </div>
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-deep to-transparent p-4 text-sm font-semibold">
                {t('مكان فيديو يوتيوب', 'Makan video YouTube')} {toAr(i + 1)}
              </p>
            </div>
          ))}
        </Carousel>
      </section>

      {/* Influencers + social embeds */}
      <section>
        <SectionTitle title={t('صح صح مع المؤثرين', 'Sa7Sa7 ma3 el influencers')} soon />
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Carousel label={t('المؤثرين', 'El Influencers')} slideClass="w-[70%] sm:w-[45%]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="glass flex aspect-[9/14] flex-col items-center justify-center gap-3 rounded-[22px] p-5 text-center">
                <Users size={40} className="text-gold" strokeWidth={1.5} />
                <p className="font-display text-xl">{t('مكان فيديو تيك توك / إنستجرام', 'Makan video TikTok / Instagram')}</p>
                <p className="text-xs text-ivory/50">{t('تضمين مباشر من البوست', 'Embed mobasher men el post')}</p>
              </div>
            ))}
          </Carousel>
          <div className="glass flex flex-col justify-center rounded-[22px] p-7">
            <p className="font-display text-3xl">{t('تابعونا', 'Tab3oona')}</p>
            <p className="mt-2 text-sm text-ivory/60">
              {t('مسابقات وأسئلة جديدة كل أسبوع على السوشيال.', 'Mosab2at w as2ela gdeeda kol esboo3 3al social.')}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {SOCIALS.map(({ id, label, href, Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 items-center gap-3 rounded-2xl border border-white/15 px-4 font-semibold transition hover:border-gold/50 hover:text-gold"
                >
                  <Icon size={22} /> {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Competitions & events */}
      <section>
        <SectionTitle title={t('مسابقات وفعاليات', 'Mosab2at w Fa3alyat')} soon />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            [Trophy, t('بطولة صح صح', 'Botolet Sa7Sa7'), t('دوري للشلل والجامعات — التفاصيل قريب.', 'Dawry lel shelal wel gam3at — el tafaseel 2oryeb.')],
            [CalendarDays, t('ليالي صح صح', 'Layaly Sa7Sa7'), t('فعاليات في الكافيهات والأماكن العامة.', 'Fa3alyat fel cafeehat wel amaken el 3ama.')],
          ].map(([Icon, title, sub]) => {
            const I = Icon as typeof Trophy
            return (
              <div key={title as string} className="glass flex items-center gap-5 rounded-[22px] p-6">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <I size={30} />
                </span>
                <div>
                  <p className="font-display text-2xl">{title as string}</p>
                  <p className="mt-1 text-sm text-ivory/60">{sub as string}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Gift a friend */}
      <section className="relative overflow-hidden rounded-[28px] border border-gold/30">
        <img src={PHOTO.coins} alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#0a2a1c] via-[#0a2a1c]/80 to-[#0a2a1c]/10" />
        <div className="relative flex flex-col items-start gap-4 p-8 md:p-14">
          <span className="rounded-full bg-play px-4 py-1.5 text-sm font-bold text-white">
            {t(`خصم ${discount}٪`, `${discount}% off`)}
          </span>
          <h2 className="font-display text-[clamp(36px,5vw,60px)] leading-none">{t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba')}</h2>
          <p className="max-w-md text-ivory/75">
            {t('ابعت توكنز لأي حد برقم موبايله، وهو يلعب مع شلته.', 'Eb3at tokens le ay 7ad b raqam mobailo, w howa yel3ab ma3 shelleto.')}
          </p>
          <Link to="/tokens?tab=gift" className="btn-play inline-flex h-16 items-center gap-3 rounded-2xl px-9 text-[22px] font-bold">
            <Gift size={22} /> {t('اهدي دلوقتي', 'Ehdy delwa2ty')}
          </Link>
        </div>
      </section>

      {/* Mission & vision (from the brand deck) */}
      <section id="mission" className="scroll-mt-28">
        <SectionTitle title={t('رسالتنا ورؤيتنا', 'Resaletna w Ro2yetna')} />
        <div className="grid gap-4 md:grid-cols-2">
          <blockquote className="paper rounded-[22px] p-7">
            <Quote className="text-gold" />
            <p className="mt-3 text-xs font-bold tracking-wide text-forest/50">{t('الرسالة', 'El Resala')}</p>
            <p className="mt-2 font-display text-[26px] leading-snug">
              {t(
                'بنجمع الثقافة اللي بتخلينا مصريين، ونحولها للعب بيرجّع الأجيال والخلفيات والعقول لبعض… ويثبت إننا مع بعض نعرف كل حاجة.',
                'Bengama3 el sa2afa elly btekhaleena masreyeen, w n7awelha le la3b beyraga3 el agyal wel khalfeyat wel 3o2ool le ba3d… w yesbet enena ma3 ba3d ne3raf kol 7aga.',
              )}
            </p>
          </blockquote>
          <blockquote className="paper rounded-[22px] p-7">
            <Quote className="text-gold" />
            <p className="mt-3 text-xs font-bold tracking-wide text-forest/50">{t('الرؤية', 'El Ro2ya')}</p>
            <p className="mt-2 font-display text-[26px] leading-snug">
              {t(
                'نكون الأرشيف الحي للثقافة المصرية: المكان اللي معرفة كل جيل بتفضل فيه عايشة ومتشاركة ومتحتفل بيها… سؤال ورا سؤال.',
                'Nekoon el arsheef el 7ay lel sa2afa el masreya: el makan elly ma3refet kol geel btefdal feeh 3aysha w metsharka w met7tefel beeha… so2al wara so2al.',
              )}
            </p>
          </blockquote>
        </div>
      </section>

      {/* Team credits + business */}
      <section id="team" className="grid scroll-mt-28 gap-4 md:grid-cols-3">
        <div className="glass rounded-[22px] p-7 md:col-span-1">
          <p className="flex items-center gap-2 font-display text-2xl">
            {t('فريق العمل', 'El Team')} <Soon />
          </p>
          <p className="mt-2 text-sm text-ivory/60">{t('أسماء الفريق والشكر هنا.', 'Asamy el team wel shokr hena.')}</p>
        </div>
        <Link to="/contact?tab=business" className="glass group rounded-[22px] p-7 transition hover:border-gold/50">
          <Handshake className="text-gold" size={30} />
          <p className="mt-3 font-display text-2xl">{t('للشركات والمؤثرين', 'Lel sharekat wel influencers')}</p>
          <p className="mt-1 text-sm text-ivory/60">{t('شراكات، فعاليات، وإعلانات.', 'Sharakat, fa3alyat, w e3lanat.')}</p>
        </Link>
        <Link to="/contact?tab=business" className="glass group rounded-[22px] p-7 transition hover:border-gold/50">
          <Briefcase className="text-gold" size={30} />
          <p className="mt-3 font-display text-2xl">{t('اشتغل معانا', 'Eshtaghal ma3ana')}</p>
          <p className="mt-1 text-sm text-ivory/60">{t('وظائف وتعاون مع فريق صح صح.', 'Wazayef w ta3awon ma3 team Sa7Sa7.')}</p>
        </Link>
      </section>
    </div>
  )
}
