"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  formatStaffEuroCents,
  type StaffDayWageBreakdown,
} from "@/lib/staff/staff-day-wage";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";

export function StaffOverviewWageSheet({
  open,
  onOpenChange,
  dayYmd,
  breakdown,
  staffById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  breakdown: StaffDayWageBreakdown;
  staffById: Map<string, RestaurantStaffRow>;
}) {
  const dayLabel = (() => {
    const [y, m, d] = dayYmd.split("-").map(Number);
    if (!y || !m || !d) return dayYmd;
    return formatDayHeadingDe(new Date(y, m - 1, d));
  })();

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto flex max-h-[min(85dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Lohnübersicht
          </DrawerTitle>
          <DrawerDescription>
            {dayLabel} · Arbeitszeit × Stundenlohn
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {breakdown.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine Arbeitszeit an diesem Tag — kein Lohn zu berechnen.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {breakdown.lines.map((line) => {
                  const staff = staffById.get(line.staffId);
                  const name = staff ? staffDisplayName(staff) : "Unbekannt";
                  const position =
                    staff?.position_tag?.name ??
                    staff?.restaurant_position?.name ??
                    null;
                  const hoursLabel = formatHoursDe(line.workHours);
                  const canCalculate =
                    line.payType === "hourly" &&
                    line.hourlyRateCents != null &&
                    line.hourlyRateCents > 0;

                  return (
                    <li
                      key={line.staffId}
                      className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3"
                    >
                      <p className="font-semibold leading-snug">{name}</p>
                      {position ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {position}
                        </p>
                      ) : null}

                      <div className="mt-3 space-y-1.5 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">Arbeitszeit</span>
                          <span className="font-medium tabular-nums">{hoursLabel}</span>
                        </div>

                        {canCalculate ? (
                          <>
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-muted-foreground">
                                Stundenlohn
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatStaffEuroCents(line.hourlyRateCents)}
                              </span>
                            </div>
                            <div className="border-t border-border/40 pt-2">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {hoursLabel} ×{" "}
                                  {formatStaffEuroCents(line.hourlyRateCents)}
                                </span>
                                <span className="text-base font-semibold tabular-nums">
                                  {formatStaffEuroCents(line.wageCents)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {line.note ?? "Nicht berechenbar"}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl border border-border/50 bg-accent/5 px-4 py-3">
                <span className="text-sm font-medium">Gesamt (tagesbasiert)</span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatStaffEuroCents(breakdown.totalCents)}
                </span>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
