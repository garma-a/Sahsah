"use client";

import { Check } from "lucide-react";
import Cover from "@/components/brand/cover";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PosterProps = {
  category: Category;
  toneIndex: number;
  selected: boolean;
  /** Six are already chosen: unselected posters rest until one is removed. */
  full: boolean;
  eager?: boolean;
  onToggle: (category: Category) => void;
};

// Polished brass, lit from the upper left.
const brass = "bg-[linear-gradient(135deg,#f8e3a0_0%,#c39a45_22%,#7c5418_48%,#d8b062_70%,#5e3d10_100%)]";

/**
 * A category on the lobby wall: its film still behind glass in a brass display case, under a small picture
 * lamp that throws a pool of light on the velvet. Picking it lights the case's bulbs and stamps a brass tick.
 */
export default function Poster({ category, toneIndex, selected, full, eager, onToggle }: PosterProps) {
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
        "group relative block w-full rounded-[3px] text-start transition-[transform,opacity,filter] duration-200",
        !unavailable && "cursor-pointer hover:-translate-y-1",
        selected && "-translate-y-1.5",
        resting && "opacity-60 saturate-50",
        unavailable && "cursor-not-allowed grayscale",
      )}
    >
      {/* The lamp's pool of light on the velvet above the case, brighter when picked. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-x-[18%] -top-[22%] h-[70%] bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgb(255_214_150/0.38),transparent)] transition-opacity duration-300",
          selected ? "opacity-100" : "opacity-60 group-hover:opacity-90",
        )}
      />
      {/* The picture lamp: a brass hood on a short arm. */}
      <span aria-hidden className={cn("absolute -top-3 left-1/2 z-10 h-2.5 w-[38%] -translate-x-1/2 rounded-t-full shadow-[0_3px_4px_rgb(0_0_0/0.6)]", brass)} />
      <span aria-hidden className="absolute -top-[3px] left-1/2 z-10 h-1 w-[30%] -translate-x-1/2 rounded-full bg-[#fff1c9] blur-[2px]" />

      <span
        className={cn(
          "relative block rounded-[3px] p-[5px] shadow-[0_14px_22px_rgb(0_0_0/0.65),0_2px_0_rgb(0_0_0/0.5)] transition-shadow duration-300",
          brass,
          selected && "shadow-[0_0_0_3px_#f6d64a,0_0_34px_rgb(246_214_74/0.65),0_14px_22px_rgb(0_0_0/0.65)]",
        )}
      >
        <span className="relative block overflow-hidden rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.6)]">
          <Cover src={category.coverUrl} name={category.name} tone={toneIndex} eager={eager} />
          {/* The glass: a diagonal glare that slides on hover. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.16)_38%,transparent_46%,transparent_70%,rgb(255_255_255/0.06)_76%,transparent_82%)] transition-transform duration-500 group-hover:translate-x-[8%]"
          />
          {unavailable && (
            <span aria-hidden className="absolute inset-0 grid place-items-center bg-ink/60">
              <span className="-rotate-6 rounded-md border-[3px] border-cream px-3 py-1 font-heading text-2xl text-cream">قريبًا</span>
            </span>
          )}
        </span>
        {/* Marquee bulbs along the top and bottom rails, lit when the category is picked. */}
        {["top-[1px]", "bottom-[1px]"].map((edge) => (
          <span key={edge} aria-hidden className={cn("pointer-events-none absolute inset-x-[10%] flex justify-between", edge)}>
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-[3px] rounded-full transition-[background-color,box-shadow] duration-300",
                  selected ? "bg-[#fff6d0] shadow-[0_0_5px_2px_rgb(255_220_120/0.85)]" : "bg-[#5e3d10]",
                )}
              />
            ))}
          </span>
        ))}
      </span>

      <span
        aria-hidden
        className={cn(
          "absolute -top-3 -end-3 z-10 grid size-11 max-sm:top-auto max-sm:-bottom-3 place-items-center rounded-full border-2 border-[#3a250c] font-heading text-2xl leading-none text-[#2a1a08] shadow-[0_4px_6px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.6)] transition-colors duration-200",
          selected ? "animate-pop bg-[radial-gradient(circle_at_35%_30%,#fff3b0,#f6d64a_45%,#b88a1c)]" : brass,
        )}
      >
        {selected ? <Check strokeWidth={4} className="size-6" /> : "؟"}
      </span>

      {unavailable && <span className="sr-only"> (قريبًا)</span>}
      {category.description && <span className="sr-only">{category.description}</span>}
    </button>
  );
}
