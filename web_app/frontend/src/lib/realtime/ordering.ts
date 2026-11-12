import type { Snapshot, Source } from "@/lib/api/types";

function isGame(source: Source): source is Extract<Source, { gameId: string }> {
  return "gameId" in source;
}

/**
 * True when `incoming` describes an older server state than `current`.
 * Revisions are decimal strings (bigint on the server), so they are compared exactly. A late HTTP answer or
 * a duplicate frame must never overwrite newer state; an equal vector is accepted as an idempotent refresh.
 */
export function isStale(current: Snapshot | null, incoming: Source): boolean {
  if (!current) return false;
  const have = current.source;
  const room = BigInt(incoming.roomVersion) - BigInt(have.roomVersion);
  if (room !== BigInt(0)) return room < BigInt(0);
  if (isGame(have) && isGame(incoming) && have.gameId === incoming.gameId) {
    const game = BigInt(incoming.gameVersion) - BigInt(have.gameVersion);
    if (game !== BigInt(0)) return game < BigInt(0);
    return BigInt(incoming.gameProjectionVersion) < BigInt(have.gameProjectionVersion);
  }
  // Same room version: a game replaces its lobby, but a lobby never replaces a game it already passed.
  return isGame(have) && !isGame(incoming);
}
