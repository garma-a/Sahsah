"use client";

import { Minus } from "lucide-react";
import Cover from "@/components/brand/cover";
import { teamTone, toneAt } from "@/components/brand/tones";
import type { BoardCategory, BoardView, Category, Tile } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type BoardProps = {
  view: BoardView;
  categories: ReadonlyMap<string, { category: Category; index: number }>;
  /** The host can open tiles; everyone else sees the same board without controls. */
  canOpen: boolean;
  /** "boardPosition:questionPosition" of a command in flight. */
  pending: string | null;
  onOpen: (boardPosition: number, questionPosition: number) => void;
};

/**
 * 6 categories x 6 tiles. Each column shows 200 / 400 / 600 above the category cover and a second
 * 200 / 400 / 600 below it, as in the prototype. The board is drawn only from the server's projection.
 */
export default function Board({ view, categories, canOpen, pending, onOpen }: BoardProps) {
  const columns = [...view.board].sort((a, b) => a.boardPosition - b.boardPosition);
  return (
    <section
      aria-label="لوحة الأسئلة"
      className="paper-card rounded-[1.6rem] border-4 border-ink p-3 shadow-[0_10px_0_var(--color-ink)] sm:p-4 lg:p-5"
    >
      <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-4">
        {columns.map((column, i) => (
          <li key={column.boardPosition}>
            <Column
              column={column}
              entry={categories.get(column.categoryId)}
              toneIndex={categories.get(column.categoryId)?.index ?? i}
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

function Column({
  column,
  entry,
  toneIndex,
  canOpen,
  pending,
  onOpen,
}: {
  column: BoardCategory;
  entry?: { category: Category; index: number };
  toneIndex: number;
  canOpen: boolean;
  pending: string | null;
  onOpen: BoardProps["onOpen"];
}) {
  const tone = toneAt(toneIndex);
  const tiles = [...column.tiles].sort((a, b) => a.questionPosition - b.questionPosition);
  const top = tiles.filter((_, index) => index % 2 === 0);
  const bottom = tiles.filter((_, index) => index % 2 === 1);
  const row = (items: Tile[]) => (
    <ul className="grid grid-cols-3 gap-1.5 lg:gap-2">
      {items.map((tile) => (
        <li key={tile.questionPosition}>
          <TileButton
            tile={tile}
            categoryName={column.name}
            fill={tone.tile}
            canOpen={canOpen}
            busy={pending === `${column.boardPosition}:${tile.questionPosition}`}
            disabledByOther={pending !== null}
            onOpen={() => onOpen(column.boardPosition, tile.questionPosition)}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <article aria-label={column.name} className="space-y-2">
      {row(top)}
      <div className={cn("relative border-4 bg-[#fff8ea] shadow-poster", tone.border)}>
        <Cover src={entry?.category.coverUrl} name={column.name} sizes="(min-width: 1024px) 14vw, 45vw" />
        <h3 className={cn("absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-center font-heading text-xl leading-tight sm:text-2xl", tone.ribbon)}>
          {column.name}
        </h3>
      </div>
      {row(bottom)}
    </article>
  );
}

function TileButton({
  tile,
  categoryName,
  fill,
  canOpen,
  busy,
  disabledByOther,
  onOpen,
}: {
  tile: Tile;
  categoryName: string;
  fill: string;
  canOpen: boolean;
  busy: boolean;
  disabledByOther: boolean;
  onOpen: () => void;
}) {
  const points = formatNumber(tile.basePoints);
  const base = "relative flex h-12 w-full items-center justify-center rounded-xl border-[3px] font-heading text-2xl leading-none sm:h-14 lg:text-[1.7rem]";

  if (tile.state === "resolved") {
    const winner = tile.winningTeamNumber ?? null;
    return (
      <div
        role="img"
        aria-label={`${categoryName} ${points}: خلص${winner ? ` وكسبه الفريق ${formatNumber(winner)}` : " من غير فايز"}`}
        className={cn(base, "border-charcoal/25 bg-charcoal/[0.09] text-charcoal/45")}
      >
        <span className="line-through decoration-[3px]">{points}</span>
        {winner ? (
          <span
            aria-hidden
            className={cn("absolute -end-1.5 -top-2 grid size-5 place-items-center rounded-full border-2 border-ink font-sans text-[0.7rem] font-extrabold", teamTone(winner).fill)}
          >
            {formatNumber(winner)}
          </span>
        ) : (
          <Minus aria-hidden className="absolute -end-1.5 -top-2 size-5 rounded-full border-2 border-ink bg-cream p-0.5 text-ink" strokeWidth={3} />
        )}
      </div>
    );
  }

  const started = tile.state !== "unopened";
  const look = started
    ? "border-dashed border-ink bg-cream text-ink"
    : cn(fill, "border-ink shadow-[0_4px_0_var(--color-ink)]");
  const label = `${categoryName} ${points}${started ? "، اتفتح قبل كده" : ""}`;

  if (!canOpen) {
    return (
      <div role="img" aria-label={label} className={cn(base, look)}>
        {points}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabledByOther}
      onClick={onOpen}
      className={cn(
        base,
        look,
        "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-[3px] disabled:cursor-wait disabled:opacity-60",
        !started && "active:shadow-[0_1px_0_var(--color-ink)]",
        busy && "animate-pulse",
      )}
    >
      {points}
    </button>
  );
}
