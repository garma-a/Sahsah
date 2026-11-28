/** An Egyptian mobile number in any common spelling, as +20XXXXXXXXXX; undefined when it is none. */
export function normalizePhone(raw: string): string | undefined {
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  const international = cleaned.startsWith("+");
  const digits = international ? cleaned.slice(1) : cleaned;
  if (!/^\d+$/.test(digits)) return undefined;
  let full: string | undefined;
  if (international) full = digits;
  else if (digits.startsWith("0020")) full = digits.slice(2);
  else if (digits.startsWith("20") && digits.length === 12) full = digits;
  else if (digits.startsWith("01") && digits.length === 11) full = `2${digits}`;
  else if (digits.startsWith("1") && digits.length === 10) full = `20${digits}`;
  return full && /^20\d{10}$/.test(full) ? `+${full}` : undefined;
}

/** Splits pasted text (one number per line, or separated by commas or spaces). */
export function parsePhoneList(raw: string) {
  const phones = new Set<string>(), invalid: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    if (!token) continue;
    const phone = normalizePhone(token);
    if (phone) phones.add(phone);
    else if (!invalid.includes(token)) invalid.push(token);
  }
  return { phones: [...phones], invalid };
}
