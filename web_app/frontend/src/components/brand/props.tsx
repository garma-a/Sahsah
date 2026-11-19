import { cn } from "@/lib/utils";

export type PropName =
  | "matchbox" | "cards" | "tea" | "cassette" | "reel" | "radio"
  | "seeds" | "tickets" | "fez" | "dice" | "phone" | "glasses";

type PropProps = { name: PropName; className?: string; style?: React.CSSProperties };

/**
 * A photographed still-life object (matchbox, tea glass, cassette...), cut out on transparency and lit from
 * the upper left like all the others, with a soft contact shadow. Decorative only.
 */
export default function Prop({ name, className, style }: PropProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static decorative cutout
    <img
      src={`/cinema/props/${name}.webp`}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      decoding="async"
      className={cn("pointer-events-none select-none drop-shadow-[0_10px_9px_rgb(30_18_10/0.45)]", className)}
      style={style}
    />
  );
}
