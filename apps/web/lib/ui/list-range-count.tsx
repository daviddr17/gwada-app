import { cn } from "@/lib/utils";

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
      <span className="font-medium text-foreground">{shown}</span>
      {" von "}
      <span className="font-medium text-foreground">{total}</span>{" "}
      {itemLabel}
    </p>
  );
}
