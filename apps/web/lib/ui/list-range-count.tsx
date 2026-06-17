import { cn } from "@/lib/utils";

/** Kompakt: `12/45 Beiträge` */
export function formatListRangeLabel(
  shown: number,
  total: number,
  itemLabel: string,
): string {
  return `${shown}/${total} ${itemLabel}`;
}

/** Nur x/y Label ohne Seitenangabe. */
export function formatListRangeSummaryPart({
  shown,
  totalCount,
  itemLabel,
}: {
  shown?: number;
  totalCount?: number;
  itemLabel?: string;
}): string | null {
  if (totalCount == null || !itemLabel?.trim()) return null;
  const displayShown = shown ?? totalCount;
  return formatListRangeLabel(displayShown, totalCount, itemLabel.trim());
}

/** Kompakt: `12/45 Beiträge · Seite 2/3` (Seite nur bei mehr als einer Seite). */
export function formatListPageSummary({
  shown,
  totalCount,
  itemLabel,
  page,
  totalPages,
}: {
  shown?: number;
  totalCount?: number;
  itemLabel?: string;
  page: number;
  totalPages: number;
}): string | null {
  if (totalCount == null || !itemLabel?.trim()) return null;

  const range = formatListRangeSummaryPart({ shown, totalCount, itemLabel });
  if (!range) return null;

  if (totalPages > 1) {
    return `${range} · Seite ${page}/${totalPages}`;
  }

  return range;
}

export function ListRangeCount({
  shown,
  total,
  itemLabel,
  className,
}: {
  shown: number;
  total: number;
  itemLabel: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-sm text-muted-foreground tabular-nums",
        className,
      )}
    >
      {formatListRangeLabel(shown, total, itemLabel)}
    </p>
  );
}
