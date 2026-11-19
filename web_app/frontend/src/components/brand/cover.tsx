"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** The second ink of each category tone (same order as `tones`): the billing line and the title's offset shadow. */
const accents = ["#f0b323", "#5fc0c4", "#e9c46a", "#f6a5bf", "#f0b323", "#f6d64a"];

/** A stable small number from a name, so a cover without a tone still gets the same ink every time. */
function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

type CoverProps = {
  src?: string;
  name: string;
  /** Category tone index (see tones.ts): picks the accent ink. Defaults to one derived from the name. */
  tone?: number;
  /** The billing line above the title. */
  credit?: string;
  className?: string;
  /** Kept for callers; the photo is a plain image sized by the poster. */
  sizes?: string;
  eager?: boolean;
};

/**
 * A category cover as a film still from a lavish 1960s Technicolor picture: the full-colour photograph fills
 * the frame, darkened at the foot, where the category name is hand-lettered in Rakkas under a billing line.
 * Below 160px wide (board columns, lobby strip) the name moves to a solid slab at the top in Lalezar so it
 * stays readable (yellow on ink, 11:1). The frame is 4:5, or the parent's height.
 */
export default function Cover({ src, name, tone, credit = "صحصح تقدّم", className, eager }: CoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const index = tone ?? hash(name);
  const accent = accents[((index % accents.length) + accents.length) % accents.length];
  const long = [...name].length;
  const size = long <= 8 ? "17cqw" : long <= 13 ? "14cqw" : "11.5cqw";
  const photo = src && failedSrc !== src;

  return (
    <div className={cn("@container relative isolate aspect-[4/5] w-full overflow-hidden bg-[#22160e]", className)}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo sized by the poster
        <img
          src={src}
          alt=""
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 size-full object-cover object-[50%_35%]"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#7a2e22,#22160e_75%)]" />
      )}

      {/* Print and age: the foot darkened for the title, a soft vignette, grain and a warm cast. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(18_10_6/0.92)_0%,rgb(18_10_6/0.55)_26%,transparent_50%)] @max-[160px]:bg-[linear-gradient(to_bottom,rgb(18_10_6/0.55),transparent_45%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: "var(--grain)", backgroundSize: "160px 160px", boxShadow: "inset 0 0 14cqw rgb(40 18 6 / 0.55)" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#d9a55a] opacity-[0.07] mix-blend-color" />

      <div className="absolute inset-x-[6%] bottom-[6%] text-center @max-[160px]:inset-x-0 @max-[160px]:top-0 @max-[160px]:bottom-auto">
        <p aria-hidden className="text-[3.6cqw] font-bold leading-none @max-[160px]:hidden" style={{ color: accent }}>
          {credit}
        </p>
        <p
          className="mt-[2.5cqw] -rotate-2 font-poster leading-[1.02] text-[#fbf1dc] [text-wrap:balance] @max-[160px]:mt-0 @max-[160px]:rotate-0 @max-[160px]:bg-[#1d2321] @max-[160px]:px-[4%] @max-[160px]:py-[3%] @max-[160px]:font-heading @max-[160px]:text-[14cqw]! @max-[160px]:text-[#f6d64a] @max-[160px]:[text-shadow:none]!"
          style={{ fontSize: size, textShadow: `0 0.4cqw 0 #120a06, 1.1cqw 1.3cqw 0 ${accent}99, 0 0 6cqw rgb(0 0 0 / 0.6)` }}
        >
          {name}
        </p>
      </div>
    </div>
  );
}
