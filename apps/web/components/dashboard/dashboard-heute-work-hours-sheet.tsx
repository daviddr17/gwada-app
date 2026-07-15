"use client";

import { useMemo } from "react";
import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  createRestaurantDateTimeFormatter,
  formatRestaurantDayHeadingDe,
} from "@/lib/restaurant/restaurant-timezone";
import { formatDashboardStaffTodayWorkLabel } from "@/lib/staff/compute-dashboard-staff-summary";
import type { CompletedDisplayShift } from "@/lib/staff/staff-work-hours-display";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import { staffDisplayName } from "@/lib/types/staff";

export function DashboardHeuteWorkHoursSheet({
  open,
  onOpenChange,
  dayYmd,
  todayWorkHours,
  presence,
  completedShifts,
  staffById,
  timeZone = DEFAULT_RESTAURANT_TIMEZONE,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayYmd: string;
  todayWorkHours: number;
  presence: StaffLivePresenceRow[];
  completedShifts: CompletedDisplayShift[];
  staffById: Map<string, RestaurantStaffRow>;
  timeZone?: string;
}) {
  const dayLabel = formatRestaurantDayHeadingDe(dayYmd, timeZone);

  const timeFmt = useMemo(
    () =>
      createRestaurantDateTimeFormatter(timeZone, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [timeZone],
  );

  const activeRows = useMemo(
    () =>
      presence
        .filter((p) => p.status === "working")
        .map((p) => {
          const staff = staffById.get(p.staff_id);
          return {
            id: p.staff_id,
            name: staff ? staffDisplayName(staff) : "Unbekannt",
            positionTag: staff?.position_tag?.name ?? null,
            since: timeFmt.format(new Date(p.clocked_in_at)),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [presence, staffById, timeFmt],
  );

  const empty =
    todayWorkHours <= 0 &&
    activeRows.length === 0 &&
    completedShifts.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Arbeitszeit heute
          </DrawerTitle>
          <DrawerDescription>
            {dayLabel} · {formatDashboardStaffTodayWorkLabel(todayWorkHours)}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Arbeitszeit heute erfasst.
            </p>
          ) : (
            <div className="space-y-4">
              {activeRows.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Gerade aktiv
                  </h3>
                  <ul className="space-y-2">
                    {activeRows.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3"
                      >
                        <StaffWorkEntryTypeStripe
                          type="work"
                          className="mt-0.5 self-stretch"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug">{row.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.positionTag ? `${row.positionTag} · ` : ""}
                            Schicht seit {row.since}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {completedShifts.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Abgeschlossen
                  </h3>
                  <ul className="space-y-2">
                    {completedShifts.map((shift) => {
                      const staff = staffById.get(shift.staffId);
                      const name = staff ? staffDisplayName(staff) : "Unbekannt";
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
                            Gesamt {formatHoursDe(shift.workMinutes / 60)}
                            {shift.breakMinutes > 0
                              ? ` · Pause ${formatHoursDe(shift.breakMinutes / 60)}`
                              : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
