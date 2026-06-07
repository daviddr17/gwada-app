"use client";

import { Clock, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  shiftPlanPeriodCoverageNotes,
  shiftPlanPeriodWageLabel,
  type ShiftPlanPeriodSummary,
} from "@/lib/staff/shift-plan-period-summary";
import { formatScheduledHoursMinutes } from "@/lib/types/staff-shift-schedule";
import { cn } from "@/lib/utils";

type ShiftPlanPeriodSummaryBarProps = {
  summary: ShiftPlanPeriodSummary;
  className?: string;
};

export function ShiftPlanPeriodSummaryBar({
  summary,
  className,
}: ShiftPlanPeriodSummaryBarProps) {
  const coverageNotes = shiftPlanPeriodCoverageNotes(summary);
  const wageLabel = shiftPlanPeriodWageLabel(summary);
  const showWage =
    summary.shiftCount > 0 ||
    summary.hourlyShiftCount > 0 ||
    summary.fixedPayShiftCount > 0;

  return (
    <Card className={cn("border-border/50 shadow-card", className)}>
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Clock
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="text-muted-foreground">Geplant</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatScheduledHoursMinutes(summary.plannedMinutes)}
            </span>
            {summary.shiftCount > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                · {summary.shiftCount}{" "}
                {summary.shiftCount === 1 ? "Schicht" : "Schichten"}
              </span>
            ) : null}
          </div>

          {showWage ? (
            <div className="ml-4 flex min-w-0 items-center gap-2">
              <Coins
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="text-muted-foreground">Lohn</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  summary.wageCents > 0
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {wageLabel}
              </span>
            </div>
          ) : null}
        </div>

        {coverageNotes.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {coverageNotes.join(" · ")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
