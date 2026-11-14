import Image from "next/image";
import { cn } from "@/lib/utils";

// Vector files live in /public/brand. Retro and pink are full-colour image files;
// mono is painted with currentColor through a CSS mask so it follows the text colour.
const sources = {
  retro: { src: "/brand/logo-retro.svg", width: 2332, height: 2452 },
  pink: { src: "/brand/logo-pink.svg", width: 2332, height: 2452 },
  mono: { src: "/brand/logo-mono.svg", width: 2060, height: 2180 },
} as const;

type LogoProps = { variant?: keyof typeof sources; className?: string; eager?: boolean; title?: string };

export default function Logo({ variant = "retro", className, eager = false, title = "صحصح" }: LogoProps) {
  const { src, width, height } = sources[variant];
  if (variant === "mono") {
    return (
      <span
        role="img"
        aria-label={title}
        className={cn("inline-block bg-current", className)}
        style={{
          aspectRatio: `${width} / ${height}`,
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }
  return <Image src={src} width={width} height={height} alt={title} loading={eager ? "eager" : undefined} fetchPriority={eager ? "high" : undefined} unoptimized className={cn("h-auto", className)} />;
}
