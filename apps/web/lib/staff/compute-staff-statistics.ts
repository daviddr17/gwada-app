import { computeShiftPlanPeriodSummary } from "@/lib/staff/shift-plan-period-summary";
import {
  addDays,
  localDayKey,
  parseLocalDayKey,
  startOfWeekMonday,
} from "@/lib/staff/shift-schedule-range";
import {
  findStaffContractForDay,
  staffContractActiveOnDay,
} from "@/lib/staff/staff-day-wage";
import {
  formatHoursDe,
  summarizeStaffWorkEntries,
} from "@/lib/staff/staff-work-hours-summary";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffContractPayType,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import {
  STAFF_CONTRACT_PAY_LABELS,
  staffDisplayName,
} from "@/lib/types/staff";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import {
  STAFF_SCHEDULED_SHIFT_STATUS_LABELS,
  scheduledShiftDurationMinutes,
} from "@/lib/types/staff-shift-schedule";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type StaffStatsPeriod = 3 | 6 | 12;

const SHIFT_STATUS_COLORS: Record<
  RestaurantStaffScheduledShiftRow["status"],
  string
> = {
  confirmed: "var(--chart-1)",
  pending: "var(--chart-4)",
  declined: "var(--chart-5)",
};

export type StaffStatisticsInput = {
  staff: RestaurantStaffRow[];
  contracts: RestaurantStaffContractRow[];
  workEntries: RestaurantStaffWorkEntryRow[];
  shifts: RestaurantStaffScheduledShiftRow[];
  presence: StaffLivePresenceRow[];
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
};

export type StaffStatisticsResult = {
  totalActiveStaff: number;
  inactiveStaff: number;
  currentlyWorking: number;
  currentlyOnBreak: number;
  activeContractsToday: number;
  staffWithoutContractToday: number;
  byPayType: Array<{ payType: StaffContractPayType; label: string; count: number }>;
  netWorkHours: number;
  breakHours: number;
  vacationDays: number;
  sickDays: number;
  avgNetHoursPerActiveStaff: number | null;
  byWeek: Array<{ week: string; weekStart: string; hours: number }>;
  topStaffByHours: Array<{ name: string; hours: number }>;
  shiftCount: number;
  plannedHours: number;
  shiftPlanWageCents: number;
  shiftCoverageNotes: string[];
  byShiftStatus: Array<{
    status: RestaurantStaffScheduledShiftRow["status"];
    label: string;
    count: number;
    color: string;
  }>;
  byShiftWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  byPosition: Array<{ name: string; count: number }>;
};

function staffPositionLabel(row: RestaurantStaffRow): string {
  return (
    row.restaurant_position?.name ??
    row.position_tag?.name ??
    row.linked_employee?.restaurant_position?.name ??
    "Ohne Position"
  );
}

function daysInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfLocalDay(start); d <= end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

function formatWeekLabel(weekStartYmd: string): string {
  const d = parseLocalDayKey(weekStartYmd);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function countSickDays(entries: RestaurantStaffWorkEntryRow[]): number {
  const days = new Set<string>();
  for (const e of entries) {
    if (e.entry_type !== "sick") continue;
    days.add(`${e.staff_id}:${localDayKey(new Date(e.starts_at))}`);
  }
  return days.size;
}

function workHoursByWeek(
  entries: RestaurantStaffWorkEntryRow[],
  now: Date,
): Map<string, number> {
  const workByWeek = new Map<string, number>();
  const breakByWeek = new Map<string, number>();
  for (const e of entries) {
    if (e.entry_type !== "work" && e.entry_type !== "break") continue;
    const start = new Date(e.starts_at);
    const endMs = e.is_open ? now.getTime() : new Date(e.ends_at).getTime();
    const hours = Math.max(0, endMs - start.getTime()) / 3_600_000;
    const weekStart = localDayKey(startOfWeekMonday(start));
    if (e.entry_type === "work") {
      workByWeek.set(weekStart, (workByWeek.get(weekStart) ?? 0) + hours);
    } else {
      breakByWeek.set(weekStart, (breakByWeek.get(weekStart) ?? 0) + hours);
    }
  }
  const byWeek = new Map<string, number>();
  for (const [weekStart, workH] of workByWeek) {
    byWeek.set(weekStart, Math.max(0, workH - (breakByWeek.get(weekStart) ?? 0)));
  }
  return byWeek;
}

export function computeStaffStatistics(
  input: StaffStatisticsInput,
): StaffStatisticsResult {
  const now = input.now ?? new Date();
  const todayKey = localDayKey(now);
  const activeStaff = input.staff.filter((s) => s.is_active);
  const inactiveStaff = input.staff.length - activeStaff.length;

  let currentlyWorking = 0;
  let currentlyOnBreak = 0;
  for (const p of input.presence) {
    if (p.status === "on_break") currentlyOnBreak += 1;
    else if (p.status === "working") currentlyWorking += 1;
  }

  const staffWithContractToday = new Set<string>();
  for (const c of input.contracts) {
    if (staffContractActiveOnDay(c, todayKey)) {
      staffWithContractToday.add(c.staff_id);
    }
  }
  const staffWithoutContractToday = activeStaff.filter(
    (s) => !staffWithContractToday.has(s.id),
  ).length;

  const payTypeCounts = new Map<StaffContractPayType, number>();
  for (const staffId of staffWithContractToday) {
    const contract = findStaffContractForDay(
      input.contracts,
      staffId,
      todayKey,
    );
    if (!contract) continue;
    payTypeCounts.set(
      contract.pay_type,
      (payTypeCounts.get(contract.pay_type) ?? 0) + 1,
    );
  }
  const byPayType = (Object.keys(STAFF_CONTRACT_PAY_LABELS) as StaffContractPayType[])
    .map((payType) => ({
      payType,
      label: STAFF_CONTRACT_PAY_LABELS[payType],
      count: payTypeCounts.get(payType) ?? 0,
    }))
    .filter((row) => row.count > 0);

  const workSummary = summarizeStaffWorkEntries(input.workEntries, now);
  const sickDays = countSickDays(input.workEntries);
  const avgNetHoursPerActiveStaff =
    activeStaff.length > 0
      ? Math.round((workSummary.netWorkH / activeStaff.length) * 10) / 10
      : null;

  const weekHoursMap = workHoursByWeek(input.workEntries, now);
  const byWeek = [...weekHoursMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, hours]) => ({
      weekStart,
      week: formatWeekLabel(weekStart),
      hours: Math.round(hours * 10) / 10,
    }));

  const hoursByStaff = new Map<string, number>();
  for (const s of activeStaff) {
    const staffEntries = input.workEntries.filter((e) => e.staff_id === s.id);
    hoursByStaff.set(
      s.id,
      summarizeStaffWorkEntries(staffEntries, now).netWorkH,
    );
  }
  const topStaffByHours = [...hoursByStaff.entries()]
    .map(([staffId, hours]) => ({
      name: staffDisplayName(
        input.staff.find((s) => s.id === staffId) ?? {
          given_name: "Unbekannt",
          family_name: "",
        },
      ),
      hours: Math.round(hours * 10) / 10,
    }))
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  const visibleDays = daysInclusive(input.periodStart, input.periodEnd);
  const shiftSummary = computeShiftPlanPeriodSummary({
    shifts: input.shifts,
    contracts: input.contracts,
    visibleDays,
  });

  const statusCounts = new Map<
    RestaurantStaffScheduledShiftRow["status"],
    number
  >();
  for (const shift of input.shifts) {
    statusCounts.set(shift.status, (statusCounts.get(shift.status) ?? 0) + 1);
  }
  const byShiftStatus = (
    Object.keys(STAFF_SCHEDULED_SHIFT_STATUS_LABELS) as Array<
      RestaurantStaffScheduledShiftRow["status"]
    >
  ).map((status) => ({
    status,
    label: STAFF_SCHEDULED_SHIFT_STATUS_LABELS[status],
    count: statusCounts.get(status) ?? 0,
    color: SHIFT_STATUS_COLORS[status],
  }));

  const weekdayCounts = new Map<number, number>();
  for (const shift of input.shifts) {
    if (shift.status === "declined") continue;
    const d = new Date(shift.starts_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byShiftWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const positionCounts = new Map<string, number>();
  for (const s of activeStaff) {
    const label = staffPositionLabel(s);
    positionCounts.set(label, (positionCounts.get(label) ?? 0) + 1);
  }
  const byPosition = [...positionCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  let plannedHours = 0;
  for (const shift of input.shifts) {
    if (shift.status === "declined") continue;
    plannedHours +=
      scheduledShiftDurationMinutes(shift.starts_at, shift.ends_at) / 60;
  }
  plannedHours = Math.round(plannedHours * 10) / 10;

  const shiftCoverageNotes: string[] = [];
  if (shiftSummary.missingContractShiftCount > 0) {
    const n = shiftSummary.missingContractShiftCount;
    shiftCoverageNotes.push(
      `${n} ${n === 1 ? "Schicht" : "Schichten"} ohne Vertrag`,
    );
  }
  if (shiftSummary.missingHourlyRateShiftCount > 0) {
    const n = shiftSummary.missingHourlyRateShiftCount;
    shiftCoverageNotes.push(
      `${n} ${n === 1 ? "Schicht" : "Schichten"} ohne Stundenlohn`,
    );
  }

  return {
    totalActiveStaff: activeStaff.length,
    inactiveStaff,
    currentlyWorking,
    currentlyOnBreak,
    activeContractsToday: staffWithContractToday.size,
    staffWithoutContractToday,
    byPayType,
    netWorkHours: Math.round(workSummary.netWorkH * 10) / 10,
    breakHours: Math.round(workSummary.breakH * 10) / 10,
    vacationDays: workSummary.vacationDays,
    sickDays,
    avgNetHoursPerActiveStaff,
    byWeek,
    topStaffByHours,
    shiftCount: shiftSummary.shiftCount,
    plannedHours,
    shiftPlanWageCents: shiftSummary.wageCents,
    shiftCoverageNotes,
    byShiftStatus,
    byShiftWeekday,
    byPosition,
  };
}

export function formatStaffStatsHours(hours: number): string {
  return formatHoursDe(hours);
}

export function formatStaffStatsAvgHours(hours: number | null): string {
  if (hours == null) return "—";
  return formatHoursDe(hours);
}
