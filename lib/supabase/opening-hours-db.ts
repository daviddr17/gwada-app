import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";
import type {
  DateHoursException,
  DayHours,
  RestaurantProfile,
  Weekday,
} from "@/lib/types/restaurant";

export function openingHoursDbEnabled(): boolean {
  return workspacePersistenceConfigured();
}

function timeToHHmm(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  const h = m[1]!.padStart(2, "0");
  return `${h}:${m[2]}`;
}

/** Client-Zeiten (z. B. `9:30`) → `09:30` für Postgres-`time`. */
export function normalizeScheduleHHmm(
  s: string | undefined,
): string | undefined {
  return timeToHHmm(s);
}

function hhmmToPgTime(s: string | undefined): string | null {
  const normalized = timeToHHmm(s);
  if (!normalized) return null;
  return `${normalized}:00`;
}

export type OpeningHoursSaveResult =
  | { ok: true }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidRestaurantId(id: string): boolean {
  return UUID_RE.test(id);
}

type OpeningHoursRow = {
  id: string;
  restaurant_id: string;
  kind: "weekly" | "exception";
  weekday: Weekday | null;
  exception_date: string | null;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note: string | null;
};

export async function loadOpeningHoursForRestaurant(
  restaurantId: string,
): Promise<{
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  wasEmpty: boolean;
} | null> {
  if (!openingHoursDbEnabled()) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("opening_hours")
    .select(
      "id,restaurant_id,kind,weekday,exception_date,closed,opens_at,closes_at,note",
    )
    .eq("restaurant_id", restaurantId);
  if (error) {
    console.warn("[gwada] opening_hours load", error.message);
    return null;
  }

  const wasEmpty = !data?.length;
  const weeklyHours = defaultWeeklyHours() as Record<Weekday, DayHours>;
  const dateExceptions: DateHoursException[] = [];

  for (const raw of (data ?? []) as OpeningHoursRow[]) {
    if (raw.kind === "weekly" && raw.weekday) {
      weeklyHours[raw.weekday] = {
        closed: raw.closed,
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at),
      };
    } else if (raw.kind === "exception" && raw.exception_date) {
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

  return { weeklyHours, dateExceptions, wasEmpty };
}

export function weeklyHoursEqualDefault(
  w: Record<Weekday, DayHours>,
): boolean {
  const d = defaultWeeklyHours();
  return WEEKDAY_ORDER.every(
    (day) =>
      w[day].closed === d[day].closed &&
      w[day].open === d[day].open &&
      w[day].close === d[day].close,
  );
}

export async function replaceOpeningHoursForRestaurant(
  restaurantId: string,
  profile: Pick<
    RestaurantProfile,
    "weeklyHours" | "dateExceptions"
  >,
): Promise<OpeningHoursSaveResult> {
  if (!openingHoursDbEnabled()) {
    return { ok: false, error: "Supabase ist nicht konfiguriert." };
  }
  const supabase = createSupabaseBrowserClient();

  const { error: delErr } = await supabase
    .from("opening_hours")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (delErr) {
    console.warn("[gwada] opening_hours delete", delErr.message);
    return { ok: false, error: delErr.message };
  }

  const inserts: Record<string, unknown>[] = [];

  for (const day of WEEKDAY_ORDER) {
    const h = profile.weeklyHours[day];
    inserts.push({
      restaurant_id: restaurantId,
      kind: "weekly",
      weekday: day,
      exception_date: null,
      closed: h.closed,
      opens_at: h.closed ? null : hhmmToPgTime(h.open),
      closes_at: h.closed ? null : hhmmToPgTime(h.close),
      note: null,
    });
  }

  for (const ex of profile.dateExceptions) {
    const idOk = isUuidRestaurantId(ex.id);
    const row: Record<string, unknown> = {
      restaurant_id: restaurantId,
      kind: "exception",
      weekday: null,
      exception_date: ex.date,
      closed: ex.closed,
      opens_at: ex.closed ? null : hhmmToPgTime(ex.open),
      closes_at: ex.closed ? null : hhmmToPgTime(ex.close),
      note: ex.note?.trim() || null,
    };
    if (idOk) row.id = ex.id;
    inserts.push(row);
  }

  const { error: insErr } = await supabase.from("opening_hours").insert(inserts);
  if (insErr) {
    console.warn("[gwada] opening_hours insert", insErr.message);
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}
