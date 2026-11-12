"use client";

import { useEffect, useState } from "react";
import type { Timer } from "@/lib/api/types";

export const ANSWER_MS = 60000;

/**
 * Milliseconds left on the answering timer. Expiry sends no push: a running timer is counted down here
 * from the server's deadline, corrected by the offset between the server clock and this device's clock.
 * Any other state shows the server's own remainder.
 */
export function useRemainingMs(timer: Timer, clockOffsetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const running = timer.state === "running";
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [running]);
  if (timer.state !== "running") return timer.remainingMs;
  return Math.min(ANSWER_MS, Math.max(0, Date.parse(timer.deadlineAt) - (now + clockOffsetMs)));
}
