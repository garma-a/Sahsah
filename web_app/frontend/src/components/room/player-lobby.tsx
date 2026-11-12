"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import NumberChip from "@/components/ui/number-chip";
import { type Auth } from "@/lib/api/client";
import { setReadiness, updateOwnMembership } from "@/lib/api/endpoints";
import { isConflict, messageOf } from "@/lib/api/errors";
import type { LobbyView, TeamNumber } from "@/lib/api/types";
import { useIntentKeys } from "@/lib/use-intent-keys";
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
  const intents = useIntentKeys();

  const me = view.members.find((m) => m.id === membershipId);
  const players = view.members.filter((m) => !m.host);
  const readyCount = players.filter((m) => m.ready).length;

  // Each intent keeps its own Idempotency-Key until it succeeds: a retry after a lost response is the same
  // operation. The signature names the intent and the versions it was made against.
  async function run(kind: "team" | "ready", signature: string, action: (operationId: string) => Promise<unknown>) {
    setBusy(kind);
    setProblem(null);
    try {
      await action(intents.key(signature));
      intents.done(signature);
    } catch (cause) {
      setProblem(messageOf(cause));
      // A stale version means someone changed the room: take the current projection and let them retry.
      if (isConflict(cause)) onRefresh();
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
    run("team", `team:${teamNumber}:${me.memberVersion}:${view.readyGeneration}`, async (operationId) => {
      await updateOwnMembership(roomId, auth, operationId, {
        expectedMembershipVersion: me.memberVersion,
        expectedReadyGeneration: view.readyGeneration,
        teamNumber,
      });
      onRefresh();
    });

  const toggleReady = () =>
    run("ready", `ready:${!me.ready}:${me.memberVersion}:${view.readyGeneration}`, async (operationId) => {
      await setReadiness(roomId, auth, operationId, {
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
        <p className="mt-1 text-base font-medium">اختار فريقك وبعدين اضغط جاهز.</p>
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
                    {member.ready && <span className="ms-auto shrink-0 text-sm font-bold">جاهز</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-3 mt-auto space-y-2 pt-2">
        {problem && <ErrorBanner>{problem}</ErrorBanner>}
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
        <p role="status" className="flex flex-wrap items-center justify-center gap-x-2 text-center text-base font-bold text-cream">
          <NumberChip value={readyCount} />
          <span>من</span>
          <NumberChip value={players.length} />
          <span>جاهزين. المضيف هو اللي هيبدأ اللعبة.</span>
        </p>
      </div>
    </div>
  );
}
