"use client";

import { useCallback, useEffect, useState } from "react";
import { listCategories } from "@/lib/api/endpoints";
import { asApiError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";

export type CategoriesState =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "ready"; categories: Category[] };

/** The public catalog: loads once, and can be retried after a failure. */
export function useCategories(): { state: CategoriesState; retry: () => void } {
  const [state, setState] = useState<CategoriesState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listCategories(controller.signal)
      .then((categories) => setState({ status: "ready", categories }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", error: asApiError(error) });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}

export type Shelf = { id: string; name: string; categories: Category[] };

/** Groups categories into the API's sections, in section order; unsectioned ones go last. */
export function toShelves(categories: Category[]): Shelf[] {
  const map = new Map<string, { order: number; shelf: Shelf }>();
  for (const category of categories) {
    const section = category.section;
    const id = section?.id ?? "other";
    const entry = map.get(id) ?? {
      order: section?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      shelf: { id, name: section?.name ?? "فئات تانية", categories: [] },
    };
    entry.shelf.categories.push(category);
    map.set(id, entry);
  }
  return [...map.values()].sort((a, b) => a.order - b.order).map((entry) => entry.shelf);
}
