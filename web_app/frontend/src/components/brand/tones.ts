// Colour pairs used to tell categories apart: poster borders, name ribbons, shelf rules and
// board columns. Every fill/ink pair clears WCAG AA (checked against the brand hexes); the
// raw red, orange-red and pink fail with either ink so they appear only as borders.
export type Tone = {
  /** Poster frame. */
  border: string;
  /** Name ribbon: fill plus readable ink. */
  ribbon: string;
  /** Board tile: fill plus readable ink. */
  tile: string;
  /** Section rule under a shelf heading. */
  rule: string;
};

export const tones: Tone[] = [
  { border: "border-red", ribbon: "bg-press text-white", tile: "bg-green text-ink", rule: "bg-red" },
  { border: "border-cyan", ribbon: "bg-cyan text-ink", tile: "bg-amber text-ink", rule: "bg-pink" },
  { border: "border-green", ribbon: "bg-green text-ink", tile: "bg-cyan text-ink", rule: "bg-logo-blue" },
  { border: "border-pink", ribbon: "bg-maroon text-white", tile: "bg-logo-blue text-white", rule: "bg-teal" },
  { border: "border-logo-blue", ribbon: "bg-logo-blue text-white", tile: "bg-maroon text-white", rule: "bg-press" },
  { border: "border-sun", ribbon: "bg-sun text-ink", tile: "bg-teal text-white", rule: "bg-maroon" },
];

/** The two teams keep one colour everywhere: setup cards, lobby columns, tile winners and scores. */
export function teamTone(number: number): { fill: string; edge: string } {
  return number === 1 ? { fill: "bg-cyan text-ink", edge: "border-cyan" } : { fill: "bg-sun text-ink", edge: "border-sun" };
}

export function toneAt(index: number): Tone {
  return tones[((index % tones.length) + tones.length) % tones.length];
}
