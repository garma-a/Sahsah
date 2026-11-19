import Prop from "@/components/brand/props";
import { cn } from "@/lib/utils";

// Still lifes lying on the paper in an empty poster slot (a 4:5 box), laid out in percentages.
const stills: Array<(flip: boolean) => React.ReactNode> = [
  (flip) => (
    <>
      <Prop name="cards" className="absolute start-[4%] top-[6%] w-[78%]" style={{ rotate: flip ? "8deg" : "-8deg" }} />
      <Prop name="matchbox" className="absolute bottom-[2%] end-[2%] w-[62%]" style={{ rotate: flip ? "-12deg" : "10deg" }} />
    </>
  ),
  (flip) => (
    <>
      <Prop name="tea" className="absolute end-[10%] top-[4%] w-[56%]" />
      <Prop name="seeds" className="absolute bottom-[4%] start-[2%] w-[64%]" style={{ rotate: flip ? "14deg" : "-10deg" }} />
    </>
  ),
  (flip) => (
    <>
      <Prop name="tickets" className="absolute start-[6%] top-[10%] w-[74%]" style={{ rotate: flip ? "-6deg" : "7deg" }} />
      <Prop name="dice" className="absolute bottom-[8%] end-[8%] w-[46%]" />
    </>
  ),
  (flip) => (
    <>
      <Prop name="cassette" className="absolute end-[4%] top-[8%] w-[70%]" style={{ rotate: flip ? "9deg" : "-9deg" }} />
      <Prop name="glasses" className="absolute bottom-[6%] start-[4%] w-[66%]" style={{ rotate: flip ? "-5deg" : "6deg" }} />
    </>
  ),
];

// Breakpoints of the shelf grid and how many posters a row holds at each (see `list` in shelves.tsx).
// The class strings are written out in full so Tailwind sees them.
const steps = [
  { cols: 2, show: "block", hide: "hidden" },
  { cols: 3, show: "sm:block", hide: "sm:hidden" },
  { cols: 4, show: "md:block", hide: "md:hidden" },
  { cols: 5, show: "lg:block", hide: "lg:hidden" },
];

/**
 * Still lifes in the empty slots either side of a shelf's last row. A row is centred, so when it holds at
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
          className={cn("absolute bottom-0 aspect-[4/5] w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]", flip ? "end-0" : "start-0")}
        >
          {stills[(variant * 2 + (flip ? 1 : 0)) % stills.length](flip)}
        </div>
      ))}
    </div>
  );
}

/** A small wooden ledge screwed to the wall, holding one or two props. */
function Ledge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex w-full items-end justify-center gap-1 px-3", className)}>
      {children}
      <span className="absolute inset-x-0 -bottom-3 h-3.5 rounded-[3px] border-2 border-ink bg-shelf shadow-[0_14px_18px_rgb(0_0_0/0.55),inset_0_2px_0_rgb(255_255_255/0.15)]" />
      <span className="absolute -bottom-9 start-6 h-7 w-2 bg-ink/80 [clip-path:polygon(0_0,100%_0,100%_100%)]" />
      <span className="absolute -bottom-9 end-6 h-7 w-2 bg-ink/80 [clip-path:polygon(0_0,100%_0,0_100%)]" />
    </div>
  );
}

/**
 * Wall ledges in the margins outside the shelves on wide screens, each holding a piece of the lobby's
 * clutter. Hidden wherever the margins are too narrow to hold them.
 */
export function GutterDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden min-[1500px]:block">
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          className={cn(
            "absolute bottom-48 top-64 flex w-[calc((100%-1200px)/2)] max-w-72 flex-col items-center justify-around px-5",
            flip ? "end-0" : "start-0",
          )}
        >
          {flip ? (
            <>
              <Ledge><Prop name="radio" className="w-[80%] max-w-48" /></Ledge>
              <Ledge><Prop name="reel" className="w-[78%] max-w-44" /></Ledge>
              <Ledge><Prop name="tea" className="w-[40%] max-w-24" /><Prop name="matchbox" className="w-[52%] max-w-28" /></Ledge>
            </>
          ) : (
            <>
              <Ledge><Prop name="phone" className="w-[80%] max-w-48" /></Ledge>
              <Ledge><Prop name="fez" className="w-[64%] max-w-36" /></Ledge>
              <Ledge><Prop name="cassette" className="w-[52%] max-w-28" style={{ rotate: "-8deg" }} /><Prop name="cards" className="w-[54%] max-w-28" /></Ledge>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
