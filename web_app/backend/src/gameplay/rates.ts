import { GameplayProblem } from "./problem.js";

/** Process-local bounded token buckets; keys contain verified subjects or IPs. */
export class GameplayRates {
  private buckets = new Map<string, { tokens: number; at: number }>();
  take(key: string, rate: number, burst: number) {
    const now = Date.now(),
      old = this.buckets.get(key),
      tokens = old
        ? Math.min(burst, old.tokens + ((now - old.at) * rate) / 1000)
        : burst;
    if (this.buckets.size >= 8192 && !old)
      this.buckets.delete(this.buckets.keys().next().value!);
    this.buckets.set(key, { tokens: Math.max(0, tokens - 1), at: now });
    if (tokens < 1) throw new GameplayProblem(429, "RATE_LIMITED");
  }
}
