/**
 * Staff-entered links are checked again where they are shown: an https address or a path on this site,
 * nothing else (no javascript:, no protocol-relative address).
 */
export function linkKind(url: string | undefined): "internal" | "external" | null {
  if (!url || /[\s\\]/.test(url)) return null;
  if (url === "/" || (url.startsWith("/") && !url.startsWith("//"))) return "internal";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname ? "external" : null;
  } catch {
    return null;
  }
}

/** A WhatsApp chat address from a phone number typed the way people write it; Egyptian local numbers start with 0. */
export function whatsappLink(number: string): string | null {
  let digits = number.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `20${digits.slice(1)}`;
  return /^[0-9]{8,15}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

export function telLink(number: string): string | null {
  const cleaned = number.replace(/[^0-9+]/g, "");
  return /^\+?[0-9]{6,20}$/.test(cleaned) ? `tel:${cleaned}` : null;
}
