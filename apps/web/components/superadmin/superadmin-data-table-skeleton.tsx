import { Skeleton } from "@/components/ui/skeleton";

export function SuperadminDataTableSkeleton({
  columnCount = 6,
  rowCount = 8,
}: {
  columnCount?: number;
  rowCount?: number;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-card"
      aria-busy="true"
    >
      <div className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex min-w-[640px] gap-6">
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20 shrink-0 rounded-md" />
          ))}
        </div>
      </div>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex min-w-[640px] gap-6 border-b border-border/40 px-4 py-3 last:border-0"
        >
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 w-full max-w-[8rem] shrink-0 rounded-md"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
