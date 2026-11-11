export function scoreChange(before: bigint, after: bigint) {
  return { before, after, delta: after - before };
}
export function questionAward(winner: number | null, requested: number | undefined, suggested: number) {
  return winner === null ? 0 : requested === undefined ? suggested : requested;
}
