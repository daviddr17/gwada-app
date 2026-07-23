"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import { LayoutGroup, m, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ShiftPlanDragData } from "@/components/staff/shift-plan/shift-plan-template-palette";
import { moduleDataTableHeadLabelClassName } from "@/lib/ui/module-data-table";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";
import type {
  RestaurantStaffScheduledShiftRow,
  ShiftScheduleViewMode,
} from "@/lib/types/staff-shift-schedule";
import {
  formatScheduledHoursMinutes,
  scheduledShiftDurationMinutes,
} from "@/lib/types/staff-shift-schedule";
import {
  evaluateShiftPlanTarget,
  formatShiftPlanHoursLine,
  progressBarMaxMinutes,
  resolveShiftPlanStaffTargetMinutes,
} from "@/lib/staff/shift-plan-target-hours";
import { localDayKey, weekdayLabelShort } from "@/lib/staff/shift-schedule-range";
import { restaurantZonedDateKey } from "@/lib/restaurant/restaurant-timezone";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import {
  groupStaffByPositionTag,
  positionGroupHeaderStyle,
} from "@/lib/staff/shift-plan-position-groups";
import { staffDisplayName } from "@/lib/types/staff";
import { isStaffOwnerRow } from "@/lib/types/employee-role";
import {
  staffOwnerBadgeClassName,
  staffOwnerRowSurfaceClassName,
} from "@/lib/ui/staff-owner-row";
import { Badge } from "@/components/ui/badge";
import { ShiftPlanShiftCard } from "@/components/staff/shift-plan/shift-plan-shift-card";
import { ShiftPlanAbsenceCard } from "@/components/staff/shift-plan/shift-plan-absence-card";
import { ShiftPlanAvailabilityCard } from "@/components/staff/shift-plan/shift-plan-availability-card";
import {
  buildAbsenceMaps,
  isShiftPlanAbsenceEntry,
} from "@/lib/staff/shift-plan-absence";
import { buildAvailabilityMaps } from "@/lib/staff/shift-plan-availability";
import type { RestaurantStaffAvailabilitySlotRow } from "@/lib/types/staff-availability";
import {
  shiftPlanDayHeaderMinHeightClassName,
  ShiftPlanHolidayLabel,
  ShiftPlanWeekDayHeader,
} from "@/components/staff/shift-plan/shift-plan-holiday-label";
import type { ShiftPlanDayWeather } from "@/lib/weather/shift-plan-day-weather";
import { ShiftPlanDayWeatherRow } from "@/lib/weather/shift-plan-day-weather";
import {
  shiftPlanCellDropId,
  shiftPlanWeekDropId,
} from "@/components/staff/shift-plan/shift-plan-template-palette";
import {
  maxShiftsPerStaffRow,
  ShiftPlanAddShiftSlotButton,
  shiftPlanAddShiftCompactButtonClassName,
  shiftPlanLayoutMotionTransition,
  shiftPlanLayoutTransitionClassName,
  ShiftPlanShiftSlotSpacer,
  shiftPlanStaffColumnClassName,
  shiftPlanDayColumnClassName,
  shiftPlanWeekNavColumnClassName,
} from "@/components/staff/shift-plan/shift-plan-cell-layout";

function ShiftPlanDropCell({
  staffId,
  day,
  shifts,
  absences = [],
  availabilitySlots = [],
  onAdd,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  editable,
  compact = false,
  animateLayout,
  maxShiftsInRow,
  weekRowHighlight = false,
}: {
  staffId: string;
  day: Date;
  shifts: RestaurantStaffScheduledShiftRow[];
  absences?: RestaurantStaffWorkEntryRow[];
  availabilitySlots?: RestaurantStaffAvailabilitySlotRow[];
  onAdd: () => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  editable: boolean;
  compact?: boolean;
  animateLayout?: boolean;
  /** Max. Einträge in dieser Mitarbeiter-Zeile — hält leere Tage auf gleicher Höhe. */
  maxShiftsInRow: number;
  /** Wochen-Drop über Namenszelle — ganze Zeile als Ziel markieren. */
  weekRowHighlight?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const layoutEnabled = animateLayout ?? !reduceMotion;
  const dayKey = localDayKey(day);
  const dropId = shiftPlanCellDropId(staffId, dayKey);
  const hasAbsence = absences.some(isShiftPlanAbsenceEntry);
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { staffId, dayKey },
    disabled: hasAbsence,
  });

  const showCompactAdd = editable && maxShiftsInRow > 0 && !hasAbsence;
  const visibleShifts = hasAbsence ? [] : shifts;
  const showAvailability = availabilitySlots.length > 0 && !hasAbsence;
  const cellItemCount =
    visibleShifts.length +
    (hasAbsence ? absences.length : 0) +
    (showAvailability ? 1 : 0);
  const trailingSpacerCount = Math.max(
    0,
    maxShiftsInRow - cellItemCount - (cellItemCount === 0 && editable && !hasAbsence ? 1 : 0),
  );

  const inner = (
    <m.div
      layout={layoutEnabled ? "size" : false}
      transition={shiftPlanLayoutMotionTransition}
      className={cn(
        "pointer-events-none flex flex-col gap-1",
        shiftPlanLayoutTransitionClassName,
        compact && "rounded-lg border border-dashed border-border/50 p-1.5",
      )}
    >
      {absences.map((entry) =>
        isShiftPlanAbsenceEntry(entry) ? (
          <div key={entry.id} className="pointer-events-auto shrink-0">
            <ShiftPlanAbsenceCard
              entry={entry}
              compact
              onDelete={
                editable && onDeleteAbsence
                  ? () => onDeleteAbsence(entry)
                  : undefined
              }
            />
          </div>
        ) : null,
      )}
      {showAvailability ? (
        <div className="pointer-events-auto shrink-0">
          <ShiftPlanAvailabilityCard slots={availabilitySlots} compact />
        </div>
      ) : null}
      {visibleShifts.map((shift) => (
        <div key={shift.id} className="pointer-events-auto shrink-0">
          <ShiftPlanShiftCard
            shift={shift}
            draggable={editable && !hasAbsence}
            compact
            onEdit={editable ? () => onEditShift(shift) : undefined}
          />
        </div>
      ))}
      {editable && cellItemCount === 0 && !hasAbsence ? (
        <ShiftPlanAddShiftSlotButton onClick={onAdd} />
      ) : null}
      {Array.from({ length: trailingSpacerCount }, (_, i) => (
        <ShiftPlanShiftSlotSpacer key={`spacer-${i}`} />
      ))}
      {showCompactAdd ? (
        <button
          type="button"
          className={shiftPlanAddShiftCompactButtonClassName}
          onClick={onAdd}
          aria-label="Schicht hinzufügen"
        >
          <Plus className="size-3.5" />
        </button>
      ) : null}
      {!editable && cellItemCount === 0 && maxShiftsInRow === 0 ? (
        <ShiftPlanShiftSlotSpacer />
      ) : null}
    </m.div>
  );

  const dayHighlight = (isOver && !hasAbsence) || weekRowHighlight;

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "relative transition-colors",
          dayHighlight &&
            "rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/40",
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "relative align-top border-border/40 bg-card p-1.5 transition-colors",
        shiftPlanDayColumnClassName,
        shiftPlanLayoutTransitionClassName,
        dayHighlight && "bg-accent/10 ring-1 ring-inset ring-accent/40",
      )}
    >
      {inner}
    </td>
  );
}

function EmployeeHoursBar({
  plannedMinutes,
  contracts,
  staffId,
  targetSummaryDays,
  viewMode,
}: {
  plannedMinutes: number;
  contracts: readonly RestaurantStaffContractRow[];
  staffId: string;
  targetSummaryDays: readonly Date[];
  viewMode: ShiftScheduleViewMode;
}) {
  const targetMinutes = useMemo(
    () =>
      resolveShiftPlanStaffTargetMinutes(
        contracts,
        staffId,
        targetSummaryDays,
        viewMode,
      ),
    [contracts, staffId, targetSummaryDays, viewMode],
  );
  const target = evaluateShiftPlanTarget(plannedMinutes, targetMinutes);
  const barMax = progressBarMaxMinutes(plannedMinutes, targetMinutes);
  const hasTarget = targetMinutes != null && targetMinutes > 0;
  const plannedLine = formatShiftPlanHoursLine(plannedMinutes, targetMinutes);

  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            !hasTarget
              ? "bg-muted-foreground/30"
              : target.status === "under"
                ? "bg-red-500/70"
                : target.status === "ok"
                  ? "bg-emerald-600/75"
                  : "bg-accent/70",
          )}
          style={{ width: `${Math.min(100, (plannedMinutes / barMax) * 100)}%` }}
        />
      </div>
      <p
        className={cn(
          "truncate text-[10px] tabular-nums leading-tight",
          hasTarget ? target.statusClassName : "text-muted-foreground",
        )}
      >
        {plannedLine}
      </p>
    </div>
  );
}

type ShiftPlanViewProps = {
  days: Date[];
  staffRows: RestaurantStaffRow[];
  positionTags: StaffPositionTagDefinition[];
  shifts: RestaurantStaffScheduledShiftRow[];
  absenceEntries?: readonly RestaurantStaffWorkEntryRow[];
  availabilitySlots?: readonly RestaurantStaffAvailabilitySlotRow[];
  restaurantTimeZone?: string;
  holidaysByDate?: Record<string, string>;
  weatherByDate?: ReadonlyMap<string, ShiftPlanDayWeather>;
  contracts?: readonly RestaurantStaffContractRow[];
  /** Tage für Soll-Skalierung (Woche/Tag/Monat). */
  targetSummaryDays: readonly Date[];
  viewMode: ShiftScheduleViewMode;
  /** Nur diese Tage für die Stunden-Zeile unter dem Namen. */
  hoursSummaryDayKeys?: readonly string[];
  /** Pfeile vor/nach den Tages-Spalten (Tag- oder Wochenansicht). */
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  periodNav?: "day" | "week";
  onAddShift: (staffId: string, day: Date) => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  editable?: boolean;
};

function ShiftPlanStaffName({
  staff,
  onClick,
  className,
}: {
  staff: RestaurantStaffRow;
  onClick?: (staff: RestaurantStaffRow) => void;
  className?: string;
}) {
  const name = staffDisplayName(staff);
  const isOwner = isStaffOwnerRow(staff);
  const nameNode = !onClick ? (
    <p className={cn("truncate font-medium text-foreground", className)}>
      {name}
    </p>
  ) : (
    <button
      type="button"
      onClick={() => onClick(staff)}
      className={cn(
        "max-w-full truncate text-left font-medium text-foreground",
        "rounded-sm transition-colors hover:text-accent hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      {name}
    </button>
  );
  if (!isOwner) return nameNode;
  return (
    <div className="min-w-0 space-y-0.5">
      {nameNode}
      <Badge
        variant="outline"
        className={cn("text-[0.625rem]", staffOwnerBadgeClassName)}
      >
        Inhaber
      </Badge>
    </div>
  );
}

/** Drop auf Namensspalte = Vorlage/Abwesenheit für alle sichtbaren Tage der Zeile. */
function ShiftPlanWeekStaffDropCell({
  staff,
  onStaffClick,
  plannedMinutes,
  contracts,
  targetSummaryDays,
  viewMode,
  weekDropEnabled,
  setNodeRef,
  weekHighlight,
  showWeekHint,
}: {
  staff: RestaurantStaffRow;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  plannedMinutes: number;
  contracts: readonly RestaurantStaffContractRow[];
  targetSummaryDays: readonly Date[];
  viewMode: ShiftScheduleViewMode;
  weekDropEnabled: boolean;
  setNodeRef: (node: HTMLElement | null) => void;
  weekHighlight: boolean;
  showWeekHint: boolean;
}) {
  const isOwner = isStaffOwnerRow(staff);
  return (
    <td
      ref={setNodeRef}
      className={cn(
        "sticky left-0 z-10 overflow-hidden border-r border-border/40 bg-card px-3 py-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.45)]",
        shiftPlanStaffColumnClassName,
        isOwner && !weekHighlight && staffOwnerRowSurfaceClassName,
        weekHighlight && "bg-accent/10 ring-1 ring-inset ring-accent/40",
      )}
    >
      <ShiftPlanStaffName staff={staff} onClick={onStaffClick} />
      {weekDropEnabled && showWeekHint ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] leading-tight",
            weekHighlight
              ? "font-medium text-accent"
              : "text-muted-foreground",
          )}
        >
          {weekHighlight ? "Ganze Woche belegen" : "Auf Namen = ganze Woche"}
        </p>
      ) : null}
      <EmployeeHoursBar
        plannedMinutes={plannedMinutes}
        contracts={contracts}
        staffId={staff.id}
        targetSummaryDays={targetSummaryDays}
        viewMode={viewMode}
      />
    </td>
  );
}

function ShiftPlanStaffWeekRow({
  staff,
  days,
  shiftsByCell,
  absencesByCell,
  availabilityByCell,
  restaurantTimeZone,
  plannedMinutes,
  contracts,
  targetSummaryDays,
  viewMode,
  showWeekNav,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable,
  weekDropEnabled,
  layoutEnabled,
  maxShiftsInRow,
}: {
  staff: RestaurantStaffRow;
  days: Date[];
  shiftsByCell: Map<string, RestaurantStaffScheduledShiftRow[]>;
  absencesByCell: Map<string, RestaurantStaffWorkEntryRow[]>;
  availabilityByCell: Map<string, RestaurantStaffAvailabilitySlotRow[]>;
  restaurantTimeZone?: string;
  plannedMinutes: number;
  contracts: readonly RestaurantStaffContractRow[];
  targetSummaryDays: readonly Date[];
  viewMode: ShiftScheduleViewMode;
  showWeekNav: boolean;
  onAddShift: (staffId: string, day: Date) => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  editable: boolean;
  weekDropEnabled: boolean;
  layoutEnabled: boolean;
  maxShiftsInRow: number;
}) {
  const dropId = shiftPlanWeekDropId(staff.id);
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { kind: "week", staffId: staff.id },
    disabled: !weekDropEnabled,
  });
  const { active } = useDndContext();
  const dragType = (active?.data.current as ShiftPlanDragData | undefined)?.type;
  const showWeekHint =
    weekDropEnabled &&
    active != null &&
    (dragType === "template" ||
      dragType === "absence" ||
      dragType === "shift");
  const weekHighlight = weekDropEnabled && isOver;

  return (
    <m.tr
      layout={layoutEnabled ? "size" : false}
      transition={shiftPlanLayoutMotionTransition}
      className={cn(
        "border-b border-border/40 last:border-0",
        shiftPlanLayoutTransitionClassName,
        weekHighlight && "bg-accent/[0.04]",
      )}
    >
      <ShiftPlanWeekStaffDropCell
        staff={staff}
        onStaffClick={onStaffClick}
        plannedMinutes={plannedMinutes}
        contracts={contracts}
        targetSummaryDays={targetSummaryDays}
        viewMode={viewMode}
        weekDropEnabled={weekDropEnabled}
        setNodeRef={setNodeRef}
        weekHighlight={weekHighlight}
        showWeekHint={showWeekHint}
      />
      {showWeekNav ? <ShiftPlanWeekNavSpacer /> : null}
      {days.map((day) => {
        const cellKey = `${staff.id}__${localDayKey(day)}`;
        const availabilityKey = `${staff.id}__${restaurantZonedDateKey(day, restaurantTimeZone)}`;
        return (
          <ShiftPlanDropCell
            key={cellKey}
            staffId={staff.id}
            day={day}
            shifts={shiftsByCell.get(cellKey) ?? []}
            absences={absencesByCell.get(cellKey) ?? []}
            availabilitySlots={availabilityByCell.get(availabilityKey) ?? []}
            onAdd={() => onAddShift(staff.id, day)}
            onEditShift={onEditShift}
            onDeleteShift={onDeleteShift}
            onDeleteAbsence={onDeleteAbsence}
            editable={editable}
            animateLayout={layoutEnabled}
            maxShiftsInRow={maxShiftsInRow}
            weekRowHighlight={weekHighlight}
          />
        );
      })}
      {showWeekNav ? <ShiftPlanWeekNavSpacer /> : null}
    </m.tr>
  );
}

function buildShiftMaps(
  shifts: RestaurantStaffScheduledShiftRow[],
  summaryDayKeys?: ReadonlySet<string>,
) {
  const shiftsByCell = new Map<string, RestaurantStaffScheduledShiftRow[]>();
  const minutesByStaff = new Map<string, number>();
  for (const shift of shifts) {
    const dayKey = localDayKey(new Date(shift.starts_at));
    const key = `${shift.staff_id}__${dayKey}`;
    const list = shiftsByCell.get(key) ?? [];
    list.push(shift);
    shiftsByCell.set(key, list);
    if (summaryDayKeys && !summaryDayKeys.has(dayKey)) continue;
    const min = scheduledShiftDurationMinutes(shift.starts_at, shift.ends_at);
    minutesByStaff.set(
      shift.staff_id,
      (minutesByStaff.get(shift.staff_id) ?? 0) + min,
    );
  }
  return { shiftsByCell, minutesByStaff };
}

function PositionGroupShell({
  name,
  color,
  children,
  animateLayout = true,
}: {
  name: string;
  color: string;
  children: ReactNode;
  animateLayout?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const layoutEnabled = animateLayout && !reduceMotion;
  const headerStyle = positionGroupHeaderStyle(color);
  return (
    <m.section
      layout={layoutEnabled ? "size" : false}
      transition={shiftPlanLayoutMotionTransition}
      className={cn(
        "overflow-hidden rounded-xl border border-border/50 shadow-card",
        shiftPlanLayoutTransitionClassName,
      )}
      style={{ borderColor: headerStyle.borderColor }}
    >
      <div
        className="border-b border-border/40 px-4 py-2.5 text-sm font-semibold text-foreground"
        style={{ backgroundColor: headerStyle.backgroundColor }}
      >
        {name}
      </div>
      {children}
    </m.section>
  );
}

function ShiftPlanWeekNavCell({
  direction,
  onClick,
  periodNav = "week",
}: {
  direction: "prev" | "next";
  onClick: () => void;
  periodNav?: "day" | "week";
}) {
  const label =
    periodNav === "day"
      ? direction === "prev"
        ? "Vorheriger Tag"
        : "Nächster Tag"
      : direction === "prev"
        ? "Vorherige Woche"
        : "Nächste Woche";

  return (
    <th className={cn("align-top bg-card px-0.5 py-2 text-center", shiftPlanWeekNavColumnClassName)}>
      <div
        className={cn(
          "flex items-center justify-center",
          shiftPlanDayHeaderMinHeightClassName,
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="mx-auto shrink-0"
          onClick={onClick}
          aria-label={label}
        >
          {direction === "prev" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      </div>
    </th>
  );
}

function ShiftPlanWeekNavSpacer() {
  return <td className={cn("bg-card", shiftPlanWeekNavColumnClassName)} aria-hidden />;
}

function ShiftPlanGroupGrid({
  days,
  staffRows,
  shiftsByCell,
  absencesByCell,
  availabilityByCell,
  restaurantTimeZone = DEFAULT_RESTAURANT_TIMEZONE,
  minutesByStaff,
  holidaysByDate,
  weatherByDate,
  contracts,
  targetSummaryDays,
  viewMode,
  onPrevWeek,
  onNextWeek,
  periodNav = "week",
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable,
  weekDropEnabled = false,
}: {
  days: Date[];
  staffRows: RestaurantStaffRow[];
  shiftsByCell: Map<string, RestaurantStaffScheduledShiftRow[]>;
  absencesByCell: Map<string, RestaurantStaffWorkEntryRow[]>;
  availabilityByCell: Map<string, RestaurantStaffAvailabilitySlotRow[]>;
  restaurantTimeZone?: string;
  minutesByStaff: Map<string, number>;
  holidaysByDate: Record<string, string>;
  weatherByDate?: ReadonlyMap<string, ShiftPlanDayWeather>;
  contracts: readonly RestaurantStaffContractRow[];
  targetSummaryDays: readonly Date[];
  viewMode: ShiftScheduleViewMode;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  periodNav?: "day" | "week";
  onAddShift: (staffId: string, day: Date) => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  editable: boolean;
  /** Drop auf Namensspalte belegt alle `days` (Wochenansicht). */
  weekDropEnabled?: boolean;
}) {
  const todayKey = localDayKey(new Date());
  const showWeekNav = onPrevWeek != null && onNextWeek != null;
  const reduceMotion = useReducedMotion();
  const layoutEnabled = !reduceMotion;
  const maxShiftsInRowByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const staff of staffRows) {
      map.set(
        staff.id,
        maxShiftsPerStaffRow(staff.id, days, shiftsByCell, absencesByCell),
      );
    }
    return map;
  }, [staffRows, days, shiftsByCell, absencesByCell]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: "11.5rem" }} />
          {showWeekNav ? <col style={{ width: "2.5rem" }} /> : null}
          {days.map((day) => (
            <col key={localDayKey(day)} style={{ width: "6.25rem" }} />
          ))}
          {showWeekNav ? <col style={{ width: "2.5rem" }} /> : null}
        </colgroup>
        <thead>
          <tr className="border-b border-border/50 bg-card">
            <th
              className={cn(
                "sticky left-0 z-10 align-top overflow-hidden border-r border-border/40 bg-card px-3 py-2 text-left shadow-[4px_0_10px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.45)]",
                moduleDataTableHeadLabelClassName,
                shiftPlanStaffColumnClassName,
              )}
            >
              <div
                className={cn(
                  "flex items-start",
                  shiftPlanDayHeaderMinHeightClassName,
                )}
              >
                Mitarbeiter
              </div>
            </th>
            {showWeekNav ? (
              <ShiftPlanWeekNavCell
                direction="prev"
                onClick={onPrevWeek}
                periodNav={periodNav}
              />
            ) : null}
            {days.map((day) => {
              const key = localDayKey(day);
              const isToday = key === todayKey;
              const holidayName = holidaysByDate[key];
              return (
                <th
                  key={key}
                  className={cn(
                    "align-top bg-card px-2 py-2 text-center",
                    moduleDataTableHeadLabelClassName,
                    shiftPlanDayColumnClassName,
                  )}
                >
                  <ShiftPlanWeekDayHeader
                    day={day}
                    weekdayLabel={weekdayLabelShort(day)}
                    holidayName={holidayName}
                    weather={weatherByDate?.get(key)}
                    isToday={isToday}
                  />
                </th>
              );
            })}
            {showWeekNav ? (
              <ShiftPlanWeekNavCell
                direction="next"
                onClick={onNextWeek}
                periodNav={periodNav}
              />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {staffRows.map((staff) => (
            <ShiftPlanStaffWeekRow
              key={staff.id}
              staff={staff}
              days={days}
              shiftsByCell={shiftsByCell}
              absencesByCell={absencesByCell}
              availabilityByCell={availabilityByCell}
              restaurantTimeZone={restaurantTimeZone}
              plannedMinutes={minutesByStaff.get(staff.id) ?? 0}
              contracts={contracts}
              targetSummaryDays={targetSummaryDays}
              viewMode={viewMode}
              showWeekNav={showWeekNav}
              onAddShift={onAddShift}
              onEditShift={onEditShift}
              onDeleteShift={onDeleteShift}
              onDeleteAbsence={onDeleteAbsence}
              onStaffClick={onStaffClick}
              editable={editable}
              weekDropEnabled={weekDropEnabled}
              layoutEnabled={layoutEnabled}
              maxShiftsInRow={maxShiftsInRowByStaff.get(staff.id) ?? 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ShiftPlanGrid({
  days,
  staffRows,
  positionTags,
  shifts,
  absenceEntries = [],
  availabilitySlots = [],
  restaurantTimeZone = DEFAULT_RESTAURANT_TIMEZONE,
  holidaysByDate = {},
  weatherByDate,
  contracts = [],
  targetSummaryDays,
  viewMode,
  hoursSummaryDayKeys,
  onPrevWeek,
  onNextWeek,
  periodNav = "week",
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable = true,
  weekDropEnabled = false,
}: ShiftPlanViewProps & { weekDropEnabled?: boolean }) {
  const groups = groupStaffByPositionTag(staffRows, positionTags);
  const summaryDayKeys = useMemo(
    () => (hoursSummaryDayKeys ? new Set(hoursSummaryDayKeys) : undefined),
    [hoursSummaryDayKeys],
  );
  const { shiftsByCell, minutesByStaff } = buildShiftMaps(shifts, summaryDayKeys);
  const absencesByCell = useMemo(
    () => buildAbsenceMaps(absenceEntries),
    [absenceEntries],
  );
  const availabilityByCell = useMemo(
    () => buildAvailabilityMaps(availabilitySlots, days, restaurantTimeZone),
    [availabilitySlots, days, restaurantTimeZone],
  );

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Mitarbeiter für die aktuelle Filterauswahl.
      </p>
    );
  }

  return (
    <LayoutGroup id="shift-plan-grid">
      <div className="space-y-4">
        {groups.map((group) => (
          <PositionGroupShell
            key={group.id ?? "unassigned"}
            name={group.name}
            color={group.color}
          >
            <ShiftPlanGroupGrid
              days={days}
              staffRows={group.staff}
              shiftsByCell={shiftsByCell}
              absencesByCell={absencesByCell}
              availabilityByCell={availabilityByCell}
              restaurantTimeZone={restaurantTimeZone}
              minutesByStaff={minutesByStaff}
              holidaysByDate={holidaysByDate}
              weatherByDate={weatherByDate}
              contracts={contracts}
              targetSummaryDays={targetSummaryDays}
              viewMode={viewMode}
              onPrevWeek={onPrevWeek}
              onNextWeek={onNextWeek}
              periodNav={periodNav}
              onAddShift={onAddShift}
              onEditShift={onEditShift}
              onDeleteShift={onDeleteShift}
              onDeleteAbsence={onDeleteAbsence}
              onStaffClick={onStaffClick}
              editable={editable}
              weekDropEnabled={weekDropEnabled}
            />
          </PositionGroupShell>
        ))}
      </div>
    </LayoutGroup>
  );
}

function ShiftPlanDayStaffRow({
  staff,
  day,
  shifts,
  absences,
  availabilitySlots,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable,
}: {
  staff: RestaurantStaffRow;
  day: Date;
  shifts: RestaurantStaffScheduledShiftRow[];
  absences: RestaurantStaffWorkEntryRow[];
  availabilitySlots: RestaurantStaffAvailabilitySlotRow[];
  onAddShift: (staffId: string, day: Date) => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  editable: boolean;
}) {
  const cellItemCount =
    shifts.length +
    absences.length +
    (availabilitySlots.length > 0 && !absences.some(isShiftPlanAbsenceEntry) ? 1 : 0);
  const isOwner = isStaffOwnerRow(staff);
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border-b border-border/40 px-3 py-2 last:border-0",
        isOwner && staffOwnerRowSurfaceClassName,
      )}
    >
      <div className="min-w-[8rem] shrink-0 pt-1">
        <ShiftPlanStaffName
          staff={staff}
          onClick={onStaffClick}
          className="text-sm"
        />
      </div>
      <div className="min-w-[10rem] flex-1">
        <ShiftPlanDropCell
          staffId={staff.id}
          day={day}
          shifts={shifts}
          absences={absences}
          availabilitySlots={availabilitySlots}
          onAdd={() => onAddShift(staff.id, day)}
          onEditShift={onEditShift}
          onDeleteShift={onDeleteShift}
          onDeleteAbsence={onDeleteAbsence}
          editable={editable}
          compact
          maxShiftsInRow={cellItemCount}
        />
      </div>
    </div>
  );
}

function ShiftPlanMonthDayCard({
  day,
  groups,
  shiftsByCell,
  absencesByCell,
  availabilityByCell,
  restaurantTimeZone = DEFAULT_RESTAURANT_TIMEZONE,
  holidayName,
  weather,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable,
}: {
  day: Date;
  groups: ReturnType<typeof groupStaffByPositionTag>;
  shiftsByCell: Map<string, RestaurantStaffScheduledShiftRow[]>;
  absencesByCell: Map<string, RestaurantStaffWorkEntryRow[]>;
  availabilityByCell: Map<string, RestaurantStaffAvailabilitySlotRow[]>;
  holidayName?: string;
  weather?: ShiftPlanDayWeather;
  onAddShift: (staffId: string, day: Date) => void;
  onEditShift: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteShift?: (shift: RestaurantStaffScheduledShiftRow) => void;
  onDeleteAbsence?: (entry: RestaurantStaffWorkEntryRow) => void;
  onStaffClick?: (staff: RestaurantStaffRow) => void;
  editable: boolean;
  restaurantTimeZone?: string;
}) {
  const key = localDayKey(day);
  const availabilityKey = restaurantZonedDateKey(day, restaurantTimeZone);
  const todayKey = localDayKey(new Date());
  const isToday = key === todayKey;
  const dayHasEntries = groups.some((g) =>
    g.staff.some((s) => {
      const cellKey = `${s.id}__${key}`;
      return (
        (shiftsByCell.get(cellKey) ?? []).length > 0 ||
        (absencesByCell.get(cellKey) ?? []).length > 0 ||
        (availabilityByCell.get(`${s.id}__${availabilityKey}`) ?? []).length > 0
      );
    }),
  );

  return (
    <article className="overflow-hidden rounded-xl border border-border/50 shadow-card">
      <header
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/50 bg-muted/15 px-4 py-2.5 text-sm",
          isToday ? "font-semibold text-foreground" : "font-medium text-foreground",
        )}
      >
        <span>
          {new Intl.DateTimeFormat("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(day)}
          {isToday ? (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              · Heute
            </span>
          ) : null}
        </span>
        {holidayName ? (
          <ShiftPlanHolidayLabel name={holidayName} inline />
        ) : null}
        <ShiftPlanDayWeatherRow weather={weather} inline />
      </header>

      <div className="space-y-3 p-3">
        {groups.map((group) => {
          const groupHasStaff = group.staff.length > 0;
          if (!groupHasStaff) return null;

          return (
            <div
              key={`${key}-${group.id ?? "none"}`}
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: positionGroupHeaderStyle(group.color).borderColor }}
            >
              <div
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: positionGroupHeaderStyle(group.color).backgroundColor,
                }}
              >
                {group.name}
              </div>
              <div>
                {group.staff.map((staff) => (
                  <ShiftPlanDayStaffRow
                    key={staff.id}
                    staff={staff}
                    day={day}
                    shifts={shiftsByCell.get(`${staff.id}__${key}`) ?? []}
                    absences={absencesByCell.get(`${staff.id}__${key}`) ?? []}
                    availabilitySlots={availabilityByCell.get(`${staff.id}__${availabilityKey}`) ?? []}
                    onAddShift={onAddShift}
                    onEditShift={onEditShift}
                    onDeleteShift={onDeleteShift}
                    onDeleteAbsence={onDeleteAbsence}
                    onStaffClick={onStaffClick}
                    editable={editable}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {!dayHasEntries && groups.length > 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            Noch keine Schichten — Vorlage ziehen oder „+“ nutzen.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ShiftPlanMonthView({
  days,
  staffRows,
  positionTags,
  shifts,
  absenceEntries = [],
  availabilitySlots = [],
  restaurantTimeZone = DEFAULT_RESTAURANT_TIMEZONE,
  holidaysByDate = {},
  weatherByDate,
  contracts = [],
  targetSummaryDays,
  viewMode,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onDeleteAbsence,
  onStaffClick,
  editable = true,
}: ShiftPlanViewProps) {
  const groups = groupStaffByPositionTag(staffRows, positionTags);
  const { shiftsByCell } = buildShiftMaps(shifts);
  const absencesByCell = useMemo(
    () => buildAbsenceMaps(absenceEntries),
    [absenceEntries],
  );
  const availabilityByCell = useMemo(
    () => buildAvailabilityMaps(availabilitySlots, days, restaurantTimeZone),
    [availabilitySlots, days, restaurantTimeZone],
  );

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Mitarbeiter für die aktuelle Filterauswahl.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const key = localDayKey(day);
        return (
          <ShiftPlanMonthDayCard
            key={key}
            day={day}
            groups={groups}
            shiftsByCell={shiftsByCell}
            absencesByCell={absencesByCell}
            availabilityByCell={availabilityByCell}
            restaurantTimeZone={restaurantTimeZone}
            holidayName={holidaysByDate[key]}
            weather={weatherByDate?.get(key)}
            onAddShift={onAddShift}
            onEditShift={onEditShift}
            onDeleteShift={onDeleteShift}
            onDeleteAbsence={onDeleteAbsence}
            onStaffClick={onStaffClick}
            editable={editable}
          />
        );
      })}
    </div>
  );
}

/** @deprecated Use ShiftPlanMonthView */
export const ShiftPlanMonthList = ShiftPlanMonthView;
