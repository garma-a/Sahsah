/**
 * Shared text-free cinema art in the brand palette: the poster motifs for the stage wall and the props that sit
 * around the TV and the home shelves. Everything is SVG; no lettering is drawn, only bars that stand in for it.
 */
// The brand colours as CSS variables (see globals.css), so the art follows the tokens.
export const c = {
  cream: "var(--color-poster-cream)",
  teal: "var(--color-poster-teal)",
  red: "var(--color-poster-red)",
  orange: "var(--color-poster-orange)",
  mustard: "var(--color-poster-mustard)",
  crimson: "var(--color-poster-crimson)",
  olive: "var(--color-poster-olive)",
  pink: "var(--color-poster-pink)",
  ink: "var(--color-cabinet)",
};
export const f = (fill: string, opacity?: number): React.CSSProperties => ({ fill, opacity });

/** The title block every poster carries, drawn as bars: the wall has no lettering, only the memory of it. */
function TitleBars({ color, y = 112 }: { color: string; y?: number }) {
  return (
    <g style={f(color)}>
      <rect x="18" y={y} width="64" height="8" rx="2" />
      <rect x="30" y={y + 12} width="40" height="4" rx="2" />
    </g>
  );
}

// Rotations that fan a thin wedge pointing left across the sky above the horizon.
const rays = Array.from({ length: 12 }, (_, i) => i * 15 + 4);

// Text-free one-sheets in the manner of 1950s-60s Egyptian cinema posters: flat shapes, bold grounds.
// Painted skin and hair for the portraits.
const skin = "#e2a77c";
const hair = "#2a1a14";

export const motifs: Array<() => React.ReactNode> = [
  // Sunrise over the Nile.
  () => (
    <>
      <rect width="100" height="140" style={f(c.red)} />
      <g style={f(c.mustard, 0.55)}>
        {rays.map((angle) => (
          <path key={angle} d="M50 92 L-60 92 L-60 88 Z" transform={`rotate(${angle} 50 92)`} />
        ))}
      </g>
      <circle cx="50" cy="92" r="20" style={f(c.mustard)} />
      <rect y="92" width="100" height="48" style={f(c.crimson)} />
      <TitleBars color={c.cream} />
    </>
  ),
  // Crescent and stars over the dunes.
  () => (
    <>
      <rect width="100" height="140" style={f(c.teal)} />
      <circle cx="58" cy="40" r="20" style={f(c.cream)} />
      <circle cx="66" cy="34" r="18" style={f(c.teal)} />
      <g style={f(c.cream)}>
        <path d="M24 26 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0 z" />
        <path d="M80 70 l1.5 3.5 3.5 0 -3 2 1.5 3.5 -3.5 -2 -3.5 2 1.5 -3.5 -3 -2 3.5 0 z" />
      </g>
      <path d="M0 96 Q30 74 58 92 T100 86 V140 H0 Z" style={f(c.orange)} />
      <path d="M0 108 Q40 92 100 104 V140 H0 Z" style={f(c.crimson)} />
      <TitleBars color={c.cream} y={116} />
    </>
  ),
  // Pyramids at sunset.
  () => (
    <>
      <rect width="100" height="140" style={f(c.orange)} />
      <circle cx="66" cy="44" r="18" style={f(c.crimson)} />
      <path d="M8 98 L38 50 L68 98 Z" style={f(c.ink)} />
      <path d="M48 98 L70 64 L92 98 Z" style={f(c.ink, 0.8)} />
      <rect y="98" width="100" height="42" style={f(c.cream)} />
      <TitleBars color={c.crimson} y={110} />
    </>
  ),
  // A split diagonal with a spotlight and a star.
  () => (
    <>
      <rect width="100" height="140" style={f(c.mustard)} />
      <path d="M0 0 H100 V58 L0 96 Z" style={f(c.crimson)} />
      <circle cx="52" cy="60" r="24" style={f(c.cream)} />
      <circle cx="52" cy="60" r="11" style={f(c.ink)} />
      <path d="M22 18 l3 7 7 0 -6 4 3 7 -7 -4 -7 4 3 -7 -6 -4 7 0 z" style={f(c.mustard)} />
      <TitleBars color={c.ink} />
    </>
  ),
  // Ripples from a dropped stone.
  () => (
    <>
      <rect width="100" height="140" style={f(c.cream)} />
      {[34, 27, 20, 13, 6].map((r, i) => (
        <circle key={r} cx="50" cy="56" r={r} style={f([c.teal, c.red, c.mustard, c.teal, c.red][i])} />
      ))}
      <TitleBars color={c.olive} y={106} />
    </>
  ),
  // A reel and a strip of film.
  () => (
    <>
      <rect width="100" height="140" style={f(c.olive)} />
      <g transform="rotate(-18 50 70)">
        <rect x="-10" y="74" width="130" height="18" style={f(c.ink)} />
        <g style={f(c.cream)}>
          {Array.from({ length: 13 }, (_, i) => (
            <rect key={i} x={-8 + i * 10} y="76" width="5" height="3" />
          ))}
        </g>
      </g>
      <circle cx="56" cy="44" r="26" style={f(c.cream)} />
      <g style={f(c.ink)}>
        <circle cx="56" cy="44" r="4" />
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx="56" cy="30" r="6" transform={`rotate(${a} 56 44)`} />
        ))}
      </g>
      <TitleBars color={c.mustard} y={114} />
    </>
  ),
  // A romance: a heart on a striped ground.
  () => (
    <>
      <rect width="100" height="140" style={f(c.mustard)} />
      <g style={f(c.red, 0.85)}>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${-40 + i * 20} 140 L${i * 20 + 10} 0 L${i * 20 + 20} 0 L${-30 + i * 20} 140 Z`} />
        ))}
      </g>
      <path d="M50 88 C20 66 22 36 40 36 C47 36 50 42 50 46 C50 42 53 36 60 36 C78 36 80 66 50 88 Z" style={f(c.pink)} />
      <rect y="100" width="100" height="40" style={f(c.crimson)} />
      <TitleBars color={c.cream} />
    </>
  ),
  // A felucca on the river.
  () => (
    <>
      <rect width="100" height="140" style={f(c.teal)} />
      <circle cx="28" cy="30" r="12" style={f(c.mustard)} />
      <path d="M52 20 L52 86 L22 86 Z" style={f(c.cream)} />
      <path d="M55 30 L80 84 L55 84 Z" style={f(c.cream, 0.8)} />
      <path d="M16 88 H86 L78 98 H26 Z" style={f(c.crimson)} />
      <g style={f(c.cream, 0.6)}>
        <rect x="10" y="104" width="30" height="2" rx="1" />
        <rect x="52" y="104" width="38" height="2" rx="1" />
      </g>
      <TitleBars color={c.mustard} y={114} />
    </>
  ),
  // A star's painted portrait (her): red one-sheet, cream inset, dark waved hair, an earring.
  () => (
    <>
      <rect width="100" height="140" style={f(c.red)} />
      <g style={f(c.cream)}>
        <rect x="14" y="6" width="72" height="9" rx="2" />
      </g>
      <rect x="10" y="20" width="80" height="80" style={f(c.cream)} />
      <rect x="13" y="23" width="74" height="74" style={f(c.teal, 0.35)} />
      <path d="M26 96 C26 80 36 74 50 74 C64 74 74 80 74 96 Z" style={f(c.crimson)} />
      <rect x="45" y="62" width="10" height="14" style={f(skin)} />
      <path d="M30 56 C24 30 40 24 52 26 C70 26 76 40 72 58 C70 70 64 72 62 64 C66 48 58 40 50 40 C40 40 34 50 36 66 C32 66 30 62 30 56 Z" style={f(hair)} />
      <ellipse cx="50" cy="52" rx="13" ry="16" style={f(skin)} />
      <path d="M37 50 C36 36 48 32 60 38 C54 38 46 40 42 50 Z" style={f(hair)} />
      <path d="M44 50 h5 M53 50 h5" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="51" cy="60" rx="3.2" ry="1.6" style={f(c.crimson)} />
      <circle cx="37.5" cy="58" r="2.2" style={f(c.mustard)} />
      <path d="M58 46 C62 50 62 58 58 64" stroke="#000" strokeOpacity="0.12" strokeWidth="5" fill="none" />
      <TitleBars color={c.cream} y={108} />
    </>
  ),
  // A leading man's portrait (him): mustard ground, teal panel, side-parted hair, suit and tie.
  () => (
    <>
      <rect width="100" height="140" style={f(c.mustard)} />
      <rect x="8" y="8" width="84" height="88" style={f(c.teal)} />
      <circle cx="74" cy="28" r="12" style={f(c.cream, 0.5)} />
      <path d="M20 96 C20 78 34 72 50 72 C66 72 80 78 80 96 Z" style={f(c.ink)} />
      <path d="M42 72 L50 92 L58 72 Z" style={f(c.cream)} />
      <path d="M48 76 L50 92 L52 76 Z" style={f(c.red)} />
      <rect x="44" y="58" width="12" height="16" style={f(skin)} />
      <ellipse cx="50" cy="48" rx="14" ry="17" style={f(skin)} />
      <path d="M35 46 C33 30 44 26 54 27 C64 28 68 36 65 46 C62 38 54 34 44 37 C40 39 37 42 35 46 Z" style={f(hair)} />
      <path d="M43 48 h5 M53 48 h5" stroke={hair} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M46 58 h8" stroke={c.crimson} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M58 40 C64 46 63 56 58 62" stroke="#000" strokeOpacity="0.14" strokeWidth="6" fill="none" />
      <TitleBars color={c.crimson} y={106} />
    </>
  ),
  // A travel poster: pyramids and palms under a pale sky, teal border.
  () => (
    <>
      <rect width="100" height="140" style={f(c.teal)} />
      <rect x="7" y="7" width="86" height="96" style={f(c.cream)} />
      <circle cx="68" cy="30" r="10" style={f(c.orange, 0.85)} />
      <path d="M22 84 L48 44 L74 84 Z" style={f(c.mustard)} />
      <path d="M48 44 L74 84 L56 84 Z" style={f(c.orange)} />
      <path d="M60 84 L76 60 L92 84 Z" style={f(c.mustard, 0.85)} />
      <path d="M76 60 L92 84 L82 84 Z" style={f(c.orange, 0.9)} />
      <rect x="7" y="84" width="86" height="19" style={f(c.olive)} />
      <g stroke={c.ink} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M24 100 C22 86 22 72 26 58" />
        <path d="M84 100 C86 90 86 80 83 70" />
      </g>
      <g style={f(c.olive)} stroke={c.ink} strokeWidth="1">
        <path d="M26 58 C18 54 12 58 10 64 C16 60 22 60 26 58 Z" />
        <path d="M26 58 C30 50 38 50 42 54 C36 54 30 56 26 58 Z" />
        <path d="M26 58 C22 50 24 44 30 42 C28 48 28 54 26 58 Z" />
        <path d="M26 58 C34 58 38 64 38 70 C34 64 30 60 26 58 Z" />
        <path d="M83 70 C77 66 72 68 70 72 C75 70 80 70 83 70 Z" />
        <path d="M83 70 C87 64 93 64 96 68 C91 68 86 69 83 70 Z" />
        <path d="M83 70 C82 64 84 60 88 58 C86 62 85 66 83 70 Z" />
      </g>
      <TitleBars color={c.crimson} y={110} />
    </>
  ),
];

// Torn edges: a few hand-cut outlines, reused around the wall.
export const tears = [
  "polygon(0 1%, 22% 0, 48% 2%, 76% 0, 100% 1%, 99% 34%, 100% 70%, 98% 100%, 60% 99%, 30% 100%, 1% 98%, 0 60%)",
  "polygon(1% 0, 100% 0, 100% 62%, 96% 78%, 100% 100%, 0 100%, 2% 70%, 0 30%)",
  "polygon(0 0, 70% 1%, 84% 6%, 100% 0, 99% 100%, 40% 98%, 0 100%, 1% 50%)",
  "polygon(2% 2%, 98% 0, 100% 96%, 74% 100%, 70% 94%, 62% 100%, 0 99%)",
];
const ink = "var(--color-ink)";

/** A tea glass (istikana) on its saucer, with a spoon. */
export function TeaGlass({ className, style }: Art) {
  return (
    <svg viewBox="0 0 70 92" className={className} style={style}>
      <ellipse cx="35" cy="86" rx="33" ry="6" style={f(ink)} />
      <ellipse cx="35" cy="83" rx="31" ry="5" style={f("var(--color-poster-cream)")} stroke={ink} strokeWidth="2.5" />
      {/* The waisted glass: tea fills it to just under the rim. */}
      <path d="M14 10 H56 C56 30 47 40 47 50 C47 62 54 70 52 82 H18 C16 70 23 62 23 50 C23 40 14 30 14 10 Z" style={f("var(--color-poster-cream)", 0.35)} stroke={ink} strokeWidth="2.5" />
      <path d="M16 20 H54 C53 32 46 41 46 50 C46 62 52 70 50.5 80 H19.5 C18 70 24 62 24 50 C24 41 17 32 16 20 Z" style={f("#b2410f")} />
      <path d="M18 22 H30 C29 34 26 42 26 50 C26 60 30 68 29 78 H21 C20 68 25 60 25 50 C25 42 19 32 18 22 Z" style={f("#ffffff", 0.22)} />
      <rect x="44" y="0" width="4" height="56" rx="2" transform="rotate(14 46 28)" style={f("#c9c2ad")} stroke={ink} strokeWidth="1.5" />
      <ellipse cx="35" cy="10" rx="21" ry="3" style={f("none")} stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

/** A matchbox, tray half open, with two spent matches beside it. The label is a star, not a word. */
export function Matchbox({ className, style }: Art) {
  return (
    <svg viewBox="0 0 96 56" className={className} style={style}>
      <rect x="4" y="44" width="40" height="3" rx="1.5" transform="rotate(-8 24 45)" style={f("#e9cf9a")} stroke={ink} strokeWidth="1.2" />
      <circle cx="5" cy="47.5" r="3" style={f("var(--color-cabinet)")} />
      <rect x="22" y="22" width="54" height="26" rx="2" style={f("#d8b98a")} stroke={ink} strokeWidth="2.5" />
      <rect x="10" y="12" width="56" height="30" rx="2" style={f("var(--color-poster-red)")} stroke={ink} strokeWidth="2.5" />
      <rect x="10" y="12" width="56" height="5" style={f("var(--color-cabinet)")} />
      <rect x="15" y="20" width="46" height="18" rx="1" style={f("var(--color-poster-mustard)")} />
      <path d="M38 22 l2.6 5.4 6 .8 -4.4 4.1 1.1 5.9 -5.3 -2.9 -5.3 2.9 1.1 -5.9 -4.4 -4.1 6 -.8 z" style={f("var(--color-poster-crimson)")} />
      <rect x="10" y="12" width="56" height="30" rx="2" style={f("none")} stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

/** A compact cassette with the striped label of the era. */
export function Cassette({ className, style }: Art) {
  return (
    <svg viewBox="0 0 120 78" className={className} style={style}>
      <rect x="3" y="3" width="114" height="72" rx="6" style={f("var(--color-cabinet)")} stroke={ink} strokeWidth="3" />
      <rect x="11" y="9" width="98" height="44" rx="3" style={f("var(--color-poster-cream)")} />
      <rect x="11" y="15" width="98" height="5" style={f("var(--color-poster-red)")} />
      <rect x="11" y="20" width="98" height="5" style={f("var(--color-poster-orange)")} />
      <rect x="11" y="25" width="98" height="5" style={f("var(--color-poster-mustard)")} />
      <rect x="30" y="31" width="60" height="18" rx="9" style={f("var(--color-night)")} />
      <g style={f("var(--color-poster-cream)")} stroke={ink} strokeWidth="2">
        <circle cx="42" cy="40" r="6" />
        <circle cx="78" cy="40" r="6" />
      </g>
      <rect x="50" y="35" width="20" height="10" rx="1" style={f("#6b4a2e")} />
      <path d="M26 75 L32 60 H88 L94 75" style={f("#3a4240")} stroke={ink} strokeWidth="2" />
      <g style={f("var(--color-night)")}>
        <circle cx="44" cy="68" r="2.5" />
        <circle cx="76" cy="68" r="2.5" />
      </g>
    </svg>
  );
}

type Art = { className?: string; style?: React.CSSProperties };

/** A film reel with five windows and a loose tail of film. */
export function FilmReel({ className, style }: Art) {
  return (
    <svg viewBox="0 0 120 100" className={className} style={style}>
      <path d="M60 80 C78 92 96 86 118 96" style={f("none")} stroke={ink} strokeWidth="12" />
      <path d="M60 80 C78 92 96 86 118 96" style={f("none")} stroke={c.cream} strokeWidth="3" strokeDasharray="4 5" />
      <circle cx="46" cy="48" r="44" style={f(c.ink)} stroke={ink} strokeWidth="3" />
      <circle cx="46" cy="48" r="36" style={f("#3a4240")} />
      <g style={f(c.cream)}>
        {[0, 72, 144, 216, 288].map((a) => (
          <circle key={a} cx="46" cy="25" r="10" transform={`rotate(${a} 46 48)`} />
        ))}
      </g>
      <circle cx="46" cy="48" r="7" style={f(c.mustard)} stroke={ink} strokeWidth="2.5" />
    </svg>
  );
}

/** A tarboosh (fez) with its black tassel. */
export function Fez({ className, style }: Art) {
  return (
    <svg viewBox="0 0 90 84" className={className} style={style}>
      <ellipse cx="44" cy="76" rx="36" ry="6" style={f(c.crimson)} stroke={ink} strokeWidth="3" />
      <path d="M10 74 L18 14 C30 8 58 8 70 14 L78 74 Z" style={f(c.red)} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 18 L16 72" style={f("none")} stroke="#ffffff" strokeOpacity="0.25" strokeWidth="6" />
      <ellipse cx="44" cy="13" rx="26" ry="5" style={f(c.crimson)} stroke={ink} strokeWidth="3" />
      <path d="M44 12 C56 14 66 24 70 40" style={f("none")} stroke={ink} strokeWidth="3" />
      <path d="M68 38 l-4 22 h12 z" style={f(ink)} />
    </svg>
  );
}

/** A torn cinema ticket stub: perforated edge, a star and bars where the print would be. */
export function Ticket({ className, style, tone = c.mustard }: Art & { tone?: string }) {
  return (
    <svg viewBox="0 0 110 54" className={className} style={style}>
      <path
        d="M4 4 H106 V20 A7 7 0 0 0 106 34 V50 H4 V34 A7 7 0 0 0 4 20 Z"
        style={f(tone)}
        stroke={ink}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M78 6 V48" style={f("none")} stroke={ink} strokeWidth="2" strokeDasharray="3 4" />
      <path d="M92 18 l2.4 5 5.4 .7 -4 3.7 1 5.3 -4.8 -2.6 -4.8 2.6 1 -5.3 -4 -3.7 5.4 -.7 z" style={f(c.crimson)} />
      <g style={f(ink, 0.75)}>
        <rect x="16" y="16" width="48" height="7" rx="2" />
        <rect x="16" y="29" width="34" height="4" rx="2" />
        <rect x="16" y="37" width="40" height="4" rx="2" />
      </g>
    </svg>
  );
}

/** A four-point sparkle. */
export function Sparkle({ className, style, tone = c.mustard }: Art & { tone?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style}>
      <path d="M20 2 C22 14 26 18 38 20 C26 22 22 26 20 38 C18 26 14 22 2 20 C14 18 18 14 20 2 Z" style={f(tone)} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A loose hand-drawn squiggle. */
export function Squiggle({ className, style, tone = c.teal }: Art & { tone?: string }) {
  return (
    <svg viewBox="0 0 120 30" className={className} style={style}>
      <path d="M4 18 C16 2 26 30 38 16 S60 2 72 16 S96 30 116 10" style={f("none")} stroke={tone} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** A small framed one-sheet from the poster wall, tilted and taped. */
export function MiniPoster({ motif, className, style }: Art & { motif: number }) {
  const Motif = motifs[motif % motifs.length];
  return (
    <span className={`relative block aspect-[5/7] ${className ?? ""}`} style={style}>
      <span className="absolute inset-0 border-[3px] border-ink bg-poster-cream p-[6%] shadow-[0_6px_0_var(--color-ink)]" style={{ clipPath: tears[motif % tears.length] }}>
        <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" className="size-full">
          <Motif />
        </svg>
        <span className="poster-wear absolute inset-0 opacity-70 mix-blend-multiply" />
      </span>
      <span className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-5deg] bg-poster-cream/75 shadow-[0_1px_2px_rgb(0_0_0/0.2)]" />
    </span>
  );
}
