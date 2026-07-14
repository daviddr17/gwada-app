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
import type { CompletedDisplayShift } from "@/lib/staff/staff-work-hours-display";
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
                const netMinutes = shift.workMinutes;
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
