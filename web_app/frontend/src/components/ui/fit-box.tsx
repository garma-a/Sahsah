"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FitBoxProps = {
  children: React.ReactNode;
  className?: string;
  /** Classes for the inner column, which is at least as tall as the box so `flex-1` children can fill it. */
  innerClassName?: string;
};

/**
 * Fills the space its parent gives it and never scrolls: when the content is taller than the box, the whole
 * column is scaled down (from the top centre) until it fits. Content that fits is left untouched, so screens
 * laid out for the viewport only shrink on unusually short windows or long questions.
 * Native <dialog>s inside still open in the top layer, unaffected by the scale.
 */
export default function FitBox({ children, className, innerClassName }: FitBoxProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = outer.current;
    const column = inner.current;
    if (!box || !column) return;
    // A transform does not change layout size, so measuring the column never feeds back into itself.
    const measure = () => {
      const room = box.clientHeight;
      const need = column.offsetHeight;
      const next = need > room + 1 && room > 0 ? Math.max(0.4, room / need) : 1;
      setScale((current) => (Math.abs(current - next) < 0.005 ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      <div
        ref={inner}
        className={cn("absolute inset-x-0 top-0 flex min-h-full flex-col", innerClassName)}
        style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "50% 0" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
