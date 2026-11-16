import { motifs, tears } from "@/components/brand/cinema-art";
import { cn } from "@/lib/utils";

const turns = [-3, 2, -1.5, 3.5, -4, 1.5, 3, -2.5, 4, -3.5, 1, -1];
const lifts = [0, 12, -8, 6, -12, 10, -4, 14, -10, 4, 8, -6];

type CinemaWallProps = {
  /**
   * "stage" (default) fills the window behind the game and is darkened so the TV glows in front of it.
   * "home" fills its positioned parent (the home shelves) and is only aged, so it stays warm next to the paper.
   */
  variant?: "stage" | "home";
  className?: string;
};

/**
 * A wall of worn, overlapping, text-free cinema posters drawn in SVG: portraits, travel scenes and graphic
 * one-sheets, each torn, folded, halftoned and taped. Purely decorative.
 */
export default function CinemaWall({ variant = "stage", className }: CinemaWallProps) {
  const home = variant === "home";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none isolate overflow-hidden",
        home ? "absolute inset-0 rounded-[inherit] bg-[#6b4a2e]" : "fixed inset-0 -z-10 bg-[#2a211b]",
        className,
      )}
    >
      <ul
        className={cn(
          "absolute -inset-12 grid content-start",
          home
            ? "grid-cols-4 gap-x-0 gap-y-1 lg:grid-cols-6 2xl:grid-cols-7"
            : "grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-8",
        )}
      >
        {Array.from({ length: home ? 72 : 48 }, (_, i) => {
          const Motif = motifs[(i * 5) % motifs.length];
          return (
            <li
              key={i}
              className="relative aspect-[5/7] shadow-[0_8px_18px_rgb(0_0_0/0.55)]"
              style={{
                transform: `translateY(${lifts[i % lifts.length]}px) rotate(${turns[i % turns.length]}deg)${home ? " scale(1.12)" : ""}`,
                // On the home wall the posters overlap, so they are stacked in a scattered order.
                zIndex: home ? (i * 7) % 5 : undefined,
              }}
            >
              <div className="absolute inset-0 overflow-hidden bg-poster-cream p-[5%]" style={{ clipPath: tears[i % tears.length] }}>
                <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" className="size-full">
                  <Motif />
                </svg>
                <div className="halftone absolute inset-0 mix-blend-multiply" />
                <div className="poster-wear absolute inset-0 mix-blend-multiply" />
              </div>
              {i % 3 === 0 && <span className="absolute -top-1.5 left-1/2 h-4 w-12 -translate-x-1/2 rotate-[-4deg] bg-poster-cream/60" />}
            </li>
          );
        })}
      </ul>
      {home ? (
        <>
          {/* Age: sun-faded toward sepia and washed with old paper, so the cream shelves sit naturally on top. */}
          <div className="absolute inset-0 bg-[#7a5530] mix-blend-color opacity-45" />
          <div className="absolute inset-0 bg-[#b48a5a] mix-blend-multiply opacity-55" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_35%,rgb(42_26_20/0.55)_100%)]" />
          <div className="grain-dark absolute inset-0 opacity-70" />
        </>
      ) : (
        <>
          {/* Age: everything is sun-faded toward sepia, then dimmed at the edges of the room. */}
          <div className="absolute inset-0 bg-[#3b2a1a] mix-blend-color opacity-35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(20_14_10/0.45)_0%,rgb(14_10_8/0.85)_100%)]" />
          <div className="grain-dark absolute inset-0 opacity-50" />
        </>
      )}
    </div>
  );
}
