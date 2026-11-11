import { sql } from "drizzle-orm";
import { single } from "./invariant.js";
import type { Tx } from "./types.js";
export async function freshTime(db: Tx): Promise<Date> {
  // Drizzle 0.45 requires FROM for select(); keep the single wall-clock read here.
  const result = await db.execute<{ now: Date }>(
    sql<{ now: Date }>`SELECT clock_timestamp() AS now`,
  );
  return new Date(single(result.rows, "CLOCK_SINGLE_ROW").now);
}
export const iso = (value: string | Date) => new Date(value).toISOString();
export const plusDay = (now: Date) =>
  new Date(now.getTime() + 86400000).toISOString();
