"use client";

import { useState } from "react";
import CategoryCard from "@/components/room/category-card";
import type { BoardView, Category } from "@/lib/api/types";

type BoardProps = {
  view: BoardView;
  categories: ReadonlyMap<string, { category: Category; index: number }>;
  /** The host can open tiles; everyone else sees the same board and can flip cards to look. */
  canOpen: boolean;
  /** "boardPosition:questionPosition" of a command in flight. */
  pending: string | null;
  onOpen: (boardPosition: number, questionPosition: number) => void;
};

/**
 * Six category cards: one row on a laptop or TV, two per row on a phone. At most one card is held flipped
 * at a time; hovering flips a card as well. The board is drawn only from the server's projection.
 */
export default function Board({ view, categories, canOpen, pending, onOpen }: BoardProps) {
  const [open, setOpen] = useState<number | null>(null);
  const columns = [...view.board].sort((a, b) => a.boardPosition - b.boardPosition);
  return (
    <section
      aria-label="لوحة الأسئلة"
      className="paper-card rounded-[1.6rem] border-4 border-ink p-3 shadow-[0_10px_0_var(--color-ink)] sm:p-4 lg:p-5"
    >
      <ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4">
        {columns.map((column, i) => (
          <li key={column.boardPosition}>
            <CategoryCard
              column={column}
              entry={categories.get(column.categoryId)}
              toneIndex={categories.get(column.categoryId)?.index ?? i}
              flipped={open === column.boardPosition}
              onFlip={(flipped) => setOpen(flipped ? column.boardPosition : null)}
              canOpen={canOpen}
              pending={pending}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
