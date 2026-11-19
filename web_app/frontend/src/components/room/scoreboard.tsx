import { Trophy } from "lucide-react";
import { teamTone } from "@/components/brand/tones";
import type { Team } from "@/lib/api/types";
import { teamPlayers, type RosterEntry } from "@/lib/roster";
import { formatDigits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type ScoreboardProps = {
  teams: Team[];
  members: RosterEntry[];
  connected: ReadonlySet<string>;
  /** The host's game tools, at the end of the row. */
  tools?: React.ReactNode;
  /** Stacked in a narrow side rail beside the board or question, instead of a full-width row. */
  rail?: boolean;
};

/**
 * Two compact team cards: the score is a large display-face number beside the team name, with the players
 * listed under it. There is deliberately no turn indicator.
 */
export default function Scoreboard({ teams, members, connected, tools, rail }: ScoreboardProps) {
  return (
    <section
      aria-labelledby="score-title"
      className={cn(
        rail
          ? "flex shrink-0 flex-col gap-2 rounded-[1.4rem] border-4 border-ink bg-press p-2 text-white shadow-[0_6px_0_var(--color-ink)]"
          : "mt-4 flex shrink-0 flex-col gap-3 rounded-[1.4rem] border-4 border-ink bg-press p-3 text-white shadow-[0_8px_0_var(--color-ink)] sm:flex-row sm:items-center sm:gap-4 sm:p-3 compact:mt-3 compact:p-2 short:mt-3 short:gap-2 short:p-1.5 short:shadow-[0_5px_0_var(--color-ink)]",
      )}
    >
      <div className={cn("flex items-center gap-3", rail ? "justify-center gap-2 compact:sr-only" : "sm:w-28 sm:flex-col sm:justify-center short:w-20 short:gap-1")}>
        <Trophy aria-hidden className={cn("size-8 text-sun short:size-6", !rail && "sm:size-10")} strokeWidth={2.5} />
        <h2 id="score-title" className={cn("font-heading leading-none short:text-xl", rail ? "text-2xl" : "text-3xl")}>
          النتيجة
        </h2>
      </div>
      <div className={cn("grid flex-1 gap-2", rail ? "grid-cols-1" : "grid-cols-2 gap-3")}>
        {teams.map((team) => {
          const tone = teamTone(team.number);
          const players = teamPlayers(team, members);
          return (
            <article key={team.number} aria-label={team.name} className="min-w-0 rounded-2xl border-[3px] border-ink bg-cream px-3 py-2 text-ink sm:px-4 compact:py-1 short:py-0.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h3 className={cn("max-w-full truncate rounded-lg px-3 py-0.5 font-heading text-xl sm:text-2xl short:text-lg", tone.fill)}>{team.name}</h3>
                <p className="tabular flex items-center gap-2 leading-none">
                  <span className="sr-only">{formatNumber(team.score)} نقطة</span>
                  <span aria-hidden className={cn("font-heading short:text-[2rem]", rail ? "text-[2.75rem] short:text-[1.75rem]" : "text-[3.5rem] sm:text-[4rem] compact:text-[2.75rem]")}>
                    {formatNumber(team.score)}
                  </span>
                  <span aria-hidden className="text-sm font-bold">
                    نقطة
                  </span>
                </p>
              </div>
              <ul aria-label={`لاعبين ${team.name}`} className={cn("mt-1 flex flex-wrap gap-1.5 short:hidden", rail && "compact:hidden")}>
                {players.length === 0 && <li className="text-sm font-semibold">لسه مفيش لاعبين</li>}
                {players.map((player) => (
                  <li key={player.id} className="flex max-w-full items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-sm font-bold">
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", connected.has(player.id) ? "bg-green" : "bg-charcoal/40")} />
                    <span className="truncate">{player.displayName}</span>
                  </li>
                ))}
              </ul>
              <span className="sr-only">{formatDigits(players.length)} لاعبين</span>
            </article>
          );
        })}
      </div>
      {tools}
    </section>
  );
}
