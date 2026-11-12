"use client";

import Image from "next/image";
import { useState } from "react";
import Logo from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type CoverProps = {
  src?: string;
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * A category cover in a fixed poster frame. Covers arrive as portrait posters or near-squares, so the
 * frame is always 4:5 with object-fit: cover: shelves and board columns stay aligned and nothing shifts
 * while an image loads. Missing or broken artwork falls back to a printed placeholder with the name.
 */
export default function Cover({ src, name, className, sizes = "(min-width: 1024px) 220px, 33vw", priority }: CoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  return (
    <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-charcoal", className)}>
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal p-3 text-center text-cream">
          <Logo variant="mono" className="w-1/3 text-sun" />
          <span className="font-heading text-xl leading-tight">{name}</span>
        </div>
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          unoptimized
          priority={priority}
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="object-cover"
        />
      )}
    </div>
  );
}
