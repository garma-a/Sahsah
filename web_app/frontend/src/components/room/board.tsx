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
 * Six category cards in two rows of three that fill the whole board on every screen. At most one card is held flipped
 * at a time; hovering flips a card as well. The cards are dealt in one after another when the board appears. The board is drawn only from the server's projection.
 */
export default function Board({ view, categories, canOpen, pending, onOpen }: BoardProps) {
  const [open, setOpen] = useState<number | null>(null);
  const columns = [...view.board].sort((a, b) => a.boardPosition - b.boardPosition);
  return (
    <section
      aria-label="لوحة الأسئلة"
      className="paper-card flex min-h-0 flex-1 flex-col rounded-[1.6rem] border-4 border-ink p-3 shadow-[0_10px_0_var(--color-ink)] sm:p-4 lg:p-5 short:rounded-2xl short:p-2 short:shadow-[0_6px_0_var(--color-ink)]"
    >
      <ol className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3 lg:gap-5 short:gap-2">
        {columns.map((column, i) => (
          <li key={column.boardPosition} className="relative min-h-0 min-w-0">
            <CategoryCard
              column={column}
              order={i}
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
