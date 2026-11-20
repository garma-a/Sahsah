"use client";

import { useId, useState, type FormEvent } from "react";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import Input from "@/components/ui/input";
import StatusCard from "@/components/ui/status-card";
import { ApiError, type Auth } from "@/lib/api/client";
import { sendContact } from "@/lib/api/endpoints";
import { GENERIC_ERROR } from "@/lib/api/errors";
import { contactProblemMessage } from "@/lib/api/problems";
import type { ContactRequest } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useIntentKeys } from "@/lib/use-intent-keys";
import { useRadioGroup } from "@/lib/use-radio-group";
import { useIdentity } from "@/providers/game-store-provider";

type Kind = ContactRequest["kind"];
const KINDS = ["support", "business", "experience"] as const;
const KIND_LABEL: Record<Kind, string> = { support: "مساعدة", business: "تعاون", experience: "رأيك في اللعبة" };
const REASONS = { technical: "مشكلة تقنية", purchase: "مشكلة في الشراء", account: "مشكلة في الحساب" } as const;
const BUSINESS = { business: "شركة أو براند", influencer: "صانع محتوى" } as const;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const field = "flex h-14 w-full rounded-2xl border-[3px] border-ink bg-white px-4 text-lg font-medium text-ink shadow-[0_3px_0_var(--color-ink)]";

/** The three contact forms. Success is shown only after the API stored the message; a retry reuses the same key. */
export default function ContactForm() {
  const host = useIdentity((s) => s.host);
  const keys = useIntentKeys();
  const ids = { reason: useId(), business: useId(), email: useId(), handle: useId(), name: useId(), message: useId(), error: useId(), rating: useId() };
  const [kind, setKind] = useState<Kind>("support");
  const [reason, setReason] = useState<keyof typeof REASONS>("technical");
  const [businessKind, setBusinessKind] = useState<keyof typeof BUSINESS>("business");
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const kindItem = useRadioGroup(KINDS, kind, setKind);
  const ratingItem = useRadioGroup([1, 2, 3, 4, 5] as const, rating, setRating);

  // A validation or send error describes the form as it was submitted: any edit makes it stale, so it goes.
  function edit<T>(set: (value: T) => void, value: T) {
    set(value);
    setError(null);
  }

  function build(): ContactRequest | string {
    const text = message.trim(), mail = email.trim(), common = { ...(name.trim() ? { name: name.trim() } : {}), ...(website ? { website } : {}) };
    if (kind === "experience") {
      if (rating === null && !text) return "اختار تقييم أو اكتب رأيك.";
      if (mail && !EMAIL.test(mail)) return "الإيميل مش مظبوط.";
      return { kind, ...(rating !== null ? { rating } : {}), ...(text ? { message: text } : {}), ...(mail ? { email: mail } : {}), ...common };
    }
    if (!EMAIL.test(mail)) return "اكتب إيميلك عشان نقدر نرد عليك.";
    if (text.length < 5) return "اكتب رسالتك (٥ حروف على الأقل).";
    if (kind === "support") return { kind, reason, email: mail, message: text, ...common };
    return { kind, businessKind, email: mail, message: text, ...(handle.trim() ? { handle: handle.trim() } : {}), ...common };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = build();
    if (typeof body === "string") {
      setError(body);
      return;
    }
    const auth: Auth = host ? { kind: "account", credential: host.credential } : { kind: "none" };
    // The same message from the same sender keeps one key until it is stored, so a retry never sends it twice.
    const signature = JSON.stringify([body, host?.accountId ?? null]);
    setBusy(true);
    setError(null);
    try {
      await sendContact(auth, keys.key(signature), body);
      keys.done(signature);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? contactProblemMessage(cause.code, cause.status) : GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setMessage("");
    setRating(null);
    setHandle("");
    setSent(false);
  }

  if (sent)
    return (
      <StatusCard
        title="وصلتنا رسالتك"
        text={kind === "experience" ? "شكرا إنك شاركتنا رأيك." : "هنقرا رسالتك ونرد عليك على الإيميل اللي كتبته."}
        className="border-0 p-0 shadow-none"
      >
        <Button variant="dark" size="sm" onClick={again}>
          ابعت رسالة تانية
        </Button>
      </StatusCard>
    );

  const label = "block font-heading text-2xl";
  return (
    <form onSubmit={submit} noValidate aria-describedby={error ? ids.error : undefined} className="space-y-5">
      <h1 className="font-heading text-5xl leading-tight">تواصل معانا</h1>
      <div role="radiogroup" aria-label="نوع الرسالة" className="flex flex-wrap gap-2">
        {KINDS.map((item) => (
          <button
            key={item}
            type="button"
            {...kindItem(item)}
            onClick={() => edit(setKind, item)}
            className={cn("h-11 rounded-full border-[3px] border-ink px-5 font-heading text-lg", kind === item ? "bg-ink text-cream" : "bg-cream hover:bg-sun")}
          >
            {KIND_LABEL[item]}
          </button>
        ))}
      </div>

      {kind === "support" && (
        <div className="space-y-2">
          <label htmlFor={ids.reason} className={label}>
            المشكلة في إيه؟
          </label>
          <select id={ids.reason} value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REASONS)} className={field}>
            {Object.entries(REASONS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
      )}
      {kind === "business" && (
        <div className="space-y-2">
          <label htmlFor={ids.business} className={label}>
            إنت مين؟
          </label>
          <select id={ids.business} value={businessKind} onChange={(e) => setBusinessKind(e.target.value as keyof typeof BUSINESS)} className={field}>
            {Object.entries(BUSINESS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
      )}
      {kind === "experience" && (
        <div className="space-y-2">
          <p id={ids.rating} className={label}>
            تقييمك للعبة
          </p>
          <div role="radiogroup" aria-labelledby={ids.rating} className="flex gap-2" dir="ltr">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                {...ratingItem(value)}
                aria-label={`${value} من ٥`}
                onClick={() => edit(setRating, value)}
                className={cn("size-12 rounded-full border-[3px] border-ink text-2xl leading-none", rating !== null && value <= rating ? "bg-sun" : "bg-white hover:bg-sun/40")}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={ids.email} className={label}>
          الإيميل{kind === "experience" && <span className="text-base font-medium"> (اختياري)</span>}
        </label>
        <Input id={ids.email} type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => edit(setEmail, e.target.value)} maxLength={254} className="text-start" />
      </div>
      {kind === "business" && (
        <div className="space-y-2">
          <label htmlFor={ids.handle} className={label}>
            حسابك على السوشيال <span className="text-base font-medium">(اختياري)</span>
          </label>
          <Input id={ids.handle} dir="ltr" value={handle} onChange={(e) => edit(setHandle, e.target.value)} maxLength={80} className="text-start" />
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor={ids.name} className={label}>
          اسمك <span className="text-base font-medium">(اختياري)</span>
        </label>
        <Input id={ids.name} autoComplete="name" value={name} onChange={(e) => edit(setName, e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-2">
        <label htmlFor={ids.message} className={label}>
          رسالتك{kind === "experience" && <span className="text-base font-medium"> (اختياري لو اخترت تقييم)</span>}
        </label>
        <textarea
          id={ids.message}
          value={message}
          onChange={(e) => edit(setMessage, e.target.value)}
          maxLength={1000}
          rows={6}
          className="w-full rounded-2xl border-[3px] border-ink bg-white p-4 text-lg font-medium text-ink shadow-[0_3px_0_var(--color-ink)]"
        />
      </div>
      {/* Honeypot: invisible to people and to screen readers; a bot that fills it is quietly ignored. */}
      <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>
          الموقع
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
        </label>
      </div>

      {error && <ErrorBanner id={ids.error}>{error}</ErrorBanner>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "ثانية…" : "ابعت"}
      </Button>
    </form>
  );
}
