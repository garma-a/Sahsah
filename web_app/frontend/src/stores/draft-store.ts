import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Id } from "@/lib/api/types";

export const BOARD_SIZE = 6;
export const DEFAULT_TEAM_NAMES: [string, string] = ["الفريق الأول", "الفريق التاني"];

/** A room creation saved before sending: a refresh retries the same intent and the same control secret. */
export type PendingCreate = { operationId: string; controlSecret: string; signature: string };

type DraftState = {
  hydrated: boolean;
  /** Category ids in the order the host picked them: the board position. */
  selected: Id[];
  teamNames: [string, string];
  pendingCreate: PendingCreate | null;
};
type DraftActions = {
  toggleCategory: (id: Id) => "added" | "removed" | "full";
  removeCategory: (id: Id) => void;
  setTeamName: (index: 0 | 1, name: string) => void;
  setPendingCreate: (pending: PendingCreate | null) => void;
  clear: () => void;
};
export type DraftStore = DraftState & DraftActions;

export const createDraftStore = () =>
  createStore<DraftStore>()(
    persist(
      (set, get) => ({
        hydrated: false,
        selected: [],
        teamNames: DEFAULT_TEAM_NAMES,
        pendingCreate: null,
        toggleCategory: (id) => {
          const { selected } = get();
          if (selected.includes(id)) {
            set({ selected: selected.filter((item) => item !== id) });
            return "removed";
          }
          if (selected.length >= BOARD_SIZE) return "full";
          set({ selected: [...selected, id] });
          return "added";
        },
        removeCategory: (id) => set((s) => ({ selected: s.selected.filter((item) => item !== id) })),
        setTeamName: (index, name) =>
          set((s) => {
            const teamNames: [string, string] = [...s.teamNames];
            teamNames[index] = name;
            return { teamNames };
          }),
        setPendingCreate: (pendingCreate) => set({ pendingCreate }),
        clear: () => set({ selected: [], teamNames: DEFAULT_TEAM_NAMES, pendingCreate: null }),
      }),
      {
        name: "sahsah.draft.v1",
        skipHydration: true,
        storage: createJSONStorage(() => sessionStorage),
        partialize: ({ selected, teamNames, pendingCreate }) => ({ selected, teamNames, pendingCreate }),
      },
    ),
  );
