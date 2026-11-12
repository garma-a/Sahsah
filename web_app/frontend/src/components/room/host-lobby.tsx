"use client";

import { Check, Clock, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import Cover from "@/components/brand/cover";
import { teamTone, toneAt } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import { type Auth } from "@/lib/api/client";
import { getInvitation, startGame } from "@/lib/api/endpoints";
import { isConflict, messageOf } from "@/lib/api/errors";
import type { Category, Invitation, LobbyView } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { useIntentKeys } from "@/lib/use-intent-keys";
import { cn } from "@/lib/utils";

type HostLobbyProps = {
  roomId: string;
  view: LobbyView;
  roomVersion: string;
  auth: Auth;
  categories: ReadonlyMap<string, { category: Category; index: number }>;
  connected: ReadonlySet<string>;
  onRefresh: () => void;
};

export default function HostLobby({ roomId, view, roomVersion, auth, categories, connected, onRefresh }: HostLobbyProps) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const intents = useIntentKeys();

  const credential = auth.kind === "host" ? auth.credential : null;
  const controlSecret = auth.kind === "host" ? auth.controlSecret : null;
  const generation = auth.kind === "host" ? auth.generation : null;
  useEffect(() => {
    if (!credential || !controlSecret || !generation) return;
    const controller = new AbortController();
    getInvitation(roomId, { kind: "host", credential, controlSecret, generation })
      .then((next) => {
        if (!controller.signal.aborted) setInvitation(next);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setInvitationError(messageOf(cause, "تعذّر تحميل الكود."));
      });
    return () => controller.abort();
  }, [roomId, credential, controlSecret, generation, view.readyGeneration]);

  const players = view.members.filter((m) => !m.host);
  const waiting = players.filter((m) => !m.ready);
  const canStart = waiting.length === 0;

  async function start() {
    setStarting(true);
    setProblem(null);
    // The same intent keeps the same key, so a lost response retries the same start instead of a second one.
    const signature = `start:${roomVersion}:${view.readyGeneration}`;
    try {
      await startGame(roomId, auth, intents.key(signature), {
        expectedRoomVersion: roomVersion,
        expectedReadyGeneration: view.readyGeneration,
      });
      intents.done(signature);
      onRefresh();
    } catch (cause) {
      setProblem(messageOf(cause));
      if (isConflict(cause)) onRefresh();
    } finally {
      setStarting(false);
    }
  }

  async function copyLink() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("مقدرناش ننسخ الرابط. انسخه من الكود.");
    }
  }

  const code = invitation?.code ?? "";
  const joinHost = invitation ? new URL(invitation.joinUrl).host : "";

  return (
    <div className="grid flex-1 content-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Invitation: code and QR, readable from across the room. */}
      <section aria-labelledby="invite-title" className="paper-card flex flex-col items-center justify-center rounded-[1.6rem] border-4 border-ink p-5 text-center shadow-[0_10px_0_var(--color-ink)]">
        <h2 id="invite-title" className="font-heading text-3xl leading-tight sm:text-4xl">
          ادخلوا بالكود أو امسحوا الـQR
        </h2>
        {invitation ? (
          <>
            <div className="mt-4 rounded-2xl border-4 border-ink bg-white p-3 shadow-[0_5px_0_var(--color-ink)]">
              <QRCodeSVG value={invitation.joinUrl} size={240} level="M" marginSize={1} fgColor="#1d2321" bgColor="#ffffff" role="img" title="كود QR للانضمام للغرفة" />
            </div>
            <p className="mt-4 text-base font-semibold" dir="ltr">
              {joinHost}/join
            </p>
            <p id="room-code" className="tabular mt-1 select-all font-heading text-6xl tracking-[0.12em] sm:text-7xl">
              <span className="sr-only">كود الغرفة {formatDigits(code).split("").join(" ")}</span>
              <span aria-hidden>{formatDigits(code)}</span>
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={copyLink}>
              {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
              {copied ? "اتنسخ" : "انسخ الرابط"}
            </Button>
          </>
        ) : (
          <div role={invitationError ? "alert" : "status"} className="my-10 flex size-52 items-center justify-center rounded-2xl border-4 border-dashed border-ink/40 p-4 text-lg font-semibold">
            {invitationError ?? "بنجهّز الكود…"}
          </div>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Teams with joined players. */}
        <section aria-label="الفريقين" className="paper-card rounded-[1.6rem] border-4 border-ink p-4 shadow-[0_10px_0_var(--color-ink)] sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { number: 1, name: view.teamOneName },
              { number: 2, name: view.teamTwoName },
            ].map((team) => {
              const members = players.filter((m) => m.teamNumber === team.number);
              return (
                <article key={team.number} className="min-w-0">
                  <h3 className={cn("truncate rounded-xl border-[3px] border-ink px-4 py-1.5 font-heading text-3xl", teamTone(team.number).fill)}>{team.name}</h3>
                  <ul aria-label={`لاعبين ${team.name}`} className="mt-3 space-y-2">
                    {members.length === 0 && (
                      <li className="rounded-xl border-[3px] border-dashed border-ink/35 px-4 py-3 text-base font-medium text-ink">
                        مستنيين أول لاعب
                      </li>
                    )}
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-3 rounded-xl border-[3px] border-ink bg-white px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", connected.has(member.id) ? "bg-green" : "bg-charcoal/30")} />
                          <span className="truncate text-lg font-bold">{member.displayName}</span>
                        </span>
                        <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-3 py-0.5 text-sm font-bold", member.ready ? "bg-green text-ink" : "bg-charcoal/10 text-charcoal")}>
                          {member.ready ? <Check className="size-4" aria-hidden strokeWidth={3} /> : <Clock className="size-4" aria-hidden />}
                          {member.ready ? "جاهز" : "مستنيينه"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* The six categories chosen for this game. */}
        <section aria-label="فئات اللعبة" className="paper-card rounded-[1.6rem] border-4 border-ink p-4 shadow-[0_10px_0_var(--color-ink)]">
          <ol className="grid grid-cols-6 gap-2 sm:gap-3">
            {view.selections
              .slice()
              .sort((a, b) => a.boardPosition - b.boardPosition)
              .map((selection, i) => {
                const entry = categories.get(selection.categoryId);
                return (
                  <li key={selection.boardPosition} className="min-w-0">
                    <div className={cn("border-[3px] bg-[#fff8ea]", toneAt(entry?.index ?? i).border)}>
                      <Cover src={entry?.category.coverUrl} name={entry?.category.name ?? "فئة"} sizes="12vw" />
                    </div>
                    <p className="mt-1 hidden truncate text-center text-sm font-bold sm:block">{entry?.category.name}</p>
                  </li>
                );
              })}
          </ol>
        </section>

        <div className="flex flex-wrap items-center gap-4 rounded-[1.6rem] border-4 border-ink bg-cyan p-4 shadow-[0_8px_0_var(--color-ink)]">
          <p role="status" className="min-w-0 flex-1 font-heading text-2xl leading-snug">
            {players.length === 0
              ? "لسه محدش دخل. استنى اللاعبين أو ابدأ."
              : waiting.length > 0
                ? `لسه ${formatDigits(waiting.length)} من اللاعبين مش جاهزين`
                : "كله جاهز. يلا نبدأ!"}
          </p>
          <Button size="lg" onClick={start} disabled={!canStart || starting} className="ring-cream">
            {starting ? "ثانية…" : "ابدأ اللعبة"}
          </Button>
          {problem && (
            <ErrorBanner className="w-full">{problem}</ErrorBanner>
          )}
        </div>
      </div>
    </div>
  );
}
