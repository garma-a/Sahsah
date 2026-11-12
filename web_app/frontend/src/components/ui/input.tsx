import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export default function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-14 w-full rounded-2xl border-[3px] border-ink bg-white px-4 text-lg font-medium text-ink shadow-[0_3px_0_var(--color-ink)] transition-colors placeholder:text-charcoal/55 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-[#b3261e]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
