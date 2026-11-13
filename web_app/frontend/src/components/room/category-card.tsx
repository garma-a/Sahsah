"use client";

import { Minus, Undo2 } from "lucide-react";
import { useRef } from "react";
import Cover from "@/components/brand/cover";
import { teamTone, toneAt } from "@/components/brand/tones";
import type { BoardCategory, Category, Tile } from "@/lib/api/types";
import { formatDigits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type CategoryCardProps = {
  column: BoardCategory;
  entry?: { category: Category; index: number };
  toneIndex: number;
  /** This card is held flipped by a click, tap or Enter (hover flips it too, without holding it). */
  flipped: boolean;
  onFlip: (flipped: boolean) => void;
  /** The host can open tiles; everyone else sees the same card without controls. */
  canOpen: boolean;
  /** "boardPosition:questionPosition" of a command in flight. */
  pending: string | null;
  onOpen: (boardPosition: number, questionPosition: number) => void;
};

/** The team that won more of this category's points, or null on a tie or when nothing was awarded. */
function categoryWinner(tiles: Tile[]): 1 | 2 | null {
  let one = 0;
  let two = 0;
  for (const tile of tiles) {
    if (tile.state !== "resolved") continue;
    if (tile.winningTeamNumber === 1) one += tile.awardedPoints ?? 0;
    if (tile.winningTeamNumber === 2) two += tile.awardedPoints ?? 0;
  }
  return one === two ? null : one > two ? 1 : 2;
}

/**
 * One category as a card with two faces. The front is the cover poster with the name and how many of its
 * six tiles are left; the back lists the tiles with their points. The host opens a tile from the back.
 * Question text never appears here: the board carries none.
 */
export default function CategoryCard({ column, entry, toneIndex, flipped, onFlip, canOpen, pending, onOpen }: CategoryCardProps) {
  const tone = toneAt(toneIndex);
  const tiles = [...column.tiles].sort((a, b) => a.questionPosition - b.questionPosition);
  const left = tiles.filter((tile) => tile.state !== "resolved").length;
  const finished = left === 0;
  const winner = finished ? categoryWinner(tiles) : null;
  const count = `${formatDigits(left)}/${formatDigits(tiles.length)} باقي`;

  const front = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLButtonElement>(null);
  // After a keyboard flip the focused face turns away, so focus follows to the face that is now showing.
  // The turned-away face leaves the tab order at the half-turn (see .flip-face), hence the short wait.
  const flip = (next: boolean, event: React.SyntheticEvent) => {
    onFlip(next);
    if ((event.nativeEvent as MouseEvent).detail !== 0 && event.type === "click") return;
    setTimeout(() => (next ? header.current : front.current)?.focus(), 300);
  };

  return (
    <article
      aria-label={column.name}
      data-flipped={flipped}
      className="flip aspect-[3/4] w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape" && flipped) flip(false, event);
      }}
    >
      <div className="flip-inner">
        <button
          ref={front}
          type="button"
          aria-expanded={flipped}
          aria-label={`${column.name}، ${finished ? "خلصت" : `${formatDigits(left)} من ${formatDigits(tiles.length)} باقي`}. اقلب الكارت`}
          onClick={(event) => flip(true, event)}
          className={cn(
            "flip-face flip-front cursor-pointer overflow-hidden border-4 bg-[#fff8ea] text-start shadow-poster",
            tone.border,
          )}
        >
          <Cover
            src={entry?.category.coverUrl}
            name={column.name}
            className={cn("absolute inset-0 aspect-auto h-full", finished && "opacity-45 grayscale-[0.6]")}
            sizes="(min-width: 1024px) 16vw, 45vw"
          />
          {!finished && (
            <span className="tabular absolute start-1.5 top-1.5 rounded-full border-2 border-ink bg-cream px-2 py-0.5 text-sm font-extrabold text-ink">
              {count}
            </span>
          )}
          <h3 className={cn("absolute inset-x-0 bottom-0 truncate px-2 py-1.5 text-center font-heading text-xl leading-tight sm:text-2xl", tone.ribbon)}>
            {column.name}
          </h3>
          {finished && (
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-3 top-[38%] rotate-[-14deg] rounded-lg border-4 border-ink py-1 text-center font-heading text-4xl leading-tight shadow-[0_5px_0_var(--color-ink)]",
                winner ? teamTone(winner).fill : "bg-cream text-ink",
              )}
            >
              خلصت
            </span>
          )}
        </button>

        <div className={cn("flip-face flip-back paper-card flex flex-col gap-1.5 overflow-hidden border-4 p-1.5 shadow-poster", tone.border)}>
          <button
            ref={header}
            type="button"
            aria-label={`${column.name}. ارجع للغلاف`}
            onClick={(event) => flip(false, event)}
            className={cn("flex h-9 shrink-0 cursor-pointer items-center justify-between gap-1 rounded-lg px-2 font-heading text-lg leading-none", tone.ribbon)}
          >
            <span className="truncate">{column.name}</span>
            <Undo2 aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
          </button>
          <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-1.5">
            {tiles.map((tile) => (
              <li key={tile.questionPosition} className="min-h-0">
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
        </div>
      </div>
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
  const base = "relative flex size-full min-h-11 items-center justify-center rounded-xl border-[3px] font-heading text-[1.7rem] leading-none";

  if (tile.state === "resolved") {
    const winner = tile.winningTeamNumber ?? null;
    return (
      <div
        role="img"
        aria-label={`${categoryName} ${points}: خلص${winner ? ` وكسبه الفريق ${formatNumber(winner)}` : " من غير فايز"}`}
        className={cn(base, "border-ink", winner ? teamTone(winner).fill : "border-charcoal/30 bg-charcoal/[0.12] text-charcoal/50")}
      >
        <span className={cn(!winner && "line-through decoration-[3px]")}>{points}</span>
        {winner ? (
          <span
            aria-hidden
            className="absolute -end-1.5 -top-2 grid size-5 place-items-center rounded-full border-2 border-ink bg-cream font-sans text-[0.7rem] font-extrabold text-ink"
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
  const look = started ? "border-dashed border-ink bg-cream text-ink" : cn(fill, "border-ink shadow-[0_4px_0_var(--color-ink)]");
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
