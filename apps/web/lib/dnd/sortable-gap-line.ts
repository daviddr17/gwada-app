import type { SortableDropPlacement } from "@/lib/hooks/use-sortable-reorder";

/** Visuelle Zeile *vor* der der Akzent-Strich sitzt („before“ / „after“ auf Hover-Zeile). */
export function gapBeforeRowIndex(
  overIndex: number,
  placement: SortableDropPlacement,
): number {
  return placement === "before" ? overIndex : overIndex + 1;
}

export type SortableGapLineRect = {
  top: number;
  left: number;
  width: number;
};

/** Strich mittig im Zwischenraum zwischen zwei Zeilen (gleicher Abstand zu beiden). */
export function measureSortableGapLine<TId extends string>(
  gapBeforeRow: number,
  itemIds: readonly TId[],
  itemRefs: Map<TId, HTMLElement>,
): SortableGapLineRect | null {
  const n = itemIds.length;
  if (n === 0) return null;

  if (gapBeforeRow <= 0) {
    const el = itemRefs.get(itemIds[0]!);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width };
  }

  if (gapBeforeRow >= n) {
    const el = itemRefs.get(itemIds[n - 1]!);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.bottom, left: r.left, width: r.width };
  }

  const prev = itemRefs.get(itemIds[gapBeforeRow - 1]!);
  const next = itemRefs.get(itemIds[gapBeforeRow]!);
  if (prev && next) {
    const rp = prev.getBoundingClientRect();
    const rn = next.getBoundingClientRect();
    return {
      top: (rp.bottom + rn.top) / 2,
      left: Math.min(rp.left, rn.left),
      width: Math.max(rp.width, rn.width),
    };
  }

  const el = itemRefs.get(itemIds[gapBeforeRow]!);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width };
}
