import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatInsightsTrendPercent } from "@/lib/insights/insights-period-trend";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  /**
   * Period-over-period % vs previous equal range.
   * Smaller colored label next to the value (green up / red down).
   */
  trendPercent?: number | null;
};

function trendClassName(percent: number): string {
  if (percent > 0) return "text-emerald-600 dark:text-emerald-400";
  if (percent < 0) return "text-destructive";
  return "text-muted-foreground";
}

/** KPI-Zähler — vertikales Padding nur über Card (`py-4`), nicht doppelt in CardContent. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  trendPercent,
}: KpiCardProps) {
  const showTrend = typeof trendPercent === "number";
  return (
    <Card className={cn("border-border/50 shadow-card", className)}>
      <CardContent className={Icon ? "flex gap-3" : undefined}>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
              Icon ? "mt-0.5" : "mt-1",
            )}
          >
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
            {showTrend ? (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  trendClassName(trendPercent),
                )}
                title="Veränderung gegenüber dem vorherigen gleichlangen Zeitraum"
              >
                {formatInsightsTrendPercent(trendPercent)}
              </span>
            ) : null}
          </div>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
