"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type MediaImageProps = {
  /** Signed URL from `useMediaLinks`; undefined while the link is being issued. */
  url?: string;
  alt: string;
  /** Links could not be issued. */
  failed?: boolean;
  onRetry?: () => void;
  className?: string;
};

/**
 * A question or answer picture in a paper frame. The link is short-lived and signed, so an image that
 * fails to load asks for a fresh link instead of showing a broken picture.
 */
export default function MediaImage({ url: latest, alt, failed, onRetry, className }: MediaImageProps) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  // A hint stage swaps the picture: keep showing the previous one until the next link arrives.
  const [url, setUrl] = useState(latest);
  if (latest && latest !== url) setUrl(latest);
  const broken = failed || (url !== undefined && brokenUrl === url);
  return (
    <figure className={cn("relative rounded-2xl border-4 border-ink bg-white p-2 shadow-[0_8px_0_var(--color-ink)]", className)}>
      {broken ? (
        <div className="grid aspect-[4/3] w-full place-items-center gap-2 rounded-lg bg-charcoal/10 p-4 text-center">
          <ImageOff aria-hidden className="size-10 text-charcoal/60" />
          <p className="text-base font-semibold">الصورة مش راضية تظهر</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="rounded-full border-[3px] border-ink bg-cream px-4 py-1 font-heading text-lg hover:bg-sun">
              جرّب تاني
            </button>
          )}
        </div>
      ) : url ? (
        // A short-lived signed URL of unknown size: next/image has nothing to optimise or cache here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} draggable={false} onError={() => setBrokenUrl(url)} className="max-h-[46vh] w-full rounded-lg object-contain" />
      ) : (
        <div role="status" aria-label="بنحمّل الصورة" className="aspect-[4/3] w-full animate-pulse rounded-lg bg-charcoal/10" />
      )}
    </figure>
  );
}
