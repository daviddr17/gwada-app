import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatReservationTimeInRestaurantTz,
} from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

/** Schichtbeginn: Glocke bis zu 60 Min. vor Start. */
export const STAFF_SHIFT_BELL_START_LEAD_MS = 60 * 60 * 1000;

/** Schichtende: Glocke bis zu 60 Min. nach Ende. */
export const STAFF_SHIFT_BELL_END_TRAIL_MS = 60 * 60 * 1000;

/** Push/Cron: Schichtbeginn 15 Min. vorher bis 5 Min. danach. */
export const STAFF_SHIFT_PUSH_START_BEFORE_MS = 15 * 60 * 1000;
export const STAFF_SHIFT_PUSH_START_AFTER_MS = 5 * 60 * 1000;

/** Push/Cron: Schichtende 5 Min. vorher bis 15 Min. danach. */
export const STAFF_SHIFT_PUSH_END_BEFORE_MS = 5 * 60 * 1000;
export const STAFF_SHIFT_PUSH_END_AFTER_MS = 15 * 60 * 1000;

type ShiftRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  label: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  created_by: string | null;
  last_modified_by_profile_id: string | null;
  restaurant_staff:
    | { given_name: string | null; family_name: string | null; profile_id: string | null }
    | { given_name: string | null; family_name: string | null; profile_id: string | null }[]
    | null;
};

function staffDisplayName(staff: ShiftRow["restaurant_staff"]): string {
  const row = Array.isArray(staff) ? staff[0] : staff;
  const name = `${row?.given_name ?? ""} ${row?.family_name ?? ""}`.trim();
  return name || "Mitarbeiter";
}

function formatShiftTime(
  iso: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string {
  return formatReservationTimeInRestaurantTz(iso, timeZone);
}

export type StaffShiftNotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  at: string;
  meta: { shiftId: string; kind: "start" | "end" };
};

async function fetchDismissedShiftKeys(
  sb: SupabaseClient,
  params: { profileId: string; restaurantId: string; kind: "start" | "end" },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_shift_notification_dismissals")
    .select("shift_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("kind", params.kind);

  return new Set(
    (data ?? []).map((row) => (row as { shift_id: string }).shift_id),
  );
}

function shiftActorProfileId(s: ShiftRow): string | null {
  return s.last_modified_by_profile_id ?? s.created_by ?? null;
}

function shiftAssignedProfileId(s: ShiftRow): string | null {
  const row = Array.isArray(s.restaurant_staff) ? s.restaurant_staff[0] : s.restaurant_staff;
  return row?.profile_id ?? null;
}

/**
 * Glocke-Filter für Schichtplan-Erinnerungen.
 * - team: alle Schichten im Fenster (Mitarbeiter-Modul-Recht)
 * - own: nur eigene zugewiesene Schichten (nur Staff-Profil)
 * Self-Origin wird bewusst nicht angewandt (Zeitfenster-Erinnerung).
 */
function filterShiftsForViewer(
  shifts: ShiftRow[],
  dismissed: Set<string>,
  opts: {
    scope: "team" | "own";
    viewerStaffId: string | null;
  },
): ShiftRow[] {
  return shifts.filter((s) => {
    if (dismissed.has(s.id)) return false;
    if (opts.scope === "team") return true;
    return Boolean(opts.viewerStaffId && s.staff_id === opts.viewerStaffId);
  });
}

async function fetchViewerStaffId(
  sb: SupabaseClient,
  params: { restaurantId: string; profileId: string },
): Promise<string | null> {
  const { data } = await sb
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.profileId)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

async function fetchShiftsInRange(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    rangeStartIso: string;
    rangeEndIso: string;
  },
): Promise<ShiftRow[]> {
  const { data, error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .select(
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, created_by, last_modified_by_profile_id, restaurant_staff ( given_name, family_name, profile_id )",
    )
    .eq("restaurant_id", params.restaurantId)
    .in("status", ["confirmed", "pending"])
    .gte("starts_at", params.rangeStartIso)
    .lte("starts_at", params.rangeEndIso)
    .order("starts_at", { ascending: true });

  if (error) {
    console.warn("[gwada] staff shift bell range", error.message);
    return [];
  }

  return (data ?? []) as ShiftRow[];
}

async function fetchShiftsEndingInRange(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    rangeStartIso: string;
    rangeEndIso: string;
  },
): Promise<ShiftRow[]> {
  const { data, error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .select(
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, created_by, last_modified_by_profile_id, restaurant_staff ( given_name, family_name, profile_id )",
    )
    .eq("restaurant_id", params.restaurantId)
    .in("status", ["confirmed", "pending"])
    .gte("ends_at", params.rangeStartIso)
    .lte("ends_at", params.rangeEndIso)
    .order("ends_at", { ascending: false });

  if (error) {
    console.warn("[gwada] staff shift end bell range", error.message);
    return [];
  }

  return (data ?? []) as ShiftRow[];
}

function mapShiftToBellItem(
  s: ShiftRow,
  kind: "start" | "end",
  timeZone: string,
): StaffShiftNotificationItem {
  const name = staffDisplayName(s.restaurant_staff);
  const label = s.label?.trim();
  return {
    id: s.id,
    title: label ? `${name} · ${label}` : name,
    subtitle:
      kind === "start"
        ? `Beginn ${formatShiftTime(s.starts_at, timeZone)}`
        : `Ende ${formatShiftTime(s.ends_at, timeZone)}`,
    href: "/dashboard/mitarbeiter/schichtplan",
    at: kind === "start" ? s.starts_at : s.ends_at,
    meta: { shiftId: s.id, kind },
  };
}

export async function loadStaffShiftStartBellSummary(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    limit?: number;
    /** team = Mitarbeiter-Modul; own = nur eigenes Staff-Profil */
    scope?: "team" | "own";
  },
): Promise<{ items: StaffShiftNotificationItem[]; totalCount: number }> {
  const now = Date.now();
  const scope = params.scope ?? "own";
  const dismissed = await fetchDismissedShiftKeys(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    kind: "start",
  });

  const viewerStaffId = await fetchViewerStaffId(sb, {
    restaurantId: params.restaurantId,
    profileId: params.userId,
  });

  const shifts = await fetchShiftsInRange(sb, {
    restaurantId: params.restaurantId,
    rangeStartIso: new Date(now).toISOString(),
    rangeEndIso: new Date(now + STAFF_SHIFT_BELL_START_LEAD_MS).toISOString(),
  });

  const active = filterShiftsForViewer(shifts, dismissed, {
    scope,
    viewerStaffId,
  });
  const limit = params.limit ?? 5;
  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);

  return {
    items: active
      .slice(0, limit)
      .map((s) => mapShiftToBellItem(s, "start", timeZone)),
    totalCount: active.length,
  };
}

export async function loadStaffShiftEndBellSummary(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    limit?: number;
    scope?: "team" | "own";
  },
): Promise<{ items: StaffShiftNotificationItem[]; totalCount: number }> {
  const now = Date.now();
  const scope = params.scope ?? "own";
  const dismissed = await fetchDismissedShiftKeys(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    kind: "end",
  });

  const viewerStaffId = await fetchViewerStaffId(sb, {
    restaurantId: params.restaurantId,
    profileId: params.userId,
  });

  const shifts = await fetchShiftsEndingInRange(sb, {
    restaurantId: params.restaurantId,
    rangeStartIso: new Date(now - STAFF_SHIFT_BELL_END_TRAIL_MS).toISOString(),
    rangeEndIso: new Date(now).toISOString(),
  });

  const active = filterShiftsForViewer(shifts, dismissed, {
    scope,
    viewerStaffId,
  });
  const limit = params.limit ?? 5;
  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);

  return {
    items: active
      .slice(0, limit)
      .map((s) => mapShiftToBellItem(s, "end", timeZone)),
    totalCount: active.length,
  };
}

async function emitShiftNotificationEvents(
  admin: SupabaseClient,
  shifts: ShiftRow[],
  kind: "start" | "end",
  module: "staff_shift_start" | "staff_shift_end",
): Promise<number> {
  let created = 0;

  for (const shift of shifts) {
    const referenceId = `${shift.id}:${kind}`;
    const name = staffDisplayName(shift.restaurant_staff);
    const payload = {
      shiftId: shift.id,
      staffId: shift.staff_id,
      staffName: name,
      label: shift.label?.trim() || null,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      kind,
      actorProfileId: shiftActorProfileId(shift),
      assignedProfileId: shiftAssignedProfileId(shift),
    };

    const { data: existing } = await admin
      .from("notification_events")
      .select("id")
      .eq("module", module)
      .eq("reference_id", referenceId)
      .eq("restaurant_id", shift.restaurant_id)
      .maybeSingle();

    if (existing) continue;

    const { error } = await admin.from("notification_events").insert({
      restaurant_id: shift.restaurant_id,
      module,
      reference_id: referenceId,
      payload,
    });

    if (!error) {
      created += 1;
    } else {
      console.warn(
        "[staff-shift-notifications] emit",
        module,
        shift.id,
        error.message,
      );
    }
  }

  return created;
}

export async function runStaffShiftNotificationsCron(
  admin: SupabaseClient,
): Promise<{ eventsCreated: number }> {
  const now = Date.now();

  const startWindowFrom = new Date(
    now - STAFF_SHIFT_PUSH_START_AFTER_MS,
  ).toISOString();
  const startWindowTo = new Date(
    now + STAFF_SHIFT_PUSH_START_BEFORE_MS,
  ).toISOString();

  const endWindowFrom = new Date(
    now - STAFF_SHIFT_PUSH_END_AFTER_MS,
  ).toISOString();
  const endWindowTo = new Date(
    now + STAFF_SHIFT_PUSH_END_BEFORE_MS,
  ).toISOString();

  const { data: startShifts, error: startErr } = await admin
    .from("restaurant_staff_scheduled_shifts")
    .select(
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, created_by, last_modified_by_profile_id, restaurant_staff ( given_name, family_name, profile_id )",
    )
    .in("status", ["confirmed", "pending"])
    .gte("starts_at", startWindowFrom)
    .lte("starts_at", startWindowTo);

  if (startErr) {
    console.warn("[staff-shift-notifications] start query", startErr.message);
  }

  const { data: endShifts, error: endErr } = await admin
    .from("restaurant_staff_scheduled_shifts")
    .select(
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, created_by, last_modified_by_profile_id, restaurant_staff ( given_name, family_name, profile_id )",
    )
    .in("status", ["confirmed", "pending"])
    .gte("ends_at", endWindowFrom)
    .lte("ends_at", endWindowTo);

  if (endErr) {
    console.warn("[staff-shift-notifications] end query", endErr.message);
  }

  const startCreated = await emitShiftNotificationEvents(
    admin,
    (startShifts ?? []) as ShiftRow[],
    "start",
    "staff_shift_start",
  );

  const endCreated = await emitShiftNotificationEvents(
    admin,
    (endShifts ?? []) as ShiftRow[],
    "end",
    "staff_shift_end",
  );

  return { eventsCreated: startCreated + endCreated };
}

export async function filterStaffShiftPushTargets(
  _admin: SupabaseClient,
  event: {
    restaurant_id?: string | null;
    payload: Record<string, unknown> | null;
  },
  targets: { profileId: string; restaurantId: string }[],
): Promise<{ profileId: string; restaurantId: string }[]> {
  const assignedProfileId = event.payload?.assignedProfileId;
  if (typeof assignedProfileId !== "string" || !assignedProfileId) {
    return [];
  }
  const restaurantId =
    (typeof event.restaurant_id === "string" && event.restaurant_id) ||
    targets[0]?.restaurantId;
  if (!restaurantId) return [];

  const matched = targets.filter((t) => t.profileId === assignedProfileId);
  if (matched.length > 0) return matched;

  // Zugewiesenes Profil trotzdem zustellen, auch wenn es in der Employee-Liste fehlte.
  return [{ profileId: assignedProfileId, restaurantId }];
}

export async function dismissStaffShiftNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    shiftId: string;
    kind: "start" | "end";
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_shift_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        shift_id: params.shiftId,
        kind: params.kind,
      },
      { onConflict: "profile_id,shift_id,kind" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllStaffShiftNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    kind: "start" | "end";
    scope?: "team" | "own";
  },
): Promise<{ error: string | null }> {
  const now = Date.now();
  const scope = params.scope ?? "own";
  const dismissed = await fetchDismissedShiftKeys(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    kind: params.kind,
  });

  const viewerStaffId = await fetchViewerStaffId(sb, {
    restaurantId: params.restaurantId,
    profileId: params.userId,
  });

  const shifts =
    params.kind === "start"
      ? await fetchShiftsInRange(sb, {
          restaurantId: params.restaurantId,
          rangeStartIso: new Date(now).toISOString(),
          rangeEndIso: new Date(now + STAFF_SHIFT_BELL_START_LEAD_MS).toISOString(),
        })
      : await fetchShiftsEndingInRange(sb, {
          restaurantId: params.restaurantId,
          rangeStartIso: new Date(now - STAFF_SHIFT_BELL_END_TRAIL_MS).toISOString(),
          rangeEndIso: new Date(now).toISOString(),
        });

  const activeIds = filterShiftsForViewer(shifts, dismissed, {
    scope,
    viewerStaffId,
  }).map((s) => s.id);

  if (activeIds.length === 0) return { error: null };

  const rows = activeIds.map((shiftId) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    shift_id: shiftId,
    kind: params.kind,
  }));

  const { error } = await sb
    .from("restaurant_staff_shift_notification_dismissals")
    .upsert(rows, { onConflict: "profile_id,shift_id,kind" });

  return { error: error?.message ?? null };
}
