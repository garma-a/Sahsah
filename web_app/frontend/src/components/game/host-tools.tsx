"use client";

import { Flag, PencilLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { teamTone } from "@/components/brand/tones";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import Input from "@/components/ui/input";
import type { Team, TeamNumber } from "@/lib/api/types";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_TOTAL = 1_000_000;

type HostToolsProps = {
  teams: Team[];
  busy: boolean;
  /** Resolves to an error message, or null once the score is corrected. */
  onAdjust: (team: TeamNumber, targetTotal: string) => Promise<string | null>;
  onEnd: () => void;
};

/**
 * The host's two rare actions, kept apart from the question controls and each behind a confirmation: correcting
 * a team's total (a confirmation step in a dialog) and ending the game early (a second press within five seconds).
 */
export default function HostTools({ teams, busy, onAdjust, onEnd }: HostToolsProps) {
  const [adjusting, setAdjusting] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
      {armed && (
        <p role="status" className="me-auto rounded-xl border-[3px] border-ink bg-cream px-4 py-1.5 text-base font-bold">
          اللعبة هتخلص والنقط هتتثبت. اضغط تاني للتأكيد.
        </p>
      )}
      <Button variant="dark" size="sm" disabled={busy} onClick={() => setAdjusting(true)}>
        <PencilLine aria-hidden className="size-4" />
        صحّح النتيجة
      </Button>
      <Button
        variant={armed ? "default" : "dark"}
        size="sm"
        disabled={busy}
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          onEnd();
        }}
      >
        <Flag aria-hidden className="size-4" />
        {armed ? "متأكد؟ أنهي اللعبة" : "أنهي اللعبة"}
      </Button>
      <AdjustDialog open={adjusting} teams={teams} onAdjust={onAdjust} onClose={() => setAdjusting(false)} />
    </div>
  );
}

function AdjustDialog({ open, teams, onAdjust, onClose }: { open: boolean; teams: Team[]; onAdjust: HostToolsProps["onAdjust"]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="adjust-title"
      className="m-auto w-[min(92vw,32rem)] overflow-visible rounded-[2rem] border-4 border-ink bg-transparent p-0 text-charcoal backdrop:bg-ink/70 backdrop:backdrop-blur-[2px]"
    >
      {open && <AdjustForm teams={teams} onAdjust={onAdjust} onClose={onClose} />}
    </dialog>
  );
}

function AdjustForm({ teams, onAdjust, onClose }: { teams: Team[]; onAdjust: HostToolsProps["onAdjust"]; onClose: () => void }) {
  const [team, setTeam] = useState<TeamNumber>(1);
  const [text, setText] = useState("");
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = teams.find((t) => t.number === team);
  const latin = toLatinDigits(text.trim());
  const target = /^\d{1,7}$/.test(latin) && Number(latin) <= MAX_TOTAL ? Number(latin) : null;
  const before = Number(current?.score ?? 0);
  const delta = target === null ? 0 : target - before;

  async function confirm() {
    if (target === null) return;
    setBusy(true);
    setError(null);
    const failure = await onAdjust(team, String(target));
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <div className="paper rounded-[1.7rem] p-6 shadow-[0_10px_0_var(--color-ink)] sm:p-8">
      <h2 id="adjust-title" className="mb-4 font-heading text-4xl leading-tight">
        صحّح النتيجة
      </h2>
      {step === "edit" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (target !== null) setStep("confirm");
          }}
        >
          <div role="radiogroup" aria-label="الفريق" className="grid grid-cols-2 gap-3">
            {teams.map((t) => (
              <button
                key={t.number}
                type="button"
                role="radio"
                aria-checked={team === t.number}
                onClick={() => {
                  setTeam(t.number as TeamNumber);
                  setText("");
                }}
                className={cn(
                  "min-h-16 cursor-pointer rounded-2xl border-4 border-ink px-3 py-1 font-heading text-2xl leading-tight",
                  teamTone(t.number).fill,
                  team === t.number ? "ring-4 ring-ink ring-offset-2 ring-offset-cream" : "opacity-60",
                )}
              >
                <span className="line-clamp-2 break-words">{t.name}</span>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-base font-bold">النتيجة الجديدة (دلوقتي {formatNumber(before)})</span>
            <Input
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={text !== "" && target === null}
              aria-describedby="adjust-hint"
              placeholder={formatNumber(before)}
              className="text-center font-heading text-3xl"
            />
          </label>
          <p id="adjust-hint" className={cn("text-sm font-semibold", text !== "" && target === null && "text-destructive")}>
            اكتب رقم من ٠ لـ {formatNumber(MAX_TOTAL)}. إجابات الأسئلة نفسها مش هتتغير.
          </p>
          <div className="flex gap-3">
            <Button type="submit" disabled={target === null} className="flex-1">
              راجع
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-lg font-semibold">
            «{current?.name}» هتتغير نتيجته من <b className="tabular">{formatNumber(before)}</b> إلى <b className="tabular">{formatNumber(target ?? 0)}</b>
            {delta !== 0 && (
              <span className="tabular">
                {" "}
                ({delta > 0 ? "زيادة" : "نقص"} {formatNumber(Math.abs(delta))})
              </span>
            )}
            .
          </p>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex gap-3">
            <Button type="button" disabled={busy} onClick={confirm} className="flex-1">
              {busy ? "ثانية…" : "أكّد التغيير"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep("edit")}>
              رجوع
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
