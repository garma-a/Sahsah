import { formatDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A count in a framed chip, so Arabic zero reads as a number and not as a stray dot. */
export default function NumberChip({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular inline-grid min-w-[1.9em] place-items-center rounded-lg border-[3px] border-ink bg-cream px-1.5 font-heading text-[1.6em] leading-[1.25] text-ink",
        className,
      )}
    >
      {formatDigits(value)}
    </span>
  );
}
