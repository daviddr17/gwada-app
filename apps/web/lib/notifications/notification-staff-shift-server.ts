import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
  restaurant_staff:
    | { given_name: string | null; family_name: string | null }
    | { given_name: string | null; family_name: string | null }[]
    | null;
};

function staffDisplayName(staff: ShiftRow["restaurant_staff"]): string {
  const row = Array.isArray(staff) ? staff[0] : staff;
  const name = `${row?.given_name ?? ""} ${row?.family_name ?? ""}`.trim();
  return name || "Mitarbeiter";
}

function formatShiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, restaurant_staff ( given_name, family_name )",
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
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, restaurant_staff ( given_name, family_name )",
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
): StaffShiftNotificationItem {
  const name = staffDisplayName(s.restaurant_staff);
  const label = s.label?.trim();
  return {
    id: s.id,
    title: label ? `${name} · ${label}` : name,
    subtitle:
      kind === "start"
        ? `Beginn ${formatShiftTime(s.starts_at)}`
        : `Ende ${formatShiftTime(s.ends_at)}`,
    href: "/dashboard/mitarbeiter/schichtplan",
    at: kind === "start" ? s.starts_at : s.ends_at,
    meta: { shiftId: s.id, kind },
  };
}

export async function loadStaffShiftStartBellSummary(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
): Promise<{ items: StaffShiftNotificationItem[]; totalCount: number }> {
  const now = Date.now();
  const dismissed = await fetchDismissedShiftKeys(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    kind: "start",
  });

  const shifts = await fetchShiftsInRange(sb, {
    restaurantId: params.restaurantId,
    rangeStartIso: new Date(now).toISOString(),
    rangeEndIso: new Date(now + STAFF_SHIFT_BELL_START_LEAD_MS).toISOString(),
  });

  const active = shifts.filter((s) => !dismissed.has(s.id));
  const limit = params.limit ?? 5;

  return {
    items: active.slice(0, limit).map((s) => mapShiftToBellItem(s, "start")),
    totalCount: active.length,
  };
}

export async function loadStaffShiftEndBellSummary(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
): Promise<{ items: StaffShiftNotificationItem[]; totalCount: number }> {
  const now = Date.now();
  const dismissed = await fetchDismissedShiftKeys(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    kind: "end",
  });

  const shifts = await fetchShiftsEndingInRange(sb, {
    restaurantId: params.restaurantId,
    rangeStartIso: new Date(now - STAFF_SHIFT_BELL_END_TRAIL_MS).toISOString(),
    rangeEndIso: new Date(now).toISOString(),
  });

  const active = shifts.filter((s) => !dismissed.has(s.id));
  const limit = params.limit ?? 5;

  return {
    items: active.slice(0, limit).map((s) => mapShiftToBellItem(s, "end")),
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
      staffName: name,
      label: shift.label?.trim() || null,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      kind,
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
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, restaurant_staff ( given_name, family_name )",
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
      "id, restaurant_id, staff_id, label, starts_at, ends_at, status, restaurant_staff ( given_name, family_name )",
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
  },
): Promise<{ error: string | null }> {
  const summary =
    params.kind === "start"
      ? await loadStaffShiftStartBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: 500,
        })
      : await loadStaffShiftEndBellSummary(sb, {
          restaurantId: params.restaurantId,
          userId: params.userId,
          limit: 500,
        });

  if (summary.items.length === 0) return { error: null };

  const rows = summary.items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    shift_id: item.id,
    kind: params.kind,
  }));

  const { error } = await sb
    .from("restaurant_staff_shift_notification_dismissals")
    .upsert(rows, { onConflict: "profile_id,shift_id,kind" });

  return { error: error?.message ?? null };
}
