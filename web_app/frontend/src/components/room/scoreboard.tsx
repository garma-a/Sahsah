import { Trophy } from "lucide-react";
import { teamTone } from "@/components/brand/tones";
import type { Team } from "@/lib/api/types";
import type { RosterEntry } from "@/lib/roster";
import { formatDigits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type PlayerChip = Pick<RosterEntry, "id" | "displayName">;

type ScoreboardProps = {
  teams: Team[];
  members: RosterEntry[];
  connected: ReadonlySet<string>;
};

/**
 * Two compact team cards: the score is a large display-face number beside the team name, with the players
 * listed under it. There is deliberately no turn indicator.
 */
export default function Scoreboard({ teams, members, connected }: ScoreboardProps) {
  return (
    <section
      aria-labelledby="score-title"
      className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border-4 border-ink bg-press p-3 text-white shadow-[0_8px_0_var(--color-ink)] sm:flex-row sm:items-center sm:gap-4 sm:p-3"
    >
      <div className="flex items-center gap-3 sm:w-28 sm:flex-col sm:justify-center">
        <Trophy aria-hidden className="size-8 text-sun sm:size-10" strokeWidth={2.5} />
        <h2 id="score-title" className="font-heading text-3xl leading-none">
          النتيجة
        </h2>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {teams.map((team) => {
          const tone = teamTone(team.number);
          // The game view lists each team's players; an older API does not, and the lobby roster stands in.
          const players: PlayerChip[] = team.players
            ? team.players.map((p) => ({ id: p.membershipId, displayName: p.displayName }))
            : members.filter((m) => m.teamNumber === team.number);
          return (
            <article key={team.number} aria-label={team.name} className="min-w-0 rounded-2xl border-[3px] border-ink bg-cream px-3 py-2 text-ink sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h3 className={cn("max-w-full truncate rounded-lg px-3 py-0.5 font-heading text-xl sm:text-2xl", tone.fill)}>{team.name}</h3>
                <p className="tabular flex items-center gap-2 leading-none">
                  <span className="sr-only">{formatNumber(team.score)} نقطة</span>
                  <span aria-hidden className="font-heading text-[3.5rem] sm:text-[4rem]">
                    {formatNumber(team.score)}
                  </span>
                  <span aria-hidden className="text-sm font-bold">
                    نقطة
                  </span>
                </p>
              </div>
              <ul aria-label={`لاعبين ${team.name}`} className="mt-1 flex flex-wrap gap-1.5">
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
    </section>
  );
}
