import "server-only";

import {
  defaultKitchenWeeklyHours,
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import {
  defaultOpeningHoursClosure,
  parseOpeningHoursClosure,
} from "@/lib/opening-hours/closure";
import { groupExceptionRowsToDateExceptions } from "@/lib/opening-hours/group-exception-rows";
import type { DayHours, Weekday } from "@/lib/types/restaurant";
import type { OpeningHoursPayload } from "@/lib/integrations/opening-hours-platform-format";
import type { SupabaseClient } from "@supabase/supabase-js";

type OpeningHoursRow = {
  id: string;
  kind: "weekly" | "exception";
  weekday: Weekday | null;
  exception_date: string | null;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note: string | null;
  schedule_role: "business" | "kitchen";
};

function timeToHHmm(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

function mergeWeekly(
  rows: OpeningHoursRow[],
  role: "business" | "kitchen",
  fallback: Record<Weekday, DayHours>,
): Record<Weekday, DayHours> {
  const weekly = { ...fallback } as Record<Weekday, DayHours>;
  for (const day of WEEKDAY_ORDER) {
    weekly[day] = { ...fallback[day] };
  }
  for (const raw of rows) {
    if (
      raw.kind === "weekly" &&
      raw.weekday &&
      (raw.schedule_role ?? "business") === role
    ) {
      weekly[raw.weekday] = {
        closed: raw.closed,
        open: timeToHHmm(raw.opens_at),
        close: timeToHHmm(raw.closes_at),
      };
    }
  }
  return weekly;
}

export async function loadOpeningHoursPayloadAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<OpeningHoursPayload | { error: string }> {
  const [{ data, error }, settingsRes] = await Promise.all([
    admin
      .from("opening_hours")
      .select(
        "id, kind, weekday, exception_date, closed, opens_at, closes_at, note, schedule_role",
      )
      .eq("restaurant_id", restaurantId),
    admin
      .from("restaurant_opening_hours_settings")
      .select("closure_mode, closure_from, closure_until")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
  ]);

  if (error) {
    return { error: error.message };
  }

  const rows = (data ?? []) as OpeningHoursRow[];
  const weeklyHours = mergeWeekly(rows, "business", defaultWeeklyHours());
  const kitchenWeeklyHours = mergeWeekly(
    rows,
    "kitchen",
    defaultKitchenWeeklyHours(),
  );
  const kitchenHoursEnabled = rows.some(
    (r) => r.kind === "weekly" && r.schedule_role === "kitchen",
  );

  const dateExceptions = groupExceptionRowsToDateExceptions(
    rows
      .filter((r) => r.kind === "exception" && r.exception_date)
      .map((r) => ({
        id: r.id,
        exception_date: r.exception_date,
        closed: r.closed,
        opens_at: r.opens_at,
        closes_at: r.closes_at,
        note: r.note,
      })),
  );

  const hasAnyWeekly = WEEKDAY_ORDER.some(
    (d) => !weeklyHours[d].closed || weeklyHours[d].open || weeklyHours[d].close,
  );
  if (!hasAnyWeekly && !rows.length) {
    return { error: "no_opening_hours" };
  }

  return {
    weeklyHours,
    dateExceptions,
    kitchenHoursEnabled,
    kitchenWeeklyHours,
    closure: settingsRes.error
      ? defaultOpeningHoursClosure()
      : parseOpeningHoursClosure(settingsRes.data),
  };
}
