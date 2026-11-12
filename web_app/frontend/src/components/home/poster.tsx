"use client";

import { Check } from "lucide-react";
import Cover from "@/components/brand/cover";
import { toneAt } from "@/components/brand/tones";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PosterProps = {
  category: Category;
  toneIndex: number;
  selected: boolean;
  /** Six are already chosen: unselected posters rest until one is removed. */
  full: boolean;
  priority?: boolean;
  onToggle: (category: Category) => void;
};

/** A category poster on the shelf: a printed card with a coloured border, a name ribbon and the "؟" badge. */
export default function Poster({ category, toneIndex, selected, full, priority, onToggle }: PosterProps) {
  const tone = toneAt(toneIndex);
  const unavailable = category.publishedPackCount < 1;
  const resting = !selected && (full || unavailable);

  return (
    <button
      type="button"
      aria-pressed={unavailable ? undefined : selected}
      aria-disabled={unavailable || undefined}
      disabled={unavailable}
      onClick={() => onToggle(category)}
      className={cn(
        "group relative block w-full rounded-sm pb-4 text-start transition-[transform,opacity,filter] duration-200",
        !unavailable && "cursor-pointer hover:-translate-y-1",
        selected && "-translate-y-2 -rotate-1 hover:-translate-y-2",
        resting && "opacity-70",
        unavailable && "cursor-not-allowed grayscale",
      )}
    >
      <span
        className={cn(
          "relative block border-[5px] bg-[#fff8ea] shadow-poster transition-shadow duration-200",
          tone.border,
          selected && "shadow-[7px_7px_0_var(--color-ink)]",
        )}
      >
        <Cover src={category.coverUrl} name={category.name} priority={priority} />
        {selected && <span aria-hidden className="pointer-events-none absolute inset-0 border-[3px] border-ink/80" />}
        {unavailable && (
          <span aria-hidden className="absolute inset-0 grid place-items-center bg-ink/55">
            <span className="-rotate-6 rounded-md border-[3px] border-cream px-3 py-1 font-heading text-2xl text-cream">قريبًا</span>
          </span>
        )}
      </span>

      <span
        aria-hidden
        className={cn(
          "absolute -end-3 -top-3 grid size-11 place-items-center rounded-full border-[3px] border-ink font-heading text-2xl leading-none shadow-[0_3px_0_var(--color-ink)] transition-colors duration-200",
          selected ? "animate-pop bg-green text-ink" : "bg-sun text-ink",
        )}
      >
        {selected ? <Check strokeWidth={4} className="size-6" /> : "؟"}
      </span>

      <span
        className={cn(
          "relative -mt-3 mx-1.5 block -rotate-2 truncate rounded-md px-3 py-1.5 text-center font-heading text-xl leading-snug shadow-[0_3px_0_rgb(29_35_33/0.35)]",
          unavailable ? "bg-charcoal/70 text-cream" : tone.ribbon,
        )}
      >
        {category.name}
        {unavailable && <span className="sr-only"> (قريبًا)</span>}
      </span>
      {category.description && <span className="sr-only">{category.description}</span>}
    </button>
  );
}
