import { formatDigits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The three hint stages of a blur or zoom picture, each with the points it is worth: the picture gets
 * clearer and the award smaller. The current stage is filled; stages already passed are crossed out.
 */
export default function HintStages({ stageIndex, suggestions }: { stageIndex: number; suggestions: number[] }) {
  return (
    <ol aria-label="مراحل التلميح" className="flex flex-wrap items-center justify-center gap-3">
      {suggestions.map((points, index) => {
        const current = index === stageIndex;
        const passed = index < stageIndex;
        return (
          <li
            key={index}
            aria-current={current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full border-[3px] border-ink px-4 py-1 font-heading text-2xl leading-tight",
              current ? "bg-sun shadow-[0_4px_0_var(--color-ink)]" : passed ? "border-dashed bg-transparent text-charcoal/55 line-through decoration-2" : "bg-white",
            )}
          >
            <span className="grid size-7 place-items-center rounded-full bg-ink font-sans text-sm font-extrabold text-cream">{formatDigits(index + 1)}</span>
            <span className="tabular">{formatNumber(points)}</span>
            <span className="sr-only">{current ? "المرحلة الحالية" : passed ? "عدّت" : "لسه"}</span>
          </li>
        );
      })}
    </ol>
  );
}
