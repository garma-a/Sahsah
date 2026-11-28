type Environment = Record<string, string | undefined>;

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend answers a repeat of the same key with the first result, so a retry never sends twice. */
  idempotencyKey: string;
};

export type SendResult = { ok: true; providerId: string | null } | { ok: false; code: MailFailure };

/** What staff are told; the provider's own wording never reaches the page or the logs. */
export type MailFailure = "provider_denied" | "provider_rejected" | "provider_busy" | "provider_unavailable" | "provider_timeout";

export type Mailer = { send(email: OutgoingEmail): Promise<SendResult>; from: string };

const DEFAULT_API = "https://api.resend.com";
const TIMEOUT_MS = 15_000;

/**
 * Email goes out through Resend's HTTPS API (Railway Hobby blocks SMTP). Without RESEND_API_KEY
 * there is no mailer and the dashboard offers a mailto: link instead.
 */
export function createMailer(env: Environment): Mailer | undefined {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return undefined;
  const from = env.SUPPORT_FROM_EMAIL?.trim();
  if (!from || /[\r\n]/.test(from)) throw new Error("SUPPORT_FROM_EMAIL is required when RESEND_API_KEY is set.");
  const replyTo = env.SUPPORT_REPLY_TO?.trim();
  if (replyTo && /[\r\n]/.test(replyTo)) throw new Error("SUPPORT_REPLY_TO must be a single address.");
  // The base address can only be redirected outside production (tests point it at a local stub).
  const base = env.NODE_ENV === "production" ? DEFAULT_API : (env.RESEND_API_URL?.trim() || DEFAULT_API).replace(/\/+$/, "");
  return {
    from,
    async send(email) {
      let response: Response;
      try {
        response = await fetch(`${base}/emails`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": email.idempotencyKey },
          body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html, ...(replyTo ? { reply_to: replyTo } : {}) }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        // A timeout leaves it unknown whether the email left; the page says so.
        return { ok: false, code: (error as Error)?.name === "TimeoutError" ? "provider_timeout" : "provider_unavailable" };
      }
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
        return { ok: true, providerId: typeof body?.id === "string" ? body.id.slice(0, 200) : null };
      }
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403) return { ok: false, code: "provider_denied" };
      if (response.status === 429) return { ok: false, code: "provider_busy" };
      if (response.status >= 500) return { ok: false, code: "provider_unavailable" };
      return { ok: false, code: "provider_rejected" };
    },
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Every character of staff and player text is escaped; only the wrapper markup is ours. */
export function renderReply(body: string, original: string | null) {
  const paragraphs = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const quoted = original ? original.split(/\r?\n/).map((line) => `> ${line}`).join("\n") : "";
  return {
    text: original ? `${body}\n\n---\nYour message:\n${quoted}\n` : `${body}\n`,
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5"><p>${paragraphs(body)}</p>${original ? `<hr><p style="color:#555"><small>Your message:</small><br>${paragraphs(original)}</p>` : ""}</div>`,
  };
}
