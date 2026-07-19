import "server-only";

import { scheduleNotificationDeliverForEvent } from "@/lib/notifications/schedule-notification-deliver";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import { formatReservationTimeInRestaurantTz } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DISPLAY_CLOCK_MODULES = [
  "staff_display_clock_in",
  "staff_display_clock_out",
] as const;

export type DisplayClockModule = (typeof DISPLAY_CLOCK_MODULES)[number];

/** Glocke: Display-Stempelevents der letzten 36 Stunden. */
const DISPLAY_CLOCK_BELL_LOOKBACK_MS = 36 * 60 * 60 * 1000;

export function isDisplayClockNotificationModule(
  module: NotificationModuleId,
): module is DisplayClockModule {
  return (DISPLAY_CLOCK_MODULES as readonly string[]).includes(module);
}

function formatClockTime(iso: string, timeZone: string): string {
  return formatReservationTimeInRestaurantTz(iso, timeZone);
}

async function fetchDismissedShiftIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    module: DisplayClockModule;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_display_clock_notification_dismissals")
    .select("shift_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module);

  return new Set(
    (data ?? []).map((row) => (row as { shift_id: string }).shift_id),
  );
}

export async function loadStaffDisplayClockNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: DisplayClockModule;
    limit?: number;
  },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const limit = params.limit ?? 5;
  const def = NOTIFICATION_MODULES[params.module];
  const dismissed = await fetchDismissedShiftIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    module: params.module,
  });

  const sinceIso = new Date(
    Date.now() - DISPLAY_CLOCK_BELL_LOOKBACK_MS,
  ).toISOString();

  const { data: events, error } = await sb
    .from("notification_events")
    .select("id, reference_id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[gwada] display clock bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const timeZone = await fetchRestaurantTimezoneServer(sb, params.restaurantId);

  const rows = (events ?? []).filter((raw) => {
    const row = raw as { reference_id: string };
    return !dismissed.has(row.reference_id);
  });

  const items = rows.slice(0, limit).map((raw) => {
    const row = raw as {
      reference_id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = row.payload ?? {};
    const staffName =
      typeof payload.staffName === "string" && payload.staffName.trim()
        ? payload.staffName.trim()
        : "Mitarbeiter";
    const at =
      typeof payload.at === "string" && payload.at
        ? payload.at
        : row.created_at;
    const staffId =
      typeof payload.staffId === "string" ? payload.staffId.trim() : "";
    const autoClockOut = payload.auto === true;
    const href =
      staffId.length > 0
        ? `${def.href}?staff=${encodeURIComponent(staffId)}`
        : def.href;

    const title =
      params.module === "staff_display_clock_in"
        ? "Display: Schicht gestartet"
        : autoClockOut
          ? "Display: Auto-Abmeldung"
          : "Display: Schicht beendet";
    const timeLabel = formatClockTime(at, timeZone);
    const subtitle = autoClockOut
      ? `${staffName} · Auto-Abmeldung${timeLabel ? ` · ${timeLabel}` : ""}`
      : `${staffName}${timeLabel ? ` · ${timeLabel}` : ""}`;

    return {
      id: row.reference_id,
      title,
      subtitle,
      href,
      at,
      meta: {
        shiftId: row.reference_id,
        staffId,
      },
    };
  });

  return { items, totalCount: rows.length };
}

export async function dismissStaffDisplayClockNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    shiftId: string;
    module: DisplayClockModule;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_display_clock_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        shift_id: params.shiftId,
        module: params.module,
      },
      { onConflict: "profile_id,restaurant_id,shift_id,module" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllStaffDisplayClockNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: DisplayClockModule;
  },
): Promise<{ error: string | null }> {
  const { items } = await loadStaffDisplayClockNotificationItems(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    module: params.module,
    limit: 100,
  });

  if (items.length === 0) return { error: null };

  const rows = items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    shift_id: item.id,
    module: params.module,
  }));

  const { error } = await sb
    .from("restaurant_staff_display_clock_notification_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,shift_id,module",
    });

  return { error: error?.message ?? null };
}

async function loadStaffDisplayName(
  admin: SupabaseClient,
  staffId: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("given_name, family_name")
    .eq("id", staffId)
    .maybeSingle();

  const name = `${(data as { given_name?: string | null } | null)?.given_name ?? ""} ${(data as { family_name?: string | null } | null)?.family_name ?? ""}`.trim();
  return name || "Mitarbeiter";
}

/** Nach erfolgreichem Display clock_in / clock_out Event + Sofort-Push. */
export async function emitStaffDisplayClockNotification(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    shiftId: string;
    action: "clock_in" | "clock_out";
    at: string;
    /** Automatische Abmeldung nach eingestellter Dauer. */
    auto?: boolean;
  },
): Promise<void> {
  const module: DisplayClockModule =
    params.action === "clock_in"
      ? "staff_display_clock_in"
      : "staff_display_clock_out";

  const staffName = await loadStaffDisplayName(admin, params.staffId);

  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", module)
    .eq("reference_id", params.shiftId)
    .maybeSingle();

  if (existing) return;

  const { data, error } = await admin
    .from("notification_events")
    .insert({
      restaurant_id: params.restaurantId,
      module,
      reference_id: params.shiftId,
      payload: {
        shiftId: params.shiftId,
        staffId: params.staffId,
        staffName,
        action: params.action,
        at: params.at,
        ...(params.auto ? { auto: true } : {}),
      },
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[display-clock-notifications] emit", module, error.message);
    return;
  }

  const eventId = (data as { id: string } | null)?.id;
  if (eventId) {
    scheduleNotificationDeliverForEvent(admin, eventId);
  }
}
