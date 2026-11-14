"use client";

import Image from "next/image";

// Hand-set turns and offsets so the wall looks pasted by hand yet renders identically on every load.
const turns = [-4, 3, -2, 5, -6, 2, 4, -3, 6, -5, 1, -1];
const lifts = [0, 14, -10, 8, -14, 12, -6, 16, -12, 4, 10, -8];

/**
 * The poster wall behind the board, assembled from the category covers the API returns: tilted, tinted and
 * darkened so the cream board stays the brightest thing on screen. Pure CSS, no extra artwork.
 */
export default function PosterWall({ covers }: { covers: string[] }) {
  const tiles = covers.length ? Array.from({ length: 40 }, (_, i) => covers[i % covers.length]) : [];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night">
      {tiles.length > 0 && (
        <ul className="absolute -inset-10 grid grid-cols-4 content-start gap-x-3 gap-y-4 opacity-70 sm:grid-cols-6 lg:grid-cols-8">
          {tiles.map((src, i) => (
            <li
              key={i}
              className="relative aspect-[4/5] border-[6px] border-[#efe2c4] bg-[#efe2c4] shadow-[0_10px_24px_rgb(0_0_0/0.5)]"
              style={{ transform: `translateY(${lifts[i % lifts.length]}px) rotate(${turns[i % turns.length]}deg)` }}
            >
              <Image src={src} alt="" fill sizes="14vw" unoptimized className="object-cover sepia-[0.35] saturate-[0.8]" />
            </li>
          ))}
        </ul>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(14_20_18/0.45)_0%,rgb(14_20_18/0.86)_100%)]" />
      <div className="grain-dark absolute inset-0 opacity-60" />
    </div>
  );
}
