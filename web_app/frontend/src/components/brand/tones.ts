// Colour pairs used to tell categories apart. Every fill/ink pair clears WCAG AA (checked against the brand hexes).
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

// A column keeps one colour family: the poster border, the name ribbon and the tiles. Where a raw brand
// colour fails AA with either ink (red, orange-red, pink), the ribbon and tiles use its darker "press"
// variant (press, pink-press) and the raw colour stays on the poster border only.
export const tones: Tone[] = [
  { border: "border-red", ribbon: "bg-press text-white", tile: "bg-press text-white", rule: "bg-red" },
  { border: "border-cyan", ribbon: "bg-cyan text-ink", tile: "bg-cyan text-ink", rule: "bg-pink-press" },
  { border: "border-green", ribbon: "bg-green text-ink", tile: "bg-green text-ink", rule: "bg-logo-blue" },
  { border: "border-pink", ribbon: "bg-pink-press text-white", tile: "bg-pink-press text-white", rule: "bg-teal" },
  { border: "border-logo-blue", ribbon: "bg-logo-blue text-white", tile: "bg-logo-blue text-white", rule: "bg-press" },
  { border: "border-sun", ribbon: "bg-sun text-ink", tile: "bg-sun text-ink", rule: "bg-maroon" },
];

/** The two teams keep one colour everywhere: setup cards, lobby columns, tile winners and scores. */
export function teamTone(number: number): { fill: string; edge: string; score: string } {
  return number === 1
    ? { fill: "bg-cyan text-ink", edge: "border-cyan", score: "text-cyan" }
    : { fill: "bg-sun text-ink", edge: "border-sun", score: "text-sun" };
}

export function toneAt(index: number): Tone {
  return tones[((index % tones.length) + tones.length) % tones.length];
}
