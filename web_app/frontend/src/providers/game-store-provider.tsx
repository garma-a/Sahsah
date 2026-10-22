"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createGameStore, type GameStore } from "@/stores/game-store";

const GameStoreContext = createContext<ReturnType<typeof createGameStore> | null>(null);

export default function GameStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createGameStore);
  return <GameStoreContext.Provider value={store}>{children}</GameStoreContext.Provider>;
}

export function useGameStore<T>(selector: (state: GameStore) => T): T {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error("useGameStore requires GameStoreProvider");
  return useStore(store, selector);
}
