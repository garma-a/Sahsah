const s = (fill: string, opacity?: number): React.CSSProperties => ({ fill, opacity });
const ink = "var(--color-ink)";

/** A tea glass (istikana) on its saucer, with a spoon. */
function TeaGlass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 70 92" className={className}>
      <ellipse cx="35" cy="86" rx="33" ry="6" style={s(ink)} />
      <ellipse cx="35" cy="83" rx="31" ry="5" style={s("var(--color-poster-cream)")} stroke={ink} strokeWidth="2.5" />
      {/* The waisted glass: tea fills it to just under the rim. */}
      <path d="M14 10 H56 C56 30 47 40 47 50 C47 62 54 70 52 82 H18 C16 70 23 62 23 50 C23 40 14 30 14 10 Z" style={s("var(--color-poster-cream)", 0.35)} stroke={ink} strokeWidth="2.5" />
      <path d="M16 20 H54 C53 32 46 41 46 50 C46 62 52 70 50.5 80 H19.5 C18 70 24 62 24 50 C24 41 17 32 16 20 Z" style={s("#b2410f")} />
      <path d="M18 22 H30 C29 34 26 42 26 50 C26 60 30 68 29 78 H21 C20 68 25 60 25 50 C25 42 19 32 18 22 Z" style={s("#ffffff", 0.22)} />
      <rect x="44" y="0" width="4" height="56" rx="2" transform="rotate(14 46 28)" style={s("#c9c2ad")} stroke={ink} strokeWidth="1.5" />
      <ellipse cx="35" cy="10" rx="21" ry="3" style={s("none")} stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

/** A matchbox, tray half open, with two spent matches beside it. The label is a star, not a word. */
function Matchbox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 56" className={className}>
      <rect x="4" y="44" width="40" height="3" rx="1.5" transform="rotate(-8 24 45)" style={s("#e9cf9a")} stroke={ink} strokeWidth="1.2" />
      <circle cx="5" cy="47.5" r="3" style={s("var(--color-cabinet)")} />
      <rect x="22" y="22" width="54" height="26" rx="2" style={s("#d8b98a")} stroke={ink} strokeWidth="2.5" />
      <rect x="10" y="12" width="56" height="30" rx="2" style={s("var(--color-poster-red)")} stroke={ink} strokeWidth="2.5" />
      <rect x="10" y="12" width="56" height="5" style={s("var(--color-cabinet)")} />
      <rect x="15" y="20" width="46" height="18" rx="1" style={s("var(--color-poster-mustard)")} />
      <path d="M38 22 l2.6 5.4 6 .8 -4.4 4.1 1.1 5.9 -5.3 -2.9 -5.3 2.9 1.1 -5.9 -4.4 -4.1 6 -.8 z" style={s("var(--color-poster-crimson)")} />
      <rect x="10" y="12" width="56" height="30" rx="2" style={s("none")} stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

/** A compact cassette with the striped label of the era. */
function Cassette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 78" className={className}>
      <rect x="3" y="3" width="114" height="72" rx="6" style={s("var(--color-cabinet)")} stroke={ink} strokeWidth="3" />
      <rect x="11" y="9" width="98" height="44" rx="3" style={s("var(--color-poster-cream)")} />
      <rect x="11" y="15" width="98" height="5" style={s("var(--color-poster-red)")} />
      <rect x="11" y="20" width="98" height="5" style={s("var(--color-poster-orange)")} />
      <rect x="11" y="25" width="98" height="5" style={s("var(--color-poster-mustard)")} />
      <rect x="30" y="31" width="60" height="18" rx="9" style={s("var(--color-night)")} />
      <g style={s("var(--color-poster-cream)")} stroke={ink} strokeWidth="2">
        <circle cx="42" cy="40" r="6" />
        <circle cx="78" cy="40" r="6" />
      </g>
      <rect x="50" y="35" width="20" height="10" rx="1" style={s("#6b4a2e")} />
      <path d="M26 75 L32 60 H88 L94 75" style={s("#3a4240")} stroke={ink} strokeWidth="2" />
      <g style={s("var(--color-night)")}>
        <circle cx="44" cy="68" r="2.5" />
        <circle cx="76" cy="68" r="2.5" />
      </g>
    </svg>
  );
}

/**
 * The retro TV the game is played on: a charcoal cabinet with a teal-rimmed glass, and on a laptop or TV a chin
 * with the speaker and knobs, feet, a shelf and the props around it. On a phone it is a slim bezel only.
 * Only the frame is decoration: everything inside is the game, untouched.
 */
export default function RetroScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col lg:pb-9">
      <div className="cabinet relative flex flex-1 flex-col rounded-[1.4rem] border-4 border-ink p-2.5 sm:rounded-[2rem] sm:p-3.5 lg:rounded-[2.6rem] lg:p-5 lg:pb-0">
        <div className="screen-glass relative flex flex-1 flex-col rounded-[1rem] p-2 sm:rounded-[1.5rem] sm:p-4 lg:rounded-[2rem] lg:p-6">{children}</div>
        <div aria-hidden className="hidden h-16 items-center justify-center gap-6 lg:flex">
          <span className="size-2.5 rounded-full bg-poster-red shadow-[0_0_8px_var(--color-poster-red)]" />
          <span className="grille h-6 w-56 rounded-md border-2 border-ink/80" />
          <span className="flex gap-3">
            {["bg-poster-mustard", "bg-poster-teal"].map((tone) => (
              <span key={tone} className={`relative size-9 rounded-full border-[3px] border-ink ${tone} shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)]`}>
                <span className="absolute left-1/2 top-1 h-3 w-1 -translate-x-1/2 rounded-full bg-ink" />
              </span>
            ))}
          </span>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden lg:block">
        <div className="mx-[12%] flex justify-between">
          <span className="h-6 w-14 bg-ink [clip-path:polygon(10%_0,90%_0,100%_100%,0_100%)]" />
          <span className="h-6 w-14 bg-ink [clip-path:polygon(10%_0,90%_0,100%_100%,0_100%)]" />
        </div>
        <div className="h-3 rounded-sm border-2 border-ink bg-shelf shadow-[0_10px_20px_rgb(0_0_0/0.6)]" />
        <TeaGlass className="absolute bottom-3 start-6 w-[4.5rem] xl:start-10 xl:w-20" />
        <div className="absolute bottom-3 end-4 flex items-end gap-1 xl:end-8">
          <Matchbox className="w-24 xl:w-28" />
          <Cassette className="w-32 -rotate-6 xl:w-36" />
        </div>
      </div>
    </div>
  );
}
