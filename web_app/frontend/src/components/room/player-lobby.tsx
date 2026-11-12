"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import { ApiError, type Auth } from "@/lib/api/client";
import { setReadiness, updateOwnMembership } from "@/lib/api/endpoints";
import type { LobbyView, TeamNumber } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

type PlayerLobbyProps = {
  roomId: string;
  view: LobbyView;
  auth: Auth;
  membershipId: string;
  connected: ReadonlySet<string>;
  onRefresh: () => void;
};

/** The phone view of the lobby: pick a team, confirm Ready, and watch who else is in. */
export default function PlayerLobby({ roomId, view, auth, membershipId, connected, onRefresh }: PlayerLobbyProps) {
  const [busy, setBusy] = useState<"team" | "ready" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const me = view.members.find((m) => m.id === membershipId);
  const players = view.members.filter((m) => !m.host);
  const readyCount = players.filter((m) => m.ready).length;

  async function run(kind: "team" | "ready", action: () => Promise<unknown>) {
    setBusy(kind);
    setProblem(null);
    try {
      await action();
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "حصلت مشكلة. جرّب تاني.");
      // A stale version means someone changed the room: take the current projection and let them retry.
      if (cause instanceof ApiError && cause.status === 409) onRefresh();
    } finally {
      setBusy(null);
    }
  }

  if (!me) {
    return (
      <div role="status" className="paper-card m-auto rounded-3xl border-4 border-ink p-8 text-center font-heading text-3xl shadow-[0_8px_0_var(--color-ink)]">
        بنجهّز مكانك…
      </div>
    );
  }

  const pickTeam = (teamNumber: TeamNumber) =>
    run("team", async () => {
      await updateOwnMembership(roomId, auth, {
        expectedMembershipVersion: me.memberVersion,
        expectedReadyGeneration: view.readyGeneration,
        teamNumber,
      });
      onRefresh();
    });

  const toggleReady = () =>
    run("ready", async () => {
      await setReadiness(roomId, auth, {
        expectedMembershipVersion: me.memberVersion,
        expectedReadyGeneration: view.readyGeneration,
        ready: !me.ready,
      });
      onRefresh();
    });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4">
      <section className="paper-card rounded-[1.6rem] border-4 border-ink p-5 shadow-[0_8px_0_var(--color-ink)]">
        <h1 className="font-heading text-4xl leading-tight">أهلًا يا {me.displayName}</h1>
        <p className="mt-1 text-base font-medium text-charcoal/80">اختار فريقك وبعدين اضغط جاهز.</p>
      </section>

      <section aria-label="الفريقين" className="grid grid-cols-2 gap-3">
        {[
          { number: 1 as const, name: view.teamOneName },
          { number: 2 as const, name: view.teamTwoName },
        ].map((team) => {
          const mine = me.teamNumber === team.number;
          const members = players.filter((m) => m.teamNumber === team.number);
          return (
            <div key={team.number} className="min-w-0">
              <button
                type="button"
                aria-pressed={mine}
                disabled={busy !== null}
                onClick={() => !mine && pickTeam(team.number)}
                className={cn(
                  "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-4 border-ink px-2 py-3 font-heading text-2xl leading-tight transition-[transform,box-shadow] disabled:opacity-70",
                  mine
                    ? cn(teamTone(team.number).fill, "-translate-y-1 shadow-[0_8px_0_var(--color-ink)]")
                    : "bg-white shadow-[0_4px_0_var(--color-ink)] active:translate-y-0.5",
                )}
              >
                <span className="max-w-full truncate">{team.name}</span>
                <span className="flex items-center gap-1 text-sm font-sans font-bold">
                  {mine ? (
                    <>
                      <Check className="size-4" aria-hidden strokeWidth={3} /> فريقك
                    </>
                  ) : (
                    "انضم"
                  )}
                </span>
              </button>
              <ul aria-label={`لاعبين ${team.name}`} className="mt-3 space-y-1.5">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-2 rounded-xl border-2 border-ink/80 bg-white px-3 py-1.5 text-base font-bold">
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", member.ready ? "bg-green" : connected.has(member.id) ? "bg-amber" : "bg-charcoal/30")} />
                    <span className="min-w-0 truncate">{member.displayName}</span>
                    {member.ready && <span className="ms-auto shrink-0 text-sm text-charcoal/70">جاهز</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-3 mt-auto space-y-2 pt-2">
        {problem && (
          <p role="alert" className="rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-2 font-semibold text-[#8c1c15]">
            {problem}
          </p>
        )}
        {me.teamNumber === null && <p className="text-center text-sm font-bold text-cream">اختار فريق الأول.</p>}
        <Button
          size="xl"
          variant={me.ready ? "cyan" : "default"}
          disabled={busy !== null || me.teamNumber === null}
          onClick={toggleReady}
          aria-pressed={me.ready}
          className="w-full"
        >
          {me.ready ? "جاهز ✓ (اضغط عشان تلغي)" : "أنا جاهز"}
        </Button>
        <p role="status" className="text-center text-sm font-bold text-cream">
          {formatDigits(readyCount)} من {formatDigits(players.length)} جاهزين. المضيف هو اللي هيبدأ اللعبة.
        </p>
      </div>
    </div>
  );
}
