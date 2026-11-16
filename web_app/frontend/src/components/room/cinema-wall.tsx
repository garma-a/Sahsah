// The brand colours as CSS variables (see globals.css), so the art follows the tokens.
const c = {
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
const f = (fill: string, opacity?: number): React.CSSProperties => ({ fill, opacity });

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

// Eight text-free one-sheets in the manner of 1950s-60s Egyptian cinema posters: flat shapes, bold grounds.
const motifs: Array<() => React.ReactNode> = [
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
];

// Torn edges: a few hand-cut outlines, reused around the wall.
const tears = [
  "polygon(0 1%, 22% 0, 48% 2%, 76% 0, 100% 1%, 99% 34%, 100% 70%, 98% 100%, 60% 99%, 30% 100%, 1% 98%, 0 60%)",
  "polygon(1% 0, 100% 0, 100% 62%, 96% 78%, 100% 100%, 0 100%, 2% 70%, 0 30%)",
  "polygon(0 0, 70% 1%, 84% 6%, 100% 0, 99% 100%, 40% 98%, 0 100%, 1% 50%)",
  "polygon(2% 2%, 98% 0, 100% 96%, 74% 100%, 70% 94%, 62% 100%, 0 99%)",
];
const turns = [-3, 2, -1.5, 3.5, -4, 1.5, 3, -2.5, 4, -3.5, 1, -1];
const lifts = [0, 12, -8, 6, -12, 10, -4, 14, -10, 4, 8, -6];

/**
 * The stage behind the game: a wall of worn, text-free cinema posters drawn in SVG, faded and darkened so the
 * screen in front of it stays the brightest thing in the room.
 */
export default function CinemaWall() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#2a211b]">
      <ul className="absolute -inset-12 grid grid-cols-3 content-start gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-8">
        {Array.from({ length: 48 }, (_, i) => {
          const Motif = motifs[(i * 5) % motifs.length];
          return (
            <li
              key={i}
              className="relative aspect-[5/7] shadow-[0_8px_18px_rgb(0_0_0/0.55)]"
              style={{ transform: `translateY(${lifts[i % lifts.length]}px) rotate(${turns[i % turns.length]}deg)` }}
            >
              <div className="absolute inset-0 overflow-hidden bg-poster-cream p-[5%]" style={{ clipPath: tears[i % tears.length] }}>
                <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" className="size-full">
                  <Motif />
                </svg>
                <div className="poster-wear absolute inset-0 mix-blend-multiply" />
              </div>
              {i % 3 === 0 && <span className="absolute -top-1.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-4deg] bg-poster-cream/60" />}
            </li>
          );
        })}
      </ul>
      {/* Age: everything is sun-faded toward sepia, then dimmed at the edges of the room. */}
      <div className="absolute inset-0 bg-[#3b2a1a] mix-blend-color opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(20_14_10/0.45)_0%,rgb(14_10_8/0.85)_100%)]" />
      <div className="grain-dark absolute inset-0 opacity-50" />
    </div>
  );
}
