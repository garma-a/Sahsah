import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The signature control: a chunky, fully rounded orange-red button with a cyan ring.
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-heading leading-none transition-[transform,box-shadow,background-color] duration-150 disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55",
  {
    variants: {
      variant: {
        default:
          "bg-press text-white ring-4 ring-cyan shadow-chunk hover:bg-[#e2431f] active:translate-y-[3px] active:shadow-[0_2px_0_var(--color-press-deep)]",
        cyan: "bg-cyan text-ink ring-4 ring-ink hover:brightness-105 active:translate-y-px",
        outline:
          "border-[3px] border-ink bg-cream text-ink hover:bg-sun active:translate-y-px",
        dark: "bg-ink text-cream ring-2 ring-cyan/70 hover:bg-charcoal active:translate-y-px",
        ghost: "text-ink hover:bg-ink/10",
        link: "rounded-md text-ink underline decoration-2 underline-offset-4 hover:decoration-press",
      },
      size: {
        default: "h-12 px-7 text-xl",
        sm: "h-10 px-5 text-lg",
        lg: "h-14 px-10 text-2xl",
        xl: "h-16 px-14 text-3xl",
        icon: "size-11 text-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export default function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
