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

/** Two team scores with the players listed under each team. There is deliberately no turn indicator. */
export default function Scoreboard({ teams, members, connected }: ScoreboardProps) {
  return (
    <section
      aria-label="النتيجة"
      className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border-4 border-ink bg-press p-3 text-white shadow-[0_8px_0_var(--color-ink)] sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
    >
      <div className="flex items-center gap-3 sm:w-36 sm:flex-col sm:justify-center">
        <Trophy aria-hidden className="size-9 text-sun sm:size-12" strokeWidth={2.5} />
        <h2 className="font-heading text-3xl leading-none">النتيجة</h2>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {teams.map((team) => {
          const tone = teamTone(team.number);
          const players = members.filter((m) => m.teamNumber === team.number);
          return (
            <article key={team.number} className="min-w-0 rounded-2xl border-[3px] border-ink bg-cream p-3 text-ink">
              <div className="flex items-center justify-between gap-2">
                <h3 className={cn("min-w-0 truncate rounded-lg px-3 py-0.5 font-heading text-xl sm:text-2xl", tone.fill)}>{team.name}</h3>
                <p aria-label={`${formatNumber(team.score)} نقطة`} className="tabular font-heading text-4xl leading-none sm:text-5xl">
                  {formatNumber(team.score)}
                </p>
              </div>
              <ul aria-label={`لاعبين ${team.name}`} className="mt-2 flex flex-wrap gap-1.5">
                {players.length === 0 && <li className="text-sm font-medium text-charcoal/65">لسه مفيش لاعبين</li>}
                {players.map((player) => (
                  <li
                    key={player.id}
                    className="flex max-w-full items-center gap-1.5 rounded-full border-2 border-ink/80 bg-white px-2.5 py-0.5 text-sm font-semibold"
                  >
                    <span
                      aria-hidden
                      className={cn("size-2 shrink-0 rounded-full", connected.has(player.id) ? "bg-green" : "bg-charcoal/30")}
                    />
                    <span className="truncate">{player.displayName}</span>
                  </li>
                ))}
              </ul>
              <span className="sr-only">{formatDigits(players.length)} لاعبين</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
