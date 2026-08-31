"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import {
  displayShiftHoursBreakdown,
  type CompletedDisplayShift,
} from "@/lib/staff/staff-work-hours-display";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatRestaurantDayHeadingDe,
} from "@/lib/restaurant/restaurant-timezone";

export function StaffOverviewCompletedShiftsSheet({
  open,
  onOpenChange,
  dayYmd,
  shifts,
  staffById,
  timeZone = DEFAULT_RESTAURANT_TIMEZONE,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  shifts: CompletedDisplayShift[];
  staffById: Map<string, RestaurantStaffRow>;
  timeZone?: string;
}) {
  const dayLabel = formatRestaurantDayHeadingDe(dayYmd, timeZone);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Abgeschlossene Schichten
          </DrawerTitle>
          <DrawerDescription>{dayLabel}</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {shifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine abgeschlossenen Display-Schichten an diesem Tag.
            </p>
          ) : (
            <ul className="space-y-2">
              {shifts.map((shift) => {
                const staff = staffById.get(shift.staffId);
                const name = staff ? staffDisplayName(staff) : "Unbekannt";
                const breakdown = displayShiftHoursBreakdown(shift.segments);
                const presenceH = breakdown.presenceMs / 3_600_000;
                const netH = breakdown.netMs / 3_600_000;
                const breakH = breakdown.breakMs / 3_600_000;
                return (
                  <li
                    key={shift.shiftId}
                    className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3"
                  >
                    <p className="font-semibold leading-snug">{name}</p>
                    <StaffDisplayShiftSegmentsList
                      segments={shift.segments}
                      timeZone={timeZone}
                      className="mt-2 text-sm"
                    />
                    <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                      Eingeloggt {formatHoursDe(presenceH)}
                      {breakH > 0.0005
                        ? ` · Pause ${formatHoursDe(breakH)} · Netto ${formatHoursDe(netH)}`
                        : ` · Netto ${formatHoursDe(netH)}`}
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
