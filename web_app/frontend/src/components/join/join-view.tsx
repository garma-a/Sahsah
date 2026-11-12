"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import JoinShell from "@/components/join/join-shell";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { joinRoom, previewInvitation } from "@/lib/api/endpoints";
import type { InvitationPreview, TeamNumber } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { newOperationId, newSecret } from "@/lib/ids";
import { useIdentity, useIdentityApi } from "@/providers/game-store-provider";
import { cn } from "@/lib/utils";

type Preview = { status: "loading" } | { status: "error"; error: ApiError } | { status: "ready"; preview: InvitationPreview };

/** /join/<code>: no account, just a name and a team. The seat proof stays in this browser. */
export default function JoinView({ code }: { code: string }) {
  const router = useRouter();
  const identity = useIdentityApi();
  const hydrated = useIdentity((s) => s.hydrated);
  const savedName = useIdentity((s) => s.guestName);
  const ids = { name: useId(), error: useId() };
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [name, setName] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamNumber | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    previewInvitation(code, controller.signal)
      .then((result) => setPreview({ status: "ready", preview: result }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPreview({ status: "error", error: error instanceof ApiError ? error : new ApiError(0, "NETWORK") });
      });
    return () => controller.abort();
  }, [code]);

  const shownName = name ?? savedName;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const displayName = shownName.trim();
    if (!displayName || team === null) {
      setProblem(!displayName ? "اكتب اسمك الأول." : "اختار فريقك.");
      return;
    }
    setBusy(true);
    setProblem(null);
    // Key and secret are saved before sending: if the answer is lost, the retry recovers the same seat.
    let pending = identity.getState().pendingJoin;
    if (!pending || pending.code !== code || pending.displayName !== displayName || pending.teamNumber !== team) {
      pending = { code, operationId: newOperationId(), secret: newSecret(), displayName, teamNumber: team };
      identity.getState().setPendingJoin(pending);
    }
    try {
      const receipt = await joinRoom(code, pending.operationId, {
        displayName,
        teamNumber: team,
        reconnectSecret: pending.secret,
      });
      if (!receipt.membershipId) throw new ApiError(500, "INTERNAL_ERROR");
      identity.getState().setGuestSeat(receipt.roomId, { membershipId: receipt.membershipId, secret: pending.secret, displayName });
      identity.getState().setPendingJoin(null);
      router.replace(`/room/${receipt.roomId}`);
    } catch (cause) {
      setProblem(cause instanceof ApiError ? cause.message : "حصلت مشكلة. جرّب تاني.");
      setBusy(false);
    }
  }

  if (preview.status === "loading" || !hydrated) {
    return (
      <JoinShell>
        <p role="status" className="py-10 text-center font-heading text-3xl">
          بندوّر على الغرفة…
        </p>
      </JoinShell>
    );
  }

  if (preview.status === "error") {
    return (
      <JoinShell>
        <div role="alert" className="space-y-4 text-center">
          <h1 className="font-heading text-4xl">الكود مش شغال</h1>
          <p className="text-lg font-medium">{preview.error.message}</p>
          <Button asChild>
            <Link href="/join">جرّب كود تاني</Link>
          </Button>
        </div>
      </JoinShell>
    );
  }

  const { preview: room } = preview;
  if (!room.joinable) {
    const text = room.admission === "paused" ? "السيرفر زحمة دلوقتي. جرّب تاني كمان شوية." : room.availableSeats === 0 ? "الغرفة اتملت. أقصى عدد ٦ لاعبين." : "الغرفة دي مش بتستقبل لاعبين دلوقتي.";
    return (
      <JoinShell>
        <div role="alert" className="space-y-4 text-center">
          <h1 className="font-heading text-4xl">مش هينفع تدخل</h1>
          <p className="text-lg font-medium">{text}</p>
          <Button asChild variant="outline">
            <Link href="/join">كود تاني</Link>
          </Button>
        </div>
      </JoinShell>
    );
  }

  const teams = [
    { number: 1 as const, name: room.teamOneName },
    { number: 2 as const, name: room.teamTwoName },
  ];

  return (
    <JoinShell>
      <form onSubmit={submit} noValidate className="space-y-6" aria-describedby={problem ? ids.error : undefined}>
        <div className="text-center">
          <h1 className="font-heading text-4xl leading-tight">يلا ندخل اللعبة</h1>
          <p className="mt-1 text-base font-medium text-charcoal/80">
            في {formatDigits(room.availableSeats)} أماكن فاضية.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor={ids.name} className="block font-heading text-2xl">
            اسمك
          </label>
          <Input
            id={ids.name}
            value={shownName}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoComplete="nickname"
            placeholder="اسمك اللي هيظهر للكل"
            aria-invalid={problem && !shownName.trim() ? true : undefined}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-1 font-heading text-2xl">اختار فريقك</legend>
          <div className="grid grid-cols-2 gap-3">
            {teams.map((option) => {
              const selected = team === option.number;
              return (
                <button
                  key={option.number}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTeam(option.number)}
                  className={cn(
                    "flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-4 border-ink px-2 py-3 font-heading text-2xl leading-tight transition-[transform,box-shadow]",
                    teamTone(option.number).fill,
                    selected ? "-translate-y-1 shadow-[0_8px_0_var(--color-ink)]" : "opacity-85 shadow-[0_4px_0_var(--color-ink)]",
                  )}
                >
                  <span className="max-w-full truncate">{option.name}</span>
                  <span className="flex items-center gap-1 font-sans text-sm font-bold">
                    {selected ? (
                      <>
                        <Check className="size-4" aria-hidden strokeWidth={3} /> اخترت
                      </>
                    ) : (
                      "اضغط للاختيار"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {problem && (
          <p id={ids.error} role="alert" className="rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-3 font-semibold text-[#8c1c15]">
            {problem}
          </p>
        )}

        <Button type="submit" size="xl" className="w-full" disabled={busy}>
          {busy ? "ثانية…" : "ادخل الغرفة"}
        </Button>
      </form>
    </JoinShell>
  );
}
