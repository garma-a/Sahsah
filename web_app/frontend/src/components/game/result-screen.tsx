"use client";

import { Crown, Handshake } from "lucide-react";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import type { CategoryResult, ResultTeam, ResultView } from "@/lib/api/types";
import { formatDigits, formatNumber } from "@/lib/format";
import { teamPlayers, type RosterEntry } from "@/lib/roster";
import { cn } from "@/lib/utils";

type ResultScreenProps = {
  view: ResultView;
  /** Lobby roster, used only when the result carries no team players (an older API). */
  roster: RosterEntry[];
  isHost: boolean;
  busy: boolean;
  error: string | null;
  onPlayAgain: () => void;
};

const endNote: Record<string, string> = {
  completed: "خلصت كل الأسئلة الـ ٣٦",
  host_ended: "المضيف أنهى اللعبة بدري",
  host_left: "المضيف خرج من اللعبة",
  idle_timeout: "اللعبة اتقفلت عشان محدش لمس فيها",
  platform_failure: "اللعبة وقفت بسبب مشكلة عندنا",
};

/** The finished game: who won, both teams with their players, how each category went, and the way back to the lobby. */
export default function ResultScreen({ view, roster, isHost, busy, error, onPlayAgain }: ResultScreenProps) {
  const { result } = view;
  const teams = [...result.teams].sort((a, b) => a.number - b.number);
  const winner = teams.find((t) => t.number === result.winningTeamNumber);
  const categories = [...result.categories].sort((a, b) => a.boardPosition - b.boardPosition);

  return (
    <section aria-labelledby="result-title" className="flex flex-1 flex-col gap-4">
      <div className="paper-card rounded-[2rem] border-4 border-ink p-4 shadow-[0_12px_0_var(--color-ink)] sm:p-6 lg:px-10 lg:py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="rounded-full border-[3px] border-ink bg-cream px-4 py-0.5 text-base font-bold">{endNote[result.endReason] ?? "اللعبة خلصت"}</p>
          <h1 id="result-title" tabIndex={-1} className="sr-only focus:outline-none">
            نتيجة اللعبة
          </h1>
          <div
            className={cn(
              "relative -rotate-1 rounded-[1.6rem] border-4 border-ink px-8 py-3 shadow-[0_8px_0_var(--color-ink)]",
              winner ? teamTone(winner.number).fill : "bg-cream",
            )}
          >
            <p className="flex items-center justify-center gap-3 font-heading text-4xl leading-tight sm:text-5xl lg:text-7xl">
              {winner ? (
                <>
                  <Crown aria-hidden className="size-9 lg:size-14" strokeWidth={2.5} />
                  <span>الفايز: {winner.name}</span>
                </>
              ) : (
                <>
                  <Handshake aria-hidden className="size-9 lg:size-14" strokeWidth={2.5} />
                  <span>تعادل</span>
                </>
              )}
            </p>
          </div>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <TeamCard key={team.number} team={team} won={team.number === result.winningTeamNumber} roster={roster} />
          ))}
        </ul>

        <h2 className="mt-8 mb-3 font-heading text-3xl leading-none">الفئات</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {categories.map((category) => (
            <CategoryRow key={category.boardPosition} category={category} teams={teams} />
          ))}
        </ul>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {isHost ? (
        <div className="flex justify-center">
          <Button size="xl" disabled={busy} aria-busy={busy || undefined} onClick={onPlayAgain}>
            {busy ? "ثانية…" : "نلعب تاني"}
          </Button>
        </div>
      ) : (
        <p className="text-center font-heading text-2xl text-cream">المضيف هيرجّعكم للوبي لما يحب يلعب تاني</p>
      )}
    </section>
  );
}

function TeamCard({ team, won, roster }: { team: ResultTeam; won: boolean; roster: RosterEntry[] }) {
  const tone = teamTone(team.number);
  const players = teamPlayers(team, roster);
  const adjustment = Number(team.manualAdjustmentTotal);
  return (
    <li className={cn("rounded-[1.4rem] border-4 border-ink bg-cream p-4 shadow-[0_6px_0_var(--color-ink)]", won && "ring-4 ring-sun ring-offset-2 ring-offset-cream")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={cn("max-w-full truncate rounded-lg px-3 py-0.5 font-heading text-2xl sm:text-3xl", tone.fill)}>{team.name}</h2>
        <p className="tabular font-heading text-6xl leading-none lg:text-7xl">
          <span className="sr-only">{formatNumber(team.score)} نقطة</span>
          <span aria-hidden>{formatNumber(team.score)}</span>
        </p>
      </div>
      {adjustment !== 0 && Number.isFinite(adjustment) && (
        <p className="tabular mt-1 text-sm font-semibold text-charcoal/80">
          من الأسئلة {formatNumber(team.questionAwardTotal)}، وتصحيح من المضيف: {adjustment > 0 ? "زيادة" : "نقص"}{" "}
          {formatNumber(Math.abs(adjustment))}
        </p>
      )}
      <ul aria-label={`لاعبين ${team.name}`} className="mt-2 flex flex-wrap gap-1.5">
        {players.length === 0 && <li className="text-sm font-semibold">مفيش لاعبين</li>}
        {players.map((player) => (
          <li key={player.id} className="max-w-full truncate rounded-full border-2 border-ink bg-white px-3 py-0.5 text-sm font-bold">
            {player.displayName}
          </li>
        ))}
      </ul>
    </li>
  );
}

function CategoryRow({ category, teams }: { category: CategoryResult; teams: ResultTeam[] }) {
  const winner = teams.find((t) => t.number === category.winningTeamNumber);
  return (
    <li className="flex flex-col gap-1 rounded-2xl border-[3px] border-ink bg-white p-3">
      <p className="truncate font-heading text-xl leading-tight">{category.name}</p>
      <p className="tabular flex items-center gap-2 text-sm font-bold" dir="rtl">
        <span className={cn("rounded px-1.5", teamTone(1).fill)}>{formatNumber(category.teamOneAwardPoints)}</span>
        <span className={cn("rounded px-1.5", teamTone(2).fill)}>{formatNumber(category.teamTwoAwardPoints)}</span>
      </p>
      <p className="text-xs font-semibold text-charcoal/80">اتلعب {formatDigits(category.resolvedCount)} من ٦</p>
      <p className="line-clamp-2 text-sm font-bold">{winner ? `كسبها ${winner.name}` : category.resolvedCount === 0 ? "محدش لعب فيها" : "تعادل"}</p>
    </li>
  );
}
