"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Print inks, one set per category tone (same order as `tones`): the flat field, the burst behind the star,
 * the slab under a title, the title ink and its offset shadow. Bright offset-litho colours on cream paper.
 */
const inks = [
  { field: "#d7402a", burst: "#f0b323", slab: "#1d2321", title: "#f6e7c4", shade: "#f0b323" },
  { field: "#1f8f9a", burst: "#5fc0c4", slab: "#d7402a", title: "#f6d64a", shade: "#1d2321" },
  { field: "#3d8b4a", burst: "#f0b323", slab: "#f6e7c4", title: "#d7402a", shade: "#1d2321" },
  { field: "#d13a6e", burst: "#f6a5bf", slab: "#1d2321", title: "#f6d64a", shade: "#d7402a" },
  { field: "#2453a0", burst: "#f0b323", slab: "#d7402a", title: "#f6e7c4", shade: "#1d2321" },
  { field: "#f0b323", burst: "#f6e7c4", slab: "#d7402a", title: "#d7402a", shade: "#1d2321" },
];

/** A stable small number from a name, so a cover without a tone still gets the same inks every time. */
function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// An ink outline drawn with shadows (a CSS stroke breaks joined Arabic letters and swallows Rakkas' dots),
// then the offset second-colour shadow of hand-lettered titles.
function lettering(shade: string, outline = true) {
  const s = "0.45cqw";
  const ink = "#1d2321";
  const ring = outline ? [`${s} 0 0 ${ink}`, `-${s} 0 0 ${ink}`, `0 ${s} 0 ${ink}`, `0 -${s} 0 ${ink}`] : [];
  return [...ring, `1.3cqw 1.5cqw 0 ${shade}`].join(", ");
}

type CoverProps = {
  src?: string;
  name: string;
  /** Category tone index (see tones.ts): picks the inks and the layout. Defaults to one derived from the name. */
  tone?: number;
  /** Two short credit lines: the studio line and the billing. */
  credits?: [string, string];
  className?: string;
  /** Kept for callers; the photo is a plain image sized by the poster. */
  sizes?: string;
  eager?: boolean;
};

/**
 * A category cover printed as a classic Egyptian cinema one-sheet: the star's black-and-white photo on a flat
 * ink field with a burst behind, the category name hand-lettered in Rakkas, short credits, on cream paper.
 * Three layouts rotate so a shelf never repeats itself: a dark title band, a headline lettered straight onto
 * the field, and a framed photo over a title slab. Below 160px wide (board columns, lobby strip) the credits go
 * and the name is set in Lalezar on a solid slab so it stays readable. The frame is 4:5, or the parent's height.
 */
export default function Cover({ src, name, tone, credits = ["صحصح تقدّم", "إعداد الأسئلة: فريق صحصح"], className, eager }: CoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const index = tone ?? hash(name);
  const ink = inks[((index % inks.length) + inks.length) % inks.length];
  const layout = (["band", "headline", "framed"] as const)[((index % 3) + 3) % 3];
  const long = [...name].length;
  const size = long <= 8 ? "19cqw" : long <= 13 ? "15.5cqw" : "12.5cqw";
  const photo = src && failedSrc !== src;

  const image = photo && (
    // eslint-disable-next-line @next/next/no-img-element -- print layer sized by the poster
    <img
      src={src}
      alt=""
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      onError={() => setFailedSrc(src)}
      className="absolute inset-0 size-full object-contain object-bottom"
      style={{ filter: "grayscale(1) contrast(1.12) brightness(1.03) sepia(0.12)" }}
    />
  );

  const compact = "@max-[160px]:font-heading @max-[160px]:text-[14cqw]! @max-[160px]:rotate-0 @max-[160px]:[text-shadow:none]!";

  return (
    <div className={cn("@container relative isolate aspect-[4/5] w-full overflow-hidden bg-[#f3e6c8]", className)}>
      <div className="absolute inset-[3%] overflow-hidden" style={{ backgroundColor: ink.field }}>
        {/* The burst behind the star. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[52%] aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{
            background: `repeating-conic-gradient(${ink.burst} 0deg 6deg, transparent 6deg 15deg)`,
            maskImage: "radial-gradient(circle, #000 0 22%, rgb(0 0 0 / 0.55) 40%, transparent 62%)",
          }}
        />

        {layout === "framed" ? (
          <div className="absolute inset-x-[12%] bottom-[24%] top-[8%] -rotate-2 bg-[#f3e6c8] p-[2.5%] shadow-[0.8cqw_1cqw_0_#1d2321] @max-[160px]:inset-x-[6%] @max-[160px]:bottom-[26%] @max-[160px]:top-[4%]">
            <div className="relative size-full overflow-hidden bg-[#9aa39d]">{image}</div>
          </div>
        ) : (
          <div className={cn("absolute -inset-x-[14%] bottom-[7%] @max-[160px]:bottom-0", layout === "band" ? "top-[19%]" : "top-[21%]")}>{image}</div>
        )}
        <div aria-hidden className="halftone pointer-events-none absolute inset-0 mix-blend-multiply opacity-40" />

        {layout === "band" && (
          <div className="absolute inset-x-0 top-0 px-[4%] pb-[3%] pt-[2.5%] text-center" style={{ backgroundColor: ink.slab }}>
            <p aria-hidden className="text-[3.3cqw] font-bold leading-none text-[#f3e6c8]/80 @max-[160px]:hidden">{credits[0]}</p>
            <p
              className={cn("mt-[1.5%] font-poster leading-[1.05] [text-wrap:balance] @max-[160px]:mt-0", compact)}
              style={{ fontSize: size, color: ink.title, textShadow: lettering(ink.shade, false) }}
            >
              {name}
            </p>
          </div>
        )}

        {layout === "headline" && (
          <>
            <p
              className={cn(
                "absolute inset-x-[4%] top-[8%] -rotate-3 text-center font-poster leading-[0.98] [text-wrap:balance]",
                "@max-[160px]:inset-x-0 @max-[160px]:top-0 @max-[160px]:px-[4%] @max-[160px]:py-[3%]",
                compact,
              )}
              style={{ fontSize: size, color: ink.title, textShadow: lettering(ink.shade) }}
            >
              {name}
            </p>
          </>
        )}

        {layout === "framed" && (
          <p
            className={cn(
              "absolute inset-x-[5%] bottom-[10%] rotate-[-2.5deg] px-[3%] py-[2%] text-center font-poster leading-[1] [text-wrap:balance] shadow-[0.8cqw_1cqw_0_#1d2321]",
              "@max-[160px]:inset-x-0 @max-[160px]:bottom-0 @max-[160px]:shadow-none",
              compact,
            )}
            style={{ fontSize: size, backgroundColor: ink.slab, color: ink.slab === "#f6e7c4" ? "#d7402a" : ink.title === ink.slab ? "#f6e7c4" : ink.title, textShadow: lettering(ink.shade, false) }}
          >
            {name}
          </p>
        )}

        {/* Billing in the lower margin, typeset in the style of the period. */}
        <p
          aria-hidden
          className="absolute inset-x-0 bottom-0 bg-[#f3e6c8] px-[5%] pb-[2%] pt-[1.8%] text-center text-[3cqw] font-extrabold leading-tight text-[#1d2321] @max-[160px]:hidden"
        >
          {credits[1]}
        </p>
      </div>

      {/* Age, kept light on covers people pick from: one crease, grain, a foxing spot, sun-browned edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: `linear-gradient(${index % 2 ? 90 : 0}deg, transparent ${42 + (index % 5) * 3}%, rgb(0 0 0 / 0.14) ${42.4 + (index % 5) * 3}%, rgb(255 255 255 / 0.12) ${43 + (index % 5) * 3}%, transparent ${43.5 + (index % 5) * 3}%), radial-gradient(circle at ${20 + ((index * 29) % 60)}% ${70 + ((index * 13) % 20)}%, rgb(140 90 30 / 0.14) 0 1.6%, transparent 2.6%), var(--grain)`,
          backgroundSize: "100% 100%, 100% 100%, 160px 160px",
          boxShadow: "inset 0 0 6cqw rgb(120 80 30 / 0.28)",
        }}
      />
    </div>
  );
}
