"use client";

import { useId, useState, type FormEvent } from "react";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import Input from "@/components/ui/input";
import { previewSession } from "@/lib/api/endpoints";
import { messageOf } from "@/lib/api/errors";
import { useIdentityApi } from "@/providers/game-store-provider";

type SessionFormProps = { onDone: () => void; onCancel?: () => void; defaultName?: string };

/** First visit on this browser: the shared preview passcode once, then the host's name. */
export default function SessionForm({ onDone, onCancel, defaultName = "" }: SessionFormProps) {
  const identity = useIdentityApi();
  const ids = { passcode: useId(), name: useId(), error: useId() };
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const displayName = name.trim();
    if (!passcode.trim() || !displayName) {
      setError("اكتب الكود السري واسمك الأول.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await previewSession({ passcode: passcode.trim(), displayName });
      identity.getState().setHost({
        credential: session.credential,
        expiresAt: session.expiresAt,
        accountId: session.accountId,
        displayName: session.displayName,
      });
      onDone();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby={error ? ids.error : undefined} noValidate>
      <div className="space-y-2">
        <label htmlFor={ids.passcode} className="block font-heading text-2xl">
          الكود السري
        </label>
        <Input
          id={ids.passcode}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="ltr"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          aria-invalid={error && !passcode.trim() ? true : undefined}
          maxLength={200}
          className="text-start"
        />
        <p className="text-sm font-medium text-ink">بتكتبه مرة واحدة بس على الجهاز ده.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.name} className="block font-heading text-2xl">
          اسمك
        </label>
        <Input
          id={ids.name}
          autoComplete="nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error && !name.trim() ? true : undefined}
          maxLength={80}
          placeholder="اسمك اللي هيظهر للاعبين"
        />
      </div>
      {error && <ErrorBanner id={ids.error}>{error}</ErrorBanner>}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "ثانية…" : "يلا"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </form>
  );
}
