"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createDraftStore, type DraftStore } from "@/stores/draft-store";
import { createIdentityStore, type IdentityStore } from "@/stores/identity-store";

type Stores = { identity: ReturnType<typeof createIdentityStore>; draft: ReturnType<typeof createDraftStore> };
const StoresContext = createContext<Stores | null>(null);

// One pair of stores per provider keeps server requests and browser sessions independent.
// Both persist to the browser, so they are rehydrated after mount and flagged `hydrated`.
export default function GameStoreProvider({ children }: { children: ReactNode }) {
  const [stores] = useState<Stores>(() => ({ identity: createIdentityStore(), draft: createDraftStore() }));
  useEffect(() => {
    void Promise.resolve(stores.identity.persist.rehydrate()).then(() => stores.identity.setState({ hydrated: true }));
    void Promise.resolve(stores.draft.persist.rehydrate()).then(() => stores.draft.setState({ hydrated: true }));
  }, [stores]);
  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}

function useStores(): Stores {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error("Stores require GameStoreProvider");
  return stores;
}

export function useIdentity<T>(selector: (state: IdentityStore) => T): T {
  return useStore(useStores().identity, selector);
}
export function useDraft<T>(selector: (state: DraftStore) => T): T {
  return useStore(useStores().draft, selector);
}
/** Imperative access for event handlers that must read the latest state, not a render snapshot. */
export function useIdentityApi() {
  return useStores().identity;
}
export function useDraftApi() {
  return useStores().draft;
}
