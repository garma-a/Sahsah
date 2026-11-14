// One shared formatter: every number the player sees uses Arabic-Indic digits.
const grouped = new Intl.NumberFormat("ar-EG", { useGrouping: true });
const plain = new Intl.NumberFormat("ar-EG", { useGrouping: false });

/** Scores, point values and counts, grouped with the Arabic thousands separator: ١٥٬٠٠٠. */
export function formatNumber(value: number | string): string {
  return grouped.format(typeof value === "string" ? Number(value) : value);
}

/** Digits without grouping, for room codes and counters such as ٣/٦. */
export function formatDigits(value: number | string): string {
  if (typeof value === "number") return plain.format(value);
  return value.replace(/[0-9]/g, (digit) => plain.format(Number(digit)));
}

/** Accepts Latin or Arabic-Indic digits typed by a player and returns Latin digits. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}
