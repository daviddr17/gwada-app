"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import type { CompletedDisplayShift } from "@/lib/staff/staff-work-hours-display";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS, staffDisplayName } from "@/lib/types/staff";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export function StaffOverviewCompletedShiftsSheet({
  open,
  onOpenChange,
  dayYmd,
  shifts,
  staffById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  shifts: CompletedDisplayShift[];
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
            Abgeschlossene Schichten
          </DrawerTitle>
          <DrawerDescription>{dayLabel}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {shifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine abgeschlossenen Display-Schichten an diesem Tag.
            </p>
          ) : (
            <ul className="space-y-2">
              {shifts.map((shift) => {
                const staff = staffById.get(shift.staffId);
                const name = staff ? staffDisplayName(staff) : "Unbekannt";
                const netMinutes = shift.workMinutes;
                return (
                  <li
                    key={shift.shiftId}
                    className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3"
                  >
                    <p className="font-semibold leading-snug">{name}</p>
                    <ul className="mt-2 space-y-1.5">
                      {shift.segments.map((segment) => (
                        <li
                          key={segment.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <StaffWorkEntryTypeStripe
                            type={segment.entry_type}
                            className="mt-0.5 self-stretch"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">
                              {STAFF_WORK_ENTRY_LABELS[segment.entry_type]}
                            </span>
                            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                              {timeDe.format(new Date(segment.starts_at))} –{" "}
                              {timeDe.format(new Date(segment.ends_at))}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Gesamt Arbeitszeit {formatHoursDe(netMinutes / 60)}
                      {shift.breakMinutes > 0
                        ? ` · Pause ${formatHoursDe(shift.breakMinutes / 60)}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
