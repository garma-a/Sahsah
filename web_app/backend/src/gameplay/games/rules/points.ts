export const slotPoints = (slot: number) =>
  slot <= 2 ? 200 : slot <= 4 ? 400 : 600;
export function defaultPointStages(cap: 200 | 400 | 600) {
  return { 200: [200, 150, 50], 400: [400, 250, 150], 600: [600, 400, 200] }[
    cap
  ];
}
export function validPointStages(suggestions: number[], cap: number) {
  return (
    suggestions[0] === cap &&
    suggestions.every(
      (n, i) => n <= cap && (!i || n < (suggestions[i - 1] ?? Infinity)),
    )
  );
}
