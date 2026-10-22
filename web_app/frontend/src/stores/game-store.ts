import { createStore } from "zustand/vanilla";

type GameState = { teams: [string, string] };
type GameActions = {
  setTeamName: (index: 0 | 1, name: string) => void;
  reset: () => void;
};
export type GameStore = GameState & GameActions;

const initialState = (): GameState => ({ teams: ["الفريق الأول", "الفريق الثاني"] });

// One store per provider keeps server requests and browser sessions independent.
export const createGameStore = () => createStore<GameStore>()((set) => ({
  ...initialState(),
  setTeamName: (index, name) => set((state) => {
    const teams: [string, string] = [...state.teams];
    teams[index] = name;
    return { teams };
  }),
  reset: () => set(initialState()),
}));
