import { Trophy } from "lucide-react";
import { teamTone } from "@/components/brand/tones";
import type { Team } from "@/lib/api/types";
import type { RosterEntry } from "@/lib/roster";
import { formatDigits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type ScoreboardProps = {
  teams: Team[];
  members: RosterEntry[];
  connected: ReadonlySet<string>;
};

/**
 * Two team scores, big and bold in the display face on an ink plate (so even a zero reads as a number),
 * with the players listed under each team. There is deliberately no turn indicator.
 */
export default function Scoreboard({ teams, members, connected }: ScoreboardProps) {
  return (
    <section
      aria-labelledby="score-title"
      className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border-4 border-ink bg-press p-3 text-white shadow-[0_8px_0_var(--color-ink)] sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
    >
      <div className="flex items-center gap-3 sm:w-32 sm:flex-col sm:justify-center">
        <Trophy aria-hidden className="size-9 text-sun sm:size-12" strokeWidth={2.5} />
        <h2 id="score-title" className="font-heading text-3xl leading-none">
          النتيجة
        </h2>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {teams.map((team) => {
          const tone = teamTone(team.number);
          const players = members.filter((m) => m.teamNumber === team.number);
          return (
            <article key={team.number} aria-label={team.name} className="min-w-0 rounded-2xl border-[3px] border-ink bg-cream p-3 text-ink sm:flex sm:items-stretch sm:gap-4 sm:p-4">
              <div className="min-w-0 sm:w-44 sm:shrink-0">
                <h3 className={cn("inline-block max-w-full truncate rounded-lg px-3 py-0.5 font-heading text-xl sm:text-3xl", tone.fill)}>{team.name}</h3>
                <ul aria-label={`لاعبين ${team.name}`} className="mt-2 flex flex-wrap gap-1.5 sm:mt-3">
                  {players.length === 0 && <li className="text-sm font-semibold text-ink">لسه مفيش لاعبين</li>}
                  {players.map((player) => (
                    <li key={player.id} className="flex max-w-full items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-sm font-bold">
                      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", connected.has(player.id) ? "bg-green" : "bg-charcoal/40")} />
                      <span className="truncate">{player.displayName}</span>
                    </li>
                  ))}
                </ul>
                <span className="sr-only">{formatDigits(players.length)} لاعبين</span>
              </div>
              <p
                className={cn(
                  "tabular mt-3 flex flex-col items-center justify-center rounded-2xl border-[3px] border-ink bg-ink px-3 py-2 font-heading leading-none sm:mt-0 sm:flex-1",
                  tone.score,
                )}
              >
                <span className="sr-only">{formatNumber(team.score)} نقطة</span>
                <span aria-hidden className="text-[clamp(3.5rem,8.5vw,9rem)]">
                  {formatNumber(team.score)}
                </span>
                <span aria-hidden className="mt-1 font-sans text-sm font-bold text-cream sm:text-lg">
                  نقطة
                </span>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
