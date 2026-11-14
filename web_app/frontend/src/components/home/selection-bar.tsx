"use client";

import Button from "@/components/ui/button";
import { formatDigits } from "@/lib/format";
import { BOARD_SIZE } from "@/stores/draft-store";

type SelectionBarProps = { count: number; notice: string | null; onStart: () => void };

/** The floating bar that appears once a category is picked. The button waits for all six. */
export default function SelectionBar({ count, notice, onStart }: SelectionBarProps) {
  if (count < 1) return null;
  const ready = count >= BOARD_SIZE;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto flex w-full max-w-[44rem] animate-pop flex-col gap-1 rounded-[2rem] border-4 border-ink bg-cyan px-4 py-2.5 shadow-[0_6px_0_var(--color-ink)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:ps-8 sm:pe-3">
        <p role="status" className="px-1 text-center font-heading text-xl leading-snug text-ink sm:text-start sm:text-2xl">
          {notice ?? `اخترت ${formatDigits(count)}/${formatDigits(BOARD_SIZE)} فئات، يلا عشان نبتدي`}
        </p>
        <Button
          onClick={onStart}
          disabled={!ready}
          size="lg"
          className="h-14 shrink-0 text-2xl ring-[3px] ring-cream"
          aria-describedby={ready ? undefined : "bar-hint"}
        >
          ابدأ اللعب!
        </Button>
        {!ready && (
          <span id="bar-hint" className="sr-only">
            لازم تختار {formatDigits(BOARD_SIZE)} فئات الأول
          </span>
        )}
      </div>
    </div>
  );
}
