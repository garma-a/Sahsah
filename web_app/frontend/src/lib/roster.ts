import type { Id, Member, TeamPlayer } from "@/lib/api/types";

export type RosterEntry = Pick<Member, "id" | "displayName" | "teamNumber">;

// Game and result views list each team's players. An API that predates that field sends none, so the roster
// seen in the lobby is kept per room as a fallback (see `teamPlayers`). A browser that first opens a room
// mid-game has no fallback.
const key = (roomId: Id) => `sahsah.roster.${roomId}`;

export function saveRoster(roomId: Id, members: Member[]): void {
  try {
    const roster: RosterEntry[] = members
      .filter((m) => !m.host)
      .map(({ id, displayName, teamNumber }) => ({ id, displayName, teamNumber }));
    localStorage.setItem(key(roomId), JSON.stringify(roster));
  } catch {
    // Storage can be blocked; the board then simply omits player names.
  }
}

/** Dropped with the room's other proofs, so nothing about a finished room lingers in this browser. */
export function clearRoster(roomId: Id): void {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // Nothing to clean when storage is blocked.
  }
}

export function loadRoster(roomId: Id): RosterEntry[] {
  try {
    const raw = localStorage.getItem(key(roomId));
    return raw ? (JSON.parse(raw) as RosterEntry[]) : [];
  } catch {
    return [];
  }
}

/** A team's players as the view lists them; only when the view has no list (an older API) the lobby roster stands in. */
export function teamPlayers(team: { number: number; players?: TeamPlayer[] }, roster: RosterEntry[]): { id: Id; displayName: string }[] {
  if (team.players) return team.players.map((p) => ({ id: p.membershipId, displayName: p.displayName }));
  return roster.filter((m) => m.teamNumber === team.number).map(({ id, displayName }) => ({ id, displayName }));
}
