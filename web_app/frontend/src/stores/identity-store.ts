import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Id, PreviewSession, TeamNumber } from "@/lib/api/types";

export type HostIdentity = Pick<PreviewSession, "credential" | "expiresAt" | "accountId" | "displayName">;
/** What this browser needs to keep running a room it created. */
export type HostRoom = { controlSecret: string; generation: string; membershipId: Id };
/** A guest's private seat proof. It lives only in this browser. */
export type GuestSeat = { membershipId: Id; secret: string; displayName: string };
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
};
type IdentityActions = {
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
        setHost: (host) => set({ host }),
        setHostRoom: (roomId, room) => set((s) => ({ hostRooms: { ...s.hostRooms, [roomId]: room } })),
        forgetRoom: (roomId) =>
          set((s) => ({ hostRooms: without(s.hostRooms, roomId), guestSeats: without(s.guestSeats, roomId) })),
        setGuestSeat: (roomId, seat) =>
          set((s) => ({ guestSeats: { ...s.guestSeats, [roomId]: seat }, guestName: seat.displayName })),
        setGuestName: (guestName) => set({ guestName }),
        setPendingJoin: (pendingJoin) => set({ pendingJoin }),
      }),
      {
        name: "sahsah.identity.v1",
        skipHydration: true,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ host, hostRooms, guestSeats, guestName, pendingJoin }) => ({
          host,
          hostRooms,
          guestSeats,
          guestName,
          pendingJoin,
        }),
      },
    ),
  );
