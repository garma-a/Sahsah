"use client";

import { useRef } from "react";

/**
 * Keyboard behaviour of a radio group built from buttons: one stop in the tab order (the selected radio, or
 * the first when nothing is selected), arrow keys move to the next or previous radio and select it, Home and
 * End jump to the ends. In a right-to-left page the left arrow goes to the next radio, as native radios do.
 */
export function useRadioGroup<T extends string | number>(values: readonly T[], value: T | null, onChange: (next: T) => void) {
  const nodes = useRef(new Map<T, HTMLElement>());

  const move = (from: T, step: number | "first" | "last") => {
    const index = values.indexOf(from);
    const target = step === "first" ? 0 : step === "last" ? values.length - 1 : (index + step + values.length) % values.length;
    const next = values[target];
    onChange(next);
    nodes.current.get(next)?.focus();
  };

  return function item(radio: T) {
    return {
      role: "radio" as const,
      "aria-checked": value === radio,
      tabIndex: value === radio || (value === null && radio === values[0]) ? 0 : -1,
      ref: (node: HTMLElement | null) => {
        if (node) nodes.current.set(radio, node);
        else nodes.current.delete(radio);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const next = rtl ? "ArrowLeft" : "ArrowRight";
        const previous = rtl ? "ArrowRight" : "ArrowLeft";
        if (event.key === "ArrowDown" || event.key === next) move(radio, 1);
        else if (event.key === "ArrowUp" || event.key === previous) move(radio, -1);
        else if (event.key === "Home") move(radio, "first");
        else if (event.key === "End") move(radio, "last");
        else return;
        event.preventDefault();
      },
    };
  };
}
