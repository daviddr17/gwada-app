import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardCalendarDaySummary,
  DashboardCalendarHoursException,
  DashboardCalendarSummary,
} from "@/lib/dashboard/dashboard-calendar-types";
import {
  listPublicHolidaysInRange,
  publicHolidaysByDate,
} from "@/lib/holidays/public-holidays-server";
import { exceptionOpenPeriods } from "@/lib/opening-hours/hours-periods";
import { groupExceptionRowsToDateExceptions } from "@/lib/opening-hours/group-exception-rows";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantDayBoundsIso,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { RESERVATION_KIND_PRIVATE_EVENT } from "@/lib/reservations/reservation-kind";
import { countScheduledStaffByRestaurantDay } from "@/lib/staff/scheduled-staff-day-counts";
import type { DateHoursException } from "@/lib/types/restaurant";

function parseMonthParam(month: string): {
  year: number;
  monthIndex: number;
} | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }
  return { year, monthIndex };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function formatHoursException(
  ex: DateHoursException,
): DashboardCalendarHoursException {
  if (ex.closed) {
    return {
      closed: true,
      note: ex.note?.trim() || null,
      label: "Geschlossen",
    };
  }
  const periods = exceptionOpenPeriods(ex);
  const label =
    periods.length > 0
      ? periods.map((p) => `${p.open}–${p.close}`).join(" · ")
      : "Sonderzeiten";
  return {
    closed: false,
    note: ex.note?.trim() || null,
    label,
  };
}

export async function loadDashboardCalendarSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
  month: string,
): Promise<DashboardCalendarSummary> {
  const parsed = parseMonthParam(month);
  if (!parsed) {
    throw new Error("invalid_month");
  }
  const { year, monthIndex } = parsed;
  const monthKey = `${year}-${pad2(monthIndex + 1)}`;

  const { data: restaurantRow } = await sb
    .from("restaurants")
    .select("timezone, country")
    .eq("id", restaurantId)
    .maybeSingle();

  const timeZone =
    (typeof restaurantRow?.timezone === "string" &&
      restaurantRow.timezone.trim()) ||
    DEFAULT_RESTAURANT_TIMEZONE;
  const country =
    (typeof restaurantRow?.country === "string" &&
      restaurantRow.country.trim()) ||
    "Deutschland";

  const firstYmd = ymd(year, monthIndex, 1);
  const lastYmd = ymd(year, monthIndex, daysInMonth(year, monthIndex));
  const rangeStart = restaurantDayBoundsIso(firstYmd, timeZone).start;
  const rangeEnd = restaurantDayBoundsIso(lastYmd, timeZone).end;

  const [
    reservationsRes,
    shiftsRes,
    newsRes,
    hoursRes,
    holidays,
  ] = await Promise.all([
    sb
      .from("reservations")
      .select("id, starts_at, kind")
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd),
    sb
      .from("restaurant_staff_scheduled_shifts")
      .select("staff_id, starts_at, status")
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd),
    sb
      .from("gwada_news_posts")
      .select("id, scheduled_at")
      .eq("restaurant_id", restaurantId)
      .eq("status", "scheduled")
      .gte("scheduled_at", rangeStart)
      .lt("scheduled_at", rangeEnd),
    sb
      .from("opening_hours")
      .select(
        "id, exception_date, closed, opens_at, closes_at, note, kind",
      )
      .eq("restaurant_id", restaurantId)
      .eq("kind", "exception")
      .gte("exception_date", firstYmd)
      .lte("exception_date", lastYmd),
    listPublicHolidaysInRange(country, firstYmd, lastYmd),
  ]);

  const reservationCountByDay = new Map<string, number>();
  const privateEventCountByDay = new Map<string, number>();
  for (const row of reservationsRes.data ?? []) {
    const startsAt = row.starts_at as string;
    const dayKey = restaurantZonedDateKey(new Date(startsAt), timeZone);
    if (row.kind === RESERVATION_KIND_PRIVATE_EVENT) {
      privateEventCountByDay.set(
        dayKey,
        (privateEventCountByDay.get(dayKey) ?? 0) + 1,
      );
    } else {
      reservationCountByDay.set(
        dayKey,
        (reservationCountByDay.get(dayKey) ?? 0) + 1,
      );
    }
  }

  const plannedStaffByDay = countScheduledStaffByRestaurantDay(
    (shiftsRes.data ?? []).map((r) => ({
      staff_id: r.staff_id as string,
      starts_at: r.starts_at as string,
      status: String(r.status ?? ""),
    })),
    timeZone,
  );

  const newsCountByDay = new Map<string, number>();
  for (const row of newsRes.data ?? []) {
    const scheduledAt = row.scheduled_at as string | null;
    if (!scheduledAt) continue;
    const dayKey = restaurantZonedDateKey(new Date(scheduledAt), timeZone);
    newsCountByDay.set(dayKey, (newsCountByDay.get(dayKey) ?? 0) + 1);
  }

  const exceptions = groupExceptionRowsToDateExceptions(
    (hoursRes.data ?? [])
      .filter((r) => r.exception_date)
      .map((r) => ({
        id: r.id as string,
        exception_date: r.exception_date as string,
        closed: Boolean(r.closed),
        opens_at: (r.opens_at as string | null) ?? null,
        closes_at: (r.closes_at as string | null) ?? null,
        note: (r.note as string | null) ?? null,
      })),
  );
  const exceptionByDay = new Map(
    exceptions.map((ex) => [ex.date, formatHoursException(ex)]),
  );

  const holidayByDate = publicHolidaysByDate(holidays);

  const days: DashboardCalendarDaySummary[] = [];
  const totalDays = daysInMonth(year, monthIndex);
  for (let day = 1; day <= totalDays; day++) {
    const date = ymd(year, monthIndex, day);
    days.push({
      date,
      reservationCount: reservationCountByDay.get(date) ?? 0,
      privateEventCount: privateEventCountByDay.get(date) ?? 0,
      plannedStaffCount: plannedStaffByDay.get(date) ?? 0,
      scheduledNewsCount: newsCountByDay.get(date) ?? 0,
      holidayName: holidayByDate[date] ?? null,
      hoursException: exceptionByDay.get(date) ?? null,
    });
  }

  return {
    month: monthKey,
    timeZone,
    days,
  };
}
