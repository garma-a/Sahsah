import Prop from "@/components/brand/props";

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
        <div className="absolute -bottom-1 start-3 flex items-end gap-1 xl:start-8">
          <Prop name="matchbox" className="w-20 -rotate-6 xl:w-24" />
          <Prop name="tea" className="w-12 xl:w-14" />
        </div>
        <div className="absolute -bottom-1 end-3 flex items-end gap-1 xl:end-8">
          <Prop name="seeds" className="w-14 rotate-12 xl:w-16" />
          <Prop name="cards" className="w-20 rotate-6 xl:w-24" />
        </div>
      </div>
    </div>
  );
}
