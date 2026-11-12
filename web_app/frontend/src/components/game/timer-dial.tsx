import { AlarmClockOff } from "lucide-react";
import type { Timer } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { ANSWER_MS } from "@/lib/use-remaining-ms";
import { cn } from "@/lib/utils";

const LOW_MS = 10000;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** m:ss in Arabic-Indic digits; a partial second counts as a whole one, so zero appears only at the end. */
export function clock(remainingMs: number): string {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return formatDigits(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`);
}

/**
 * The answering timer: a ring that empties and the time in the display face, big enough to read from across
 * the room. It goes red in the last ten seconds and turns into a "time's up" block at zero.
 */
export default function TimerDial({ state, remainingMs }: { state: Timer["state"]; remainingMs: number }) {
  const over = state === "elapsed" || (state === "running" && remainingMs <= 0);
  const paused = state === "paused";
  const low = !over && !paused && state === "running" && remainingMs <= LOW_MS;
  const share = Math.min(1, Math.max(0, remainingMs / ANSWER_MS));

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="timer"
        aria-label="الوقت المتبقي"
        className={cn(
          "relative grid size-28 place-items-center rounded-full border-4 border-ink shadow-[0_6px_0_var(--color-ink)] sm:size-32 lg:size-40",
          over ? "animate-[beat_0.9s_ease-in-out_3] bg-press text-white" : "bg-white text-ink",
        )}
      >
        {!over && (
          <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
            <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="7" className="stroke-ink/10" />
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - share)}
              className={cn("transition-[stroke-dashoffset] duration-200 ease-linear", low ? "stroke-press" : paused ? "stroke-amber" : "stroke-cyan")}
            />
          </svg>
        )}
        {over ? (
          <AlarmClockOff aria-hidden className="relative size-14 lg:size-20" strokeWidth={2.5} />
        ) : (
          <span dir="ltr" aria-hidden className={cn("tabular relative font-heading text-4xl leading-none sm:text-5xl lg:text-6xl", low && "text-press")}>
            {clock(remainingMs)}
          </span>
        )}
      </div>
      {/* Reserved height: the state label appears without pushing the question down. */}
      <div className="grid h-12 place-items-center">
        {over ? (
          <p className="animate-pop rounded-lg border-[3px] border-ink bg-press px-4 py-0.5 font-heading text-3xl leading-tight text-white">الوقت خلص</p>
        ) : paused ? (
          <p className="rounded-lg border-[3px] border-ink bg-amber px-4 py-0.5 font-heading text-2xl leading-tight text-ink">الوقت واقف</p>
        ) : null}
      </div>
      {/* Announced once when the state changes, never every second. */}
      <p role="status" className="sr-only">
        {over ? "الوقت خلص" : paused ? "الوقت واقف" : ""}
      </p>
    </div>
  );
}
