import type { Id, Member } from "@/lib/api/types";

export type RosterEntry = Pick<Member, "id" | "displayName" | "teamNumber">;

// The game views carry team names and scores but no player list, so the roster seen in the lobby is kept
// per room and shown under each team on the board. A browser that first opens a room mid-game has none.
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

export function loadRoster(roomId: Id): RosterEntry[] {
  try {
    const raw = localStorage.getItem(key(roomId));
    return raw ? (JSON.parse(raw) as RosterEntry[]) : [];
  } catch {
    return [];
  }
}
