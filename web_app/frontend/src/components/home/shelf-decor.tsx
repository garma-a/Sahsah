import { c, Cassette, FilmReel, Fez, Matchbox, MiniPoster, Sparkle, Squiggle, TeaGlass, Ticket } from "@/components/brand/cinema-art";
import { cn } from "@/lib/utils";

// Four small cinema collages, each sized to one empty poster slot (a 4:5 box) and laid out in percentages.
const collages: Array<(flip: boolean) => React.ReactNode> = [
  (flip) => (
    <>
      <MiniPoster motif={0} className="absolute start-[12%] top-[6%] w-[58%]" style={{ rotate: flip ? "6deg" : "-6deg" }} />
      <Ticket className="absolute bottom-[10%] end-0 w-[70%]" style={{ rotate: flip ? "-9deg" : "9deg" }} />
      <Sparkle className="absolute end-[6%] top-0 w-[18%]" />
    </>
  ),
  (flip) => (
    <>
      <FilmReel className="absolute start-[2%] top-[8%] w-[84%]" style={{ rotate: flip ? "10deg" : "-8deg" }} />
      <TeaGlass className="absolute bottom-[4%] end-[8%] w-[36%]" />
      <Sparkle tone={c.teal} className="absolute bottom-[30%] start-[6%] w-[14%]" />
    </>
  ),
  (flip) => (
    <>
      <Squiggle tone={c.red} className="absolute start-0 top-[4%] w-[62%]" />
      <Fez className="absolute end-[8%] top-[14%] w-[54%]" style={{ rotate: flip ? "-7deg" : "7deg" }} />
      <Cassette className="absolute bottom-[10%] start-[2%] w-[78%]" style={{ rotate: flip ? "6deg" : "-7deg" }} />
    </>
  ),
  (flip) => (
    <>
      <MiniPoster motif={7} className="absolute end-[10%] top-[4%] w-[56%]" style={{ rotate: flip ? "-5deg" : "5deg" }} />
      <Matchbox className="absolute bottom-[8%] start-[4%] w-[66%]" style={{ rotate: flip ? "4deg" : "-4deg" }} />
      <Sparkle tone={c.pink} className="absolute start-[8%] top-[18%] w-[16%]" />
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
 * Collages in the empty slots either side of a shelf's last row. A row is centred, so when it holds at least
 * two fewer posters than fit, there is a whole free slot on each side; the collages appear only at those
 * breakpoints and never sit over a poster. Purely decorative.
 */
export function RowEnds({ count, variant }: { count: number; variant: number }) {
  const visibility = steps.map(({ cols, show, hide }) => {
    const free = count % cols === 0 ? 0 : cols - (count % cols);
    return free >= 2 ? show : hide;
  });
  if (visibility.every((v) => v.endsWith("hidden"))) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0", visibility)}>
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          className={cn("absolute bottom-0 aspect-[4/5] w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]", flip ? "end-0" : "start-0")}
        >
          {collages[(variant * 2 + (flip ? 1 : 0)) % collages.length](flip)}
        </div>
      ))}
    </div>
  );
}

/**
 * Props pinned in the cream margins outside the shelves on wide screens: a column on each side, spaced down
 * the page. Hidden wherever the margins are too narrow to hold them.
 */
export function GutterDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden min-[1360px]:block">
      {[false, true].map((flip) => (
        <div
          key={String(flip)}
          className={cn(
            "absolute bottom-40 top-56 flex w-[calc((100%-1200px)/2)] max-w-72 flex-col items-center justify-between px-4",
            flip ? "end-0" : "start-0",
          )}
        >
          {flip ? (
            <>
              <FilmReel className="w-[78%] max-w-40" style={{ rotate: "12deg" }} />
              <Sparkle className="me-[30%] w-8" tone={c.teal} />
              <MiniPoster motif={2} className="w-[62%] max-w-32" style={{ rotate: "5deg" }} />
              <Ticket className="w-[82%] max-w-44" tone={c.teal} style={{ rotate: "-10deg" }} />
              <TeaGlass className="w-[42%] max-w-20" />
            </>
          ) : (
            <>
              <MiniPoster motif={4} className="w-[62%] max-w-32" style={{ rotate: "-6deg" }} />
              <Squiggle className="w-[70%] max-w-36" />
              <Fez className="w-[56%] max-w-28" style={{ rotate: "-8deg" }} />
              <Sparkle className="ms-[30%] w-9" tone={c.pink} />
              <Cassette className="w-[86%] max-w-44" style={{ rotate: "8deg" }} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
