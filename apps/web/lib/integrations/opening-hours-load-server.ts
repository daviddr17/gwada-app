import "server-only";

import {
  defaultKitchenWeeklyHours,
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
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
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at),
      };
    }
  }
  return weekly;
}

export async function loadOpeningHoursPayloadAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<OpeningHoursPayload | { error: string }> {
  const { data, error } = await admin
    .from("opening_hours")
    .select(
      "id, kind, weekday, exception_date, closed, opens_at, closes_at, note, schedule_role",
    )
    .eq("restaurant_id", restaurantId);

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

  const dateExceptions: DateHoursException[] = [];
  for (const raw of rows) {
    if (raw.kind === "exception" && raw.exception_date) {
      dateExceptions.push({
        id: raw.id,
        date: raw.exception_date,
        closed: raw.closed,
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at),
        note: raw.note?.trim() || undefined,
      });
    }
  }

  dateExceptions.sort((a, b) => a.date.localeCompare(b.date));

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
  };
}
