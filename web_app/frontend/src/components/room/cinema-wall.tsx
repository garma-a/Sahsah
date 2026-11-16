import { motifs, tears } from "@/components/brand/cinema-art";

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
