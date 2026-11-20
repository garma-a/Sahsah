import type { JsonObject } from "../../database/schema/types.js";
import { StaffError } from "../staff-service.js";

export const PAGE_SLUGS = ["about", "privacy", "terms", "faq"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

/** Limits shared by the admin forms and the database checks. */
export const LIMITS = { title: 120, body: 500, label: 60, link: 500, pageTitle: 120, pageBody: 20000, faqItems: 50, question: 200, answer: 2000 } as const;

const refuse = (code: string): never => {
  throw new StaffError(code);
};

function text(value: unknown, code: string, max: number, required: boolean): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return required ? refuse(`${code}_required`) : null;
  if (trimmed.length > max) return refuse(`${code}_too_long`);
  return trimmed;
}

/** Only an https address or a same-site path; never a protocol-relative address or a backslash. */
export function cleanLink(value: string): string {
  if (/[\s\\\u0000-\u001f]/.test(value) || value.length > LIMITS.link) return refuse("invalid_link");
  if (value.startsWith("/")) return value === "/" || !value.startsWith("//") ? value : refuse("invalid_link");
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname && !url.username && !url.password) return value;
  } catch {
    // falls through
  }
  return refuse("invalid_link");
}

function instant(value: unknown, code: string, required: boolean): string | null {
  if (value === undefined || value === null || value === "") return required ? refuse(`${code}_required`) : null;
  const date = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) return refuse(`invalid_${code}`);
  return date.toISOString();
}

export function cleanAnnouncement(input: unknown) {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const linkLabel = text(raw.linkLabel, "link_label", LIMITS.label, false);
  const rawUrl = text(raw.linkUrl, "link_url", LIMITS.link, false);
  if (!!linkLabel !== !!rawUrl) refuse("link_incomplete");
  const startsAt = instant(raw.startsAt, "starts_at", true)!, endsAt = instant(raw.endsAt, "ends_at", false);
  if (endsAt && endsAt <= startsAt) refuse("window_invalid");
  return {
    titleAr: text(raw.titleAr, "title", LIMITS.title, true)!,
    titleFranco: text(raw.titleFranco, "title_franco", LIMITS.title, false),
    bodyAr: text(raw.bodyAr, "announcement_body", LIMITS.body, true)!,
    bodyFranco: text(raw.bodyFranco, "announcement_body_franco", LIMITS.body, false),
    linkLabel,
    linkUrl: rawUrl ? cleanLink(rawUrl) : null,
    startsAt,
    endsAt,
  };
}

/**
 * Fixed renderer schema (version 1). Text pages hold plain text: blank lines separate paragraphs, a line
 * starting "## " is a heading and "- " a list item. The site renders it as text, never as HTML.
 */
export function cleanPageContent(slug: PageSlug, input: unknown): JsonObject {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: JsonObject = { titleAr: text(raw.titleAr, "page_title", LIMITS.pageTitle, true)! };
  const franco = text(raw.titleFranco, "page_title_franco", LIMITS.pageTitle, false);
  if (franco) out.titleFranco = franco;
  if (slug === "faq") {
    const items = Array.isArray(raw.items) ? raw.items : [];
    if (!items.length) refuse("faq_items_required");
    if (items.length > LIMITS.faqItems) refuse("faq_items_too_many");
    out.items = items.map((item) => {
      const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const entry: JsonObject = { questionAr: text(r.questionAr, "question", LIMITS.question, true)!, answerAr: text(r.answerAr, "answer", LIMITS.answer, true)! };
      const qf = text(r.questionFranco, "question_franco", LIMITS.question, false), af = text(r.answerFranco, "answer_franco", LIMITS.answer, false);
      if (qf) entry.questionFranco = qf;
      if (af) entry.answerFranco = af;
      return entry;
    });
    return out;
  }
  out.bodyAr = text(raw.bodyAr, "page_body", LIMITS.pageBody, true)!;
  const bodyFranco = text(raw.bodyFranco, "page_body_franco", LIMITS.pageBody, false);
  if (bodyFranco) out.bodyFranco = bodyFranco;
  return out;
}

const PHONE = /^\+?[0-9][0-9 ()-]{5,23}$/;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export const SETTING_KEYS = ["supportPhone", "whatsapp", "supportEmail", "facebookUrl", "instagramUrl", "tiktokUrl"] as const;

/** Empty fields are left out; socials must be https addresses. */
export function cleanSettings(input: unknown): JsonObject {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: JsonObject = {};
  for (const key of ["supportPhone", "whatsapp"] as const) {
    const value = text(raw[key], key, 24, false);
    if (value) out[key] = PHONE.test(value) ? value : refuse(`invalid_${key}`);
  }
  const email = text(raw.supportEmail, "support_email", 254, false);
  if (email) out.supportEmail = EMAIL.test(email) ? email : refuse("invalid_support_email");
  for (const key of ["facebookUrl", "instagramUrl", "tiktokUrl"] as const) {
    const value = text(raw[key], key, LIMITS.link, false);
    if (value) out[key] = value.startsWith("https://") ? cleanLink(value) : refuse(`invalid_${key}`);
  }
  return out;
}
