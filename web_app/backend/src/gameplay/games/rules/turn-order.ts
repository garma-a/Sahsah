/** The host occupies seat one; the remaining stable membership IDs order seats. */
export function orderSeats<T extends { id: string; accountId: string | null }>(
  roster: T[],
  hostAccountId: string,
): T[] {
  return [...roster].sort((a, b) =>
    a.accountId === hostAccountId
      ? -1
      : b.accountId === hostAccountId
        ? 1
        : a.id < b.id
          ? -1
          : 1,
  );
}
