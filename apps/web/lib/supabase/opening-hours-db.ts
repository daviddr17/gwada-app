import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/ensure-browser-session";
import {
  defaultKitchenWeeklyHours,
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";
import { groupExceptionRowsToDateExceptions } from "@/lib/opening-hours/group-exception-rows";
import { exceptionOpenPeriods } from "@/lib/opening-hours/hours-periods";
import type {
  DateHoursException,
  DayHours,
  RestaurantProfile,
  Weekday,
} from "@/lib/types/restaurant";

export type OpeningHoursScheduleRole = "business" | "kitchen";

export function openingHoursDbEnabled(): boolean {
  return workspacePersistenceConfigured();
}

export function timeToHHmm(t: string | null | undefined): string | undefined {
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
  schedule_role: OpeningHoursScheduleRole;
};

function mergeWeeklyFromRows(
  rows: OpeningHoursRow[],
  role: OpeningHoursScheduleRole,
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

export async function loadOpeningHoursForRestaurant(
  restaurantId: string,
): Promise<{
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
  wasEmpty: boolean;
} | null> {
  if (!openingHoursDbEnabled()) return null;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("opening_hours")
    .select(
      "id,restaurant_id,kind,weekday,exception_date,closed,opens_at,closes_at,note,schedule_role",
    )
    .eq("restaurant_id", restaurantId);
  if (error) {
    console.warn("[gwada] opening_hours load", error.message);
    return null;
  }

  const rows = (data ?? []) as OpeningHoursRow[];
  const wasEmpty = !rows.length;
  const weeklyHours = mergeWeeklyFromRows(
    rows,
    "business",
    defaultWeeklyHours(),
  );
  const kitchenWeeklyHours = mergeWeeklyFromRows(
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

  return {
    weeklyHours,
    dateExceptions,
    kitchenHoursEnabled,
    kitchenWeeklyHours,
    wasEmpty,
  };
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

function pushWeeklyInserts(
  inserts: Record<string, unknown>[],
  restaurantId: string,
  scheduleRole: OpeningHoursScheduleRole,
  weekly: Record<Weekday, DayHours>,
) {
  for (const day of WEEKDAY_ORDER) {
    const h = weekly[day];
    inserts.push({
      restaurant_id: restaurantId,
      kind: "weekly",
      weekday: day,
      exception_date: null,
      closed: h.closed,
      opens_at: h.closed ? null : hhmmToPgTime(h.open),
      closes_at: h.closed ? null : hhmmToPgTime(h.close),
      note: null,
      schedule_role: scheduleRole,
    });
  }
}

export async function replaceOpeningHoursForRestaurant(
  restaurantId: string,
  profile: Pick<
    RestaurantProfile,
    | "weeklyHours"
    | "dateExceptions"
    | "kitchenHoursEnabled"
    | "kitchenWeeklyHours"
  >,
): Promise<OpeningHoursSaveResult> {
  if (!openingHoursDbEnabled()) {
    return { ok: false, error: "Supabase ist nicht konfiguriert." };
  }
  const supabase = createSupabaseBrowserClient();

  const sessionOk = await ensureBrowserSupabaseSession(supabase);
  if (!sessionOk.ok) {
    return sessionOk;
  }

  const rows = buildOpeningHoursReplaceRows(restaurantId, profile);

  // Bevorzugt atomare RPC (DELETE+INSERT in einer Transaktion). Fallback ohne
  // Function: alte Zeilen laden, löschen, neu einfügen; bei Insert-Fehler den
  // vorherigen Stand zurückschreiben — Unique-Indexes erlauben kein Insert-first.
  const { error: rpcErr } = await supabase.rpc("replace_opening_hours", {
    p_restaurant_id: restaurantId,
    p_rows: rows,
  });
  if (!rpcErr) {
    return { ok: true };
  }
  if (!isMissingReplaceOpeningHoursRpc(rpcErr.message)) {
    console.warn("[gwada] replace_opening_hours", rpcErr.message);
    return { ok: false, error: rpcErr.message };
  }

  const { data: existingRows, error: loadErr } = await supabase
    .from("opening_hours")
    .select(
      "id,restaurant_id,kind,weekday,exception_date,closed,opens_at,closes_at,note,schedule_role",
    )
    .eq("restaurant_id", restaurantId);
  if (loadErr) {
    console.warn("[gwada] opening_hours load", loadErr.message);
    return { ok: false, error: loadErr.message };
  }
  const previous = (existingRows ?? []) as OpeningHoursRow[];

  const { error: delErr } = await supabase
    .from("opening_hours")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (delErr) {
    console.warn("[gwada] opening_hours delete", delErr.message);
    return { ok: false, error: delErr.message };
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("opening_hours").insert(rows);
    if (insErr) {
      console.warn("[gwada] opening_hours insert", insErr.message);
      if (previous.length > 0) {
        const restore = previous.map(
          ({
            restaurant_id,
            kind,
            weekday,
            exception_date,
            closed,
            opens_at,
            closes_at,
            note,
            schedule_role,
          }) => ({
            restaurant_id,
            kind,
            weekday,
            exception_date,
            closed,
            opens_at,
            closes_at,
            note,
            schedule_role: schedule_role ?? "business",
          }),
        );
        const { error: restoreErr } = await supabase
          .from("opening_hours")
          .insert(restore);
        if (restoreErr) {
          console.warn("[gwada] opening_hours restore", restoreErr.message);
        }
      }
      return { ok: false, error: insErr.message };
    }
  }
  return { ok: true };
}

function buildOpeningHoursReplaceRows(
  restaurantId: string,
  profile: Pick<
    RestaurantProfile,
    | "weeklyHours"
    | "dateExceptions"
    | "kitchenHoursEnabled"
    | "kitchenWeeklyHours"
  >,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  pushWeeklyInserts(rows, restaurantId, "business", profile.weeklyHours);
  if (profile.kitchenHoursEnabled) {
    pushWeeklyInserts(
      rows,
      restaurantId,
      "kitchen",
      profile.kitchenWeeklyHours,
    );
  }
  for (const ex of profile.dateExceptions) {
    if (ex.closed) {
      rows.push({
        restaurant_id: restaurantId,
        kind: "exception",
        weekday: null,
        exception_date: ex.date,
        closed: true,
        opens_at: null,
        closes_at: null,
        note: ex.note?.trim() || null,
        schedule_role: "business",
      });
      continue;
    }
    const periods = exceptionOpenPeriods(ex);
    for (const period of periods) {
      rows.push({
        restaurant_id: restaurantId,
        kind: "exception",
        weekday: null,
        exception_date: ex.date,
        closed: false,
        opens_at: hhmmToPgTime(period.open),
        closes_at: hhmmToPgTime(period.close),
        note: ex.note?.trim() || null,
        schedule_role: "business",
      });
    }
  }
  return rows;
}

function isMissingReplaceOpeningHoursRpc(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("replace_opening_hours") &&
    (m.includes("does not exist") ||
      m.includes("could not find") ||
      m.includes("schema cache") ||
      m.includes("pgrst202") ||
      m.includes("42883"))
  );
}
