"use client";

import { Check, Minus, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import type { Team, TeamNumber } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { useRadioGroup } from "@/lib/use-radio-group";
import { cn } from "@/lib/utils";

const STEP = 50;

type Choice = TeamNumber | "none" | null;

type AwardPanelProps = {
  teams: Team[];
  /** The tile's original value: an award never goes above it. */
  basePoints: number;
  /** The current hint stage's value, offered first. */
  suggestedPoints: number;
  /** Other stage values worth offering as one-tap amounts. */
  stageSuggestions?: number[];
  busy: boolean;
  canReturn: boolean;
  onResolve: (winner: TeamNumber | null, points: number | undefined) => void;
  onReturn: () => void;
};

/**
 * The award step. Choosing who won only marks the choice; nothing is sent until the big confirm button,
 * which spells out the exact result ("ادّي ٤٠٠ نقطة لـ النسور"), so a stray tap cannot change the score.
 * The points start at the suggested value and can move in steps of fifty between zero and the tile's value.
 */
export default function AwardPanel({ teams, basePoints, suggestedPoints, stageSuggestions, busy, canReturn, onResolve, onReturn }: AwardPanelProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const [points, setPoints] = useState(Math.min(suggestedPoints, basePoints));
  const clamp = (value: number) => Math.min(basePoints, Math.max(0, value));
  const amounts = [...new Set([suggestedPoints, ...(stageSuggestions ?? []), basePoints])].filter((v) => v <= basePoints).sort((a, b) => b - a);
  const winner = typeof choice === "number" ? teams.find((team) => team.number === choice) : undefined;
  const radio = useRadioGroup<TeamNumber | "none">([...teams.map((team) => team.number as TeamNumber), "none"], choice, setChoice);

  const confirmLabel = busy
    ? "ثانية…"
    : winner
      ? `ادّي ${formatNumber(points)} نقطة لـ«${winner.name}»`
      : choice === "none"
        ? "محدش كسب السؤال"
        : "اختار مين كسب الأول";

  return (
    <section aria-labelledby="award-title" className="rounded-[1.6rem] border-4 border-ink bg-cream p-3 shadow-[0_8px_0_var(--color-ink)] short:p-2">
      <div className="mb-3 flex items-center justify-between gap-3 short:mb-1.5">
        <h2 id="award-title" className="font-heading text-2xl leading-none short:text-lg">
          مين كسب السؤال؟
        </h2>
        {canReturn && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onReturn} className="short:h-7 short:px-2 short:text-sm">
            <Undo2 aria-hidden className="size-4" />
            ارجع للوحة
          </Button>
        )}
      </div>

      <div role="radiogroup" aria-labelledby="award-title" className="grid grid-cols-2 gap-2">
        {teams.map((team) => {
          const selected = choice === team.number;
          return (
            <button
              key={team.number}
              type="button"
              {...radio(team.number as TeamNumber)}
              disabled={busy}
              onClick={() => setChoice(team.number as TeamNumber)}
              className={cn(
                "relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border-4 border-ink px-2 py-1.5 compact:min-h-12 short:min-h-10 short:py-1 transition-[transform,box-shadow,opacity] duration-150 disabled:cursor-wait",
                teamTone(team.number).fill,
                selected ? "-translate-y-1 shadow-[0_8px_0_var(--color-ink)] ring-4 ring-ink ring-offset-2 ring-offset-cream" : "shadow-[0_4px_0_var(--color-ink)]",
                choice !== null && !selected && "opacity-60",
              )}
            >
              {selected && <Check aria-hidden className="absolute end-2 top-2 size-6 rounded-full bg-ink p-1 text-cream" strokeWidth={4} />}
              <span className="line-clamp-2 max-w-full break-words text-balance font-heading text-xl leading-tight short:line-clamp-1 short:text-base">{team.name}</span>
              <span className="tabular text-sm font-bold short:hidden">دلوقتي {formatNumber(team.score)}</span>
            </button>
          );
        })}
        <button
          type="button"
          {...radio("none")}
          disabled={busy}
          onClick={() => setChoice("none")}
          className={cn(
            "relative col-span-2 flex min-h-11 short:min-h-9 short:py-0.5 cursor-pointer items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-ink bg-white px-3 py-1 transition-[transform,box-shadow,opacity] duration-150 disabled:cursor-wait",
            choice === "none" ? "-translate-y-1 shadow-[0_8px_0_var(--color-ink)] ring-4 ring-ink ring-offset-2 ring-offset-cream" : "shadow-[0_4px_0_var(--color-ink)]",
            choice !== null && choice !== "none" && "opacity-60",
          )}
        >
          {choice === "none" && <Check aria-hidden className="absolute end-2 top-2 size-6 rounded-full bg-ink p-1 text-cream" strokeWidth={4} />}
          <span className="font-heading text-2xl leading-tight short:text-lg">محدش</span>
          <span className="text-sm font-bold">من غير نقط</span>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 compact:mt-2">
        <div
          aria-hidden={!winner}
          className={cn("flex flex-wrap items-center justify-center gap-2 transition-opacity", winner ? "opacity-100" : "pointer-events-none opacity-35")}
        >
          <span className="sr-only">النقط</span>
          <div className="flex items-center gap-2 rounded-full border-4 border-ink bg-white p-1 short:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-label={`قلّل ${formatNumber(STEP)}`}
              disabled={busy || !winner || points <= 0}
              onClick={() => setPoints((value) => clamp(value - STEP))}
              tabIndex={winner ? 0 : -1}
            >
              <Minus aria-hidden className="size-5" strokeWidth={3} />
            </Button>
            <output aria-live="polite" className="tabular min-w-[4ch] text-center font-heading text-3xl leading-none">
              {formatNumber(points)}
            </output>
            <Button
              variant="outline"
              size="icon"
              aria-label={`زوّد ${formatNumber(STEP)}`}
              disabled={busy || !winner || points >= basePoints}
              onClick={() => setPoints((value) => clamp(value + STEP))}
              tabIndex={winner ? 0 : -1}
            >
              <Plus aria-hidden className="size-5" strokeWidth={3} />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 short:flex-nowrap short:gap-1">
            {amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={busy || !winner}
                tabIndex={winner ? 0 : -1}
                aria-pressed={points === amount}
                onClick={() => setPoints(amount)}
                className={cn(
                  "tabular h-9 min-w-12 short:h-7 short:min-w-0 short:px-2 short:text-base cursor-pointer rounded-full border-[3px] border-ink px-3 font-heading text-xl leading-none",
                  points === amount ? "bg-ink text-cream" : "bg-white hover:bg-sun",
                )}
              >
                {formatNumber(amount)}
              </button>
            ))}
          </div>
        </div>
        <Button
          size="lg"
          disabled={busy || choice === null}
          aria-busy={busy || undefined}
          onClick={() => choice !== null && onResolve(winner ? (winner.number as TeamNumber) : null, winner ? points : undefined)}
          className="h-auto min-h-12 w-full whitespace-normal text-balance py-2 text-center leading-tight short:min-h-9 short:py-1 short:text-base"
        >
          {confirmLabel}
        </Button>
      </div>
      <p className="mt-2 text-xs font-medium text-charcoal/80 compact:hidden">أعلى حاجة تقدر تدّيها {formatNumber(basePoints)} نقطة، وهي قيمة السؤال.</p>
    </section>
  );
}
