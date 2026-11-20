import { isIPv4, isIPv6 } from "node:net";
import { GameplayProblem } from "./problem.js";

/**
 * Process-local bounded token buckets; keys contain verified subjects or source addresses.
 * Least recently used keys are evicted first, so a busy key cannot reset itself by flooding new ones.
 */
export class GameplayRates {
  private buckets = new Map<string, { tokens: number; at: number }>();
  take(key: string, rate: number, burst: number) {
    const now = Date.now(),
      old = this.buckets.get(key),
      tokens = old
        ? Math.min(burst, old.tokens + ((now - old.at) * rate) / 1000)
        : burst;
    if (old) this.buckets.delete(key);
    else if (this.buckets.size >= 8192)
      this.buckets.delete(this.buckets.keys().next().value!);
    this.buckets.set(key, { tokens: Math.max(0, tokens - 1), at: now });
    if (tokens < 1) throw new GameplayProblem(429, "RATE_LIMITED");
  }
}

/**
 * The key one client is limited by. IPv4 is one address; IPv6 is its /64, because one home or
 * phone is routinely handed a whole /64 and could otherwise rotate addresses past every limit.
 */
export function sourceKey(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return mapped[1]!;
  if (isIPv4(address) || !isIPv6(address)) return address;
  const [head = "", tail = ""] = address.toLowerCase().split("::");
  const left = head ? head.split(":") : [],
    right = address.includes("::") && tail ? tail.split(":") : [];
  const groups = [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
