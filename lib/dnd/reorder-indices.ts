/** Zielindex nach Entfernen von `fromIndex` (Liste sortierbar per splice). */
export function computeReorderInsertIndex(
  fromIndex: number,
  overIndex: number,
  placement: "before" | "after",
): number {
  let to = overIndex;
  if (placement === "after") to = overIndex + 1;
  if (fromIndex < to) to -= 1;
  return Math.max(0, to);
}

export function reorderArray<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (fromIndex === toIndex) return [...items];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
