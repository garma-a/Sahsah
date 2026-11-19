import Prop, { type PropName } from "@/components/brand/props";
import { cn } from "@/lib/utils";

const stills: PropName[] = ["still-tea", "still-cards", "still-radio", "still-tawla"];

// Breakpoints of the shelf grid and how many posters a row holds at each (see `list` in shelves.tsx).
// The class strings are written out in full so Tailwind sees them.
const steps = [
  { cols: 2, show: "block", hide: "hidden" },
  { cols: 3, show: "sm:block", hide: "sm:hidden" },
  { cols: 4, show: "md:block", hide: "md:hidden" },
  { cols: 5, show: "lg:block", hide: "lg:hidden" },
];

/**
 * A still life in each empty slot either side of a shelf's last row. A row is centred, so when it holds at
 * least two fewer posters than fit, there is a whole free slot on each side; the props appear only at those
 * breakpoints and never sit over a poster. Purely decorative.
 */
export function RowEnds({ count, variant }: { count: number; variant: number }) {
  const visibility = steps.map(({ cols, show, hide }) => {
    const free = count % cols === 0 ? 0 : cols - (count % cols);
    return free >= 2 ? show : hide;
  });
  if (visibility.every((v) => v.endsWith("hidden"))) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0 max-sm:hidden", visibility)}>
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          className={cn(
            "absolute bottom-0 flex aspect-[4/5] w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] items-end justify-center",
            flip ? "end-0" : "start-0",
          )}
        >
          <Prop name={stills[(variant * 2 + (flip ? 3 : 2)) % stills.length]} className="w-[135%] max-w-none" />
        </div>
      ))}
    </div>
  );
}

/**
 * The foot of the display case: a walnut ledge with a brass rail, the house tea on one end and the game-night
 * cards and matches on the other, with the engraved "continuous showing" plaque between them.
 */
export function DisplayLedge() {
  return (
    <div aria-hidden className="pointer-events-none relative -mx-4 mt-16 h-36 sm:-mx-6 sm:h-44 md:-mx-10 lg:mt-20 lg:h-56">
      <div className="absolute inset-x-0 bottom-0 h-7 rounded-b-[5px] bg-[#3b2414] bg-[url(/cinema/walnut.webp)] bg-[length:900px_auto] shadow-[0_-2px_0_#c39a45,0_-6px_14px_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_235_200/0.25)] sm:h-9" />
      <Prop name="still-tea" className="absolute bottom-3 start-[-2%] w-[52%] max-w-[26rem] sm:bottom-4 sm:w-[44%] lg:w-[36%]" />
      <Prop name="still-cards" className="absolute bottom-3 end-[-3%] w-[56%] max-w-[28rem] sm:bottom-4 sm:w-[46%] lg:w-[38%]" />
      <p className="absolute bottom-12 left-1/2 hidden -translate-x-1/2 rounded-sm bg-[linear-gradient(135deg,#f8e3a0,#c39a45_35%,#7c5418_60%,#d8b062)] px-6 py-1.5 font-poster text-2xl whitespace-nowrap text-[#3a250c] shadow-[0_6px_10px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.6)] [text-shadow:0_1px_0_rgb(255_240_200/0.6)] lg:block">
        عرض مستمر
      </p>
    </div>
  );
}

/** A small wooden ledge screwed to the wall, holding a still life. */
function Ledge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex w-full items-end justify-center px-2", className)}>
      {children}
      <span className="absolute inset-x-0 -bottom-3 h-3.5 rounded-[3px] border-2 border-ink bg-[#3b2414] bg-[url(/cinema/walnut.webp)] bg-[length:600px_auto] shadow-[0_14px_18px_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_255_255/0.15)]" />
      <span className="absolute -bottom-9 start-6 h-7 w-2 bg-ink/80 [clip-path:polygon(0_0,100%_0,100%_100%)]" />
      <span className="absolute -bottom-9 end-6 h-7 w-2 bg-ink/80 [clip-path:polygon(0_0,100%_0,0_100%)]" />
    </div>
  );
}

/**
 * Wall ledges in the margins outside the display case on wide screens, each holding one of the lobby's still
 * lifes. Hidden wherever the margins are too narrow to hold them.
 */
export function GutterDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden min-[1500px]:block">
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          className={cn(
            "absolute bottom-64 top-72 flex w-[calc((100%-1200px)/2)] max-w-80 flex-col items-center justify-around px-4",
            flip ? "end-0" : "start-0",
          )}
        >
          <Ledge><Prop name={flip ? "still-radio" : "still-tawla"} className="w-[118%] max-w-none" /></Ledge>
          <Ledge><Prop name={flip ? "reel" : "phone"} className="w-[72%] max-w-48" /></Ledge>
        </div>
      ))}
    </div>
  );
}
