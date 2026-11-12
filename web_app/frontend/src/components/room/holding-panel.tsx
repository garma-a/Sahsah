"use client";

import { teamTone } from "@/components/brand/tones";
import type { ResultView } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Stand-in for the result screen until it is built. */
export function ResultHolding({ view }: { view: ResultView }) {
  const { result } = view;
  const winner = result.teams.find((t) => t.number === result.winningTeamNumber);
  return (
    <section aria-labelledby="result-title" className="paper-card m-auto w-full max-w-2xl rounded-[2rem] border-4 border-ink p-8 text-center shadow-[0_12px_0_var(--color-ink)]">
      <h1 id="result-title" className="font-heading text-5xl">
        اللعبة خلصت
      </h1>
      <p className="mt-2 text-xl font-semibold">{winner ? `الفايز: ${winner.name}` : "تعادل"}</p>
      <ul className="mt-6 grid grid-cols-2 gap-3">
        {result.teams.map((team) => (
          <li key={team.number} className={cn("rounded-2xl border-[3px] border-ink p-4", teamTone(team.number).fill)}>
            <p className="truncate font-heading text-2xl">{team.name}</p>
            <p className="tabular font-heading text-5xl">{formatNumber(team.score)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
