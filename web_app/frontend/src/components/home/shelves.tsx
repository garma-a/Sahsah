"use client";

import { useMemo } from "react";
import Button from "@/components/ui/button";
import Poster from "@/components/home/poster";
import { RowEnds } from "@/components/home/shelf-decor";
import type { ApiError } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { toShelves, type CategoriesState } from "@/lib/use-categories";
import { cn } from "@/lib/utils";
import { BOARD_SIZE } from "@/stores/draft-store";

// Rows are centred flex lines whose items share one width per breakpoint (--cols), so a section of four
// fills or centres its row and never leaves an empty slot, and an odd last row is centred too.
// The row-end collages (shelf-decor.tsx) size themselves from the same variables, set on the wrapper.
const grid = "relative [--cols:2] [--gap:1.5rem] sm:[--cols:3] md:[--cols:4] lg:[--cols:5] lg:[--gap:2rem]";
const list = "flex flex-wrap justify-center gap-x-[var(--gap)] gap-y-14";
const item = "w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]";

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
      <p className="rounded-2xl border-[3px] border-dashed border-cream/40 p-8 text-center text-lg font-medium text-cream">
        مفيش فئات متاحة دلوقتي. جرّب تفتح الصفحة تاني بعد شوية.
      </p>
    );
  }

  return (
    <div className="space-y-14">
      {shelves.map((shelf, shelfIndex) => (
        <section key={shelf.id} aria-labelledby={`shelf-${shelf.id}`}>
          {/* The section name on a backlit marquee board ringed with bulbs. */}
          <div className="mb-12 flex justify-center">
            <div className="rounded-lg bg-[#1a0f08] bg-[radial-gradient(circle,#ffe9a8_0_2.5px,transparent_3.5px)] bg-[length:18px_18px] bg-[position:9px_9px] p-[13px] shadow-[0_0_0_2px_#c39a45,0_0_0_5px_#1a0f08,0_0_0_7px_#8a6424,0_16px_30px_rgb(0_0_0/0.65),0_0_40px_rgb(255_200_110/0.25)]">
              <h2
                id={`shelf-${shelf.id}`}
                className="rounded-[3px] bg-[#120a05] px-8 pb-2 pt-1 text-center font-poster text-4xl leading-tight text-[#fde8b0] shadow-[0_0_0_1px_#8a6424] [text-shadow:0_0_14px_rgb(255_190_90/0.75),2px_2px_0_#6e1414] sm:px-12 sm:text-5xl"
              >
                {shelf.name}
              </h2>
            </div>
          </div>
          <div className={grid}>
            <RowEnds count={shelf.categories.length} variant={shelfIndex} />
            <ul className={list}>
              {shelf.categories.map((category, index) => (
                <li key={category.id} className={item}>
                  <Poster
                    category={category}
                    toneIndex={toneOf.get(category.id) ?? index}
                    selected={selected.includes(category.id)}
                    full={selected.length >= BOARD_SIZE}
                    eager={shelfIndex === 0 && index < 4}
                    onToggle={onToggle}
                  />
                </li>
              ))}
            </ul>
          </div>
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
          <div className="mx-auto mb-12 h-16 w-64 rounded-lg bg-black/30" />
          <div className={cn(grid, list)}>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className={`${item} aspect-[4/5] rounded-[3px] border-[5px] border-[#8a6424]/40 bg-black/25`} />
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
