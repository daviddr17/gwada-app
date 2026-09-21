import {
  loadOpeningHoursForRestaurant,
  replaceOpeningHoursForRestaurant,
} from "@/lib/supabase/opening-hours-db";
import type { DateHoursException } from "@/lib/types/restaurant";

export type CalendarHoursMutationResult =
  | { ok: true }
  | { ok: false; error: string };

async function persistDateExceptions(
  restaurantId: string,
  dateExceptions: DateHoursException[],
): Promise<CalendarHoursMutationResult> {
  const loaded = await loadOpeningHoursForRestaurant(restaurantId);
  if (!loaded) {
    return { ok: false, error: "Öffnungszeiten konnten nicht geladen werden." };
  }
  const sorted = [...dateExceptions].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const result = await replaceOpeningHoursForRestaurant(restaurantId, {
    weeklyHours: loaded.weeklyHours,
    dateExceptions: sorted,
    kitchenHoursEnabled: loaded.kitchenHoursEnabled,
    kitchenWeeklyHours: loaded.kitchenWeeklyHours,
  });
  if (!result.ok) {
    return { ok: false, error: result.error || "Speichern fehlgeschlagen." };
  }
  return { ok: true };
}

export async function upsertCalendarDateException(
  restaurantId: string,
  exception: DateHoursException,
): Promise<CalendarHoursMutationResult> {
  const loaded = await loadOpeningHoursForRestaurant(restaurantId);
  if (!loaded) {
    return { ok: false, error: "Öffnungszeiten konnten nicht geladen werden." };
  }
  const dateExceptions = [
    ...loaded.dateExceptions.filter((ex) => ex.date !== exception.date),
    exception,
  ];
  return persistDateExceptions(restaurantId, dateExceptions);
}

export async function removeCalendarDateException(
  restaurantId: string,
  date: string,
): Promise<CalendarHoursMutationResult> {
  const loaded = await loadOpeningHoursForRestaurant(restaurantId);
  if (!loaded) {
    return { ok: false, error: "Öffnungszeiten konnten nicht geladen werden." };
  }
  const dateExceptions = loaded.dateExceptions.filter((ex) => ex.date !== date);
  return persistDateExceptions(restaurantId, dateExceptions);
}

export function newClosedCalendarException(
  date: string,
  existing?: DateHoursException | null,
): DateHoursException {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    date,
    closed: true,
    note: existing?.note ?? "Geschlossen (Kalender)",
  };
}

export function newOpenCalendarException(
  date: string,
  existing?: DateHoursException | null,
  defaults?: { open: string; close: string },
): DateHoursException {
  const open = defaults?.open ?? "11:30";
  const close = defaults?.close ?? "22:00";
  return {
    id: existing?.id ?? crypto.randomUUID(),
    date,
    closed: false,
    periods: [{ open, close }],
    open,
    close,
    note: existing?.note,
  };
}
