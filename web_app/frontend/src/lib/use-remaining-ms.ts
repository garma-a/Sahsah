"use client";

import { useEffect, useState } from "react";
import type { Timer } from "@/lib/api/types";

export const ANSWER_MS = 60000;

const TICK_MS = 200;

/**
 * Milliseconds left on the answering timer. Expiry sends no push: a running timer is counted down here
 * from the server's deadline, corrected by the offset between the server clock and this device's clock.
 * Any other state shows the server's own remainder. Call it in the component that draws the clock, so
 * only that component re-renders on every tick.
 */
export function useRemainingMs(timer: Timer, clockOffsetMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  const deadlineAt = timer.state === "running" ? timer.deadlineAt : undefined;
  const [seenDeadline, setSeenDeadline] = useState(deadlineAt);

  // The render where the timer starts running (or gets a new deadline) reads the clock at once, so a resume
  // or a restart never shows a stale time for a tick.
  if (deadlineAt !== seenDeadline) {
    setSeenDeadline(deadlineAt);
    // eslint-disable-next-line react-hooks/purity -- the one clock read on the switch to a new deadline, kept out of the effect on purpose
    if (deadlineAt) setNow(Date.now());
  }

  useEffect(() => {
    if (!deadlineAt) return;
    const deadline = Date.parse(deadlineAt);
    const tick = () => {
      const current = Date.now();
      setNow(current);
      // Nothing changes after zero: stop the interval instead of re-rendering for nothing.
      if (deadline - (current + clockOffsetMs) <= 0) clearInterval(interval);
    };
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [deadlineAt, clockOffsetMs]);

  if (timer.state !== "running") return timer.remainingMs;
  return Math.min(ANSWER_MS, Math.max(0, Date.parse(timer.deadlineAt) - (now + clockOffsetMs)));
}
