import "server-only";

import {
  defaultKitchenWeeklyHours,
  defaultWeeklyHours,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { timeToHHmm } from "@/lib/supabase/opening-hours-db";
import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";

export type PublicEmbedOpeningHoursSettings = {
  embedFooterText: string | null;
  embedShowKitchenHours: boolean;
  embedShowExceptions: boolean;
};

export type PublicEmbedOpeningHoursData = {
  restaurantName: string;
  accentHex: string;
  weeklyHours: Record<Weekday, DayHours>;
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  settings: PublicEmbedOpeningHoursSettings;
};

function adminOrError() {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" as const, status: 503 as const };
  return admin;
}

function mergeWeeklyFromRows(
  rows: Array<{
    kind: string;
    weekday: Weekday | null;
    schedule_role: string | null;
    closed: boolean;
    opens_at: string | null;
    closes_at: string | null;
  }>,
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

export async function fetchPublicEmbedOpeningHours(
  slugInput: string,
): Promise<
  | { data: PublicEmbedOpeningHoursData; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug || isReservedRestaurantSlug(slug)) {
    return { data: null, error: "not_found", status: 404 };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("id, name, is_published, accent_hex")
    .eq("slug", slug)
    .maybeSingle();

  if (restaurantError || !restaurant?.id) {
    return { data: null, error: "not_found", status: 404 };
  }
  if (!restaurant.is_published) {
    return { data: null, error: "not_published", status: 404 };
  }

  const [hoursRes, settingsRes] = await Promise.all([
    admin
      .from("opening_hours")
      .select(
        "kind,weekday,exception_date,closed,opens_at,closes_at,note,schedule_role",
      )
      .eq("restaurant_id", restaurant.id),
    admin
      .from("restaurant_opening_hours_settings")
      .select(
        "embed_footer_text, embed_show_kitchen_hours, embed_show_exceptions",
      )
      .eq("restaurant_id", restaurant.id)
      .maybeSingle(),
  ]);

  const rows = hoursRes.data ?? [];
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

  const dateExceptions: DateHoursException[] = [];
  for (const raw of rows) {
    if (raw.kind === "exception" && raw.exception_date) {
      dateExceptions.push({
        id: raw.exception_date,
        date: raw.exception_date,
        closed: raw.closed,
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at),
        note: raw.note?.trim() || undefined,
      });
    }
  }
  dateExceptions.sort((a, b) => a.date.localeCompare(b.date));

  const settingsRow = settingsRes.data as {
    embed_footer_text?: string | null;
    embed_show_kitchen_hours?: boolean | null;
    embed_show_exceptions?: boolean | null;
  } | null;

  return {
    data: {
      restaurantName: restaurant.name?.trim() || "Restaurant",
      accentHex: restaurant.accent_hex?.trim() || "#6366f1",
      weeklyHours,
      kitchenHoursEnabled,
      kitchenWeeklyHours,
      dateExceptions,
      settings: {
        embedFooterText: settingsRow?.embed_footer_text?.trim() || null,
        embedShowKitchenHours: settingsRow?.embed_show_kitchen_hours ?? true,
        embedShowExceptions: settingsRow?.embed_show_exceptions ?? true,
      },
    },
    error: null,
  };
}
