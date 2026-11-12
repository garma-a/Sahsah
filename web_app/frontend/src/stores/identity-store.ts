import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Id, PreviewSession, TeamNumber } from "@/lib/api/types";
import { clearRoster } from "@/lib/roster";

/** localStorage key of the persisted identity; other tabs watch it (see the provider). */
export const IDENTITY_STORAGE_KEY = "sahsah.identity.v1";

export type HostIdentity = Pick<PreviewSession, "credential" | "expiresAt" | "accountId" | "displayName">;
/** What this browser needs to keep running a room it created. */
export type HostRoom = { controlSecret: string; generation: string };
/** A takeover saved before sending: key, new secret and the generation it replaces, so a retry is identical. */
export type PendingTakeover = { roomId: Id; operationId: string; controlSecret: string; expectedGeneration: string };
/** A guest's private seat proof, with the invitation code it was joined by. It lives only in this browser. */
export type GuestSeat = { code: string; membershipId: Id; secret: string; displayName: string };
/** A join saved before sending, so a lost response retries the same seat. */
export type PendingJoin = {
  code: string;
  operationId: string;
  secret: string;
  displayName: string;
  teamNumber: TeamNumber;
};

type IdentityState = {
  hydrated: boolean;
  host: HostIdentity | null;
  hostRooms: Record<Id, HostRoom>;
  guestSeats: Record<Id, GuestSeat>;
  guestName: string;
  pendingJoin: PendingJoin | null;
  pendingTakeover: PendingTakeover | null;
};
type IdentityActions = {
  setPendingTakeover: (pending: PendingTakeover | null) => void;
  setHost: (host: HostIdentity | null) => void;
  setHostRoom: (roomId: Id, room: HostRoom) => void;
  forgetRoom: (roomId: Id) => void;
  setGuestSeat: (roomId: Id, seat: GuestSeat) => void;
  setGuestName: (name: string) => void;
  setPendingJoin: (pending: PendingJoin | null) => void;
};
export type IdentityStore = IdentityState & IdentityActions;

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

// Identity is kept per browser and never reaches the server except as the proofs the API asks for.
// Persistence is rehydrated after mount so the server render and the first client render agree.
export const createIdentityStore = () =>
  createStore<IdentityStore>()(
    persist(
      (set) => ({
        hydrated: false,
        host: null,
        hostRooms: {},
        guestSeats: {},
        guestName: "",
        pendingJoin: null,
        pendingTakeover: null,
        setPendingTakeover: (pendingTakeover) => set({ pendingTakeover }),
        setHost: (host) => set({ host }),
        setHostRoom: (roomId, room) => set((s) => ({ hostRooms: { ...s.hostRooms, [roomId]: room } })),
        forgetRoom: (roomId) => {
          clearRoster(roomId);
          set((s) => ({ hostRooms: without(s.hostRooms, roomId), guestSeats: without(s.guestSeats, roomId) }));
        },
        setGuestSeat: (roomId, seat) =>
          set((s) => ({ guestSeats: { ...s.guestSeats, [roomId]: seat }, guestName: seat.displayName })),
        setGuestName: (guestName) => set({ guestName }),
        setPendingJoin: (pendingJoin) => set({ pendingJoin }),
      }),
      {
        name: IDENTITY_STORAGE_KEY,
        skipHydration: true,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ host, hostRooms, guestSeats, guestName, pendingJoin, pendingTakeover }) => ({
          host,
          hostRooms,
          guestSeats,
          guestName,
          pendingJoin,
          pendingTakeover,
        }),
      },
    ),
  );
