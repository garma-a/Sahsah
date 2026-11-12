"use client";

import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import type { QuestionView, ResultView } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Stand-in for the question screen while it is built: it names the tile that was opened and, for the host,
 * returns to the board so the whole open / return loop can be played end to end.
 */
export function QuestionHolding({
  view,
  categoryName,
  isHost,
  busy,
  error,
  onReturn,
}: {
  view: QuestionView;
  categoryName: string;
  isHost: boolean;
  busy: boolean;
  error: string | null;
  onReturn: () => void;
}) {
  return (
    <section
      aria-labelledby="holding-title"
      className="paper-card m-auto flex w-full max-w-2xl flex-col items-center gap-5 rounded-[2rem] border-4 border-ink p-8 text-center shadow-[0_12px_0_var(--color-ink)]"
    >
      <p className="grid size-28 -rotate-6 place-items-center rounded-full border-4 border-ink bg-sun font-heading text-5xl shadow-[0_6px_0_var(--color-ink)]">
        {formatNumber(view.basePoints)}
      </p>
      <h1 id="holding-title" className="font-heading text-4xl leading-tight sm:text-5xl">
        اتفتح سؤال في {categoryName}
      </h1>
      <p className="max-w-md text-lg font-medium text-charcoal/85">
        {isHost ? "شاشة السؤال لسه بتتجهّز. ارجع للوحة واختار سؤال تاني." : "المضيف فاتح سؤال دلوقتي. استنى ويرجع للوحة."}
      </p>
      {error && (
        <p role="alert" className="rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-2 font-semibold text-[#8c1c15]">
          {error}
        </p>
      )}
      {isHost && (
        <Button size="lg" onClick={onReturn} disabled={busy}>
          {busy ? "ثانية…" : "ارجع للوحة"}
        </Button>
      )}
    </section>
  );
}

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
