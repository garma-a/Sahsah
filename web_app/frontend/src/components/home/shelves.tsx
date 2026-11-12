"use client";

import { useMemo } from "react";
import Button from "@/components/ui/button";
import Poster from "@/components/home/poster";
import { toneAt } from "@/components/brand/tones";
import type { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { toShelves, type CategoriesState } from "@/lib/use-categories";
import { BOARD_SIZE } from "@/stores/draft-store";

const grid = "grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-8";

type ShelvesProps = {
  state: CategoriesState;
  selected: string[];
  onToggle: (category: Category) => void;
  onRetry: () => void;
};

export default function Shelves({ state, selected, onToggle, onRetry }: ShelvesProps) {
  const categories = state.status === "ready" ? state.categories : null;
  const shelves = useMemo(() => (categories ? toShelves(categories) : []), [categories]);
  const toneOf = useMemo(() => new Map((categories ?? []).map((c, i) => [c.id, i])), [categories]);

  if (state.status === "loading") return <ShelfSkeleton />;
  if (state.status === "error") return <ShelfError error={state.error} onRetry={onRetry} />;
  if (!shelves.length) {
    return (
      <p className="rounded-2xl border-[3px] border-dashed border-ink/40 p-8 text-center text-lg font-medium">
        مفيش فئات متاحة دلوقتي. جرّب تفتح الصفحة تاني بعد شوية.
      </p>
    );
  }

  return (
    <div className="space-y-14">
      {shelves.map((shelf, shelfIndex) => (
        <section key={shelf.id} aria-labelledby={`shelf-${shelf.id}`}>
          <h2 id={`shelf-${shelf.id}`} className="font-heading text-4xl leading-tight sm:text-5xl">
            {shelf.name}
          </h2>
          <div aria-hidden className={`mt-2 mb-9 h-[3px] w-full ${toneAt(shelfIndex).rule}`} />
          <ul className={grid}>
            {shelf.categories.map((category, index) => (
              <li key={category.id}>
                <Poster
                  category={category}
                  toneIndex={toneOf.get(category.id) ?? index}
                  selected={selected.includes(category.id)}
                  full={selected.length >= BOARD_SIZE}
                  priority={shelfIndex === 0 && index < 4}
                  onToggle={onToggle}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ShelfSkeleton() {
  return (
    <div role="status" aria-label="بنحمّل الفئات" className="space-y-14">
      {[0, 1].map((row) => (
        <div key={row}>
          <div className="h-10 w-48 rounded-md bg-charcoal/15" />
          <div className="mt-2 mb-9 h-[3px] w-full bg-charcoal/15" />
          <div className={grid}>
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="aspect-[4/5] border-[5px] border-charcoal/15 bg-charcoal/10" />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">بنحمّل الفئات…</span>
    </div>
  );
}

function ShelfError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-3xl border-[3px] border-ink bg-white p-8 text-center shadow-[0_6px_0_var(--color-ink)]">
      <p className="font-heading text-3xl">الفئات مش راضية تفتح</p>
      <p className="mt-3 text-lg">{error.message}</p>
      <Button onClick={onRetry} className="mt-6">
        جرّب تاني
      </Button>
    </div>
  );
}
