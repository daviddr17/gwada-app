import "server-only";

import type { DashboardChecklistsSummary } from "@/lib/dashboard/dashboard-module-summary-types";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Leichte KPI-Näherung ohne vollständigen Completion-Status-Engine-Lauf. */
export async function loadDashboardChecklistsSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardChecklistsSummary> {
  const nowIso = new Date().toISOString();
  const [{ data: tzRow }, { count: openTodos }, { count: overdueTodos }, { data: completionRows }] =
    await Promise.all([
      sb
        .from("restaurants")
        .select("timezone")
        .eq("id", restaurantId)
        .maybeSingle(),
      sb
        .from("restaurant_staff_todos")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .is("archived_at", null),
      sb
        .from("restaurant_staff_todos")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .is("archived_at", null)
        .lt("display_until", nowIso),
      sb
        .from("restaurant_staff_todo_completions")
        .select("completed_at")
        .eq("restaurant_id", restaurantId)
        .not("completed_at", "is", null),
    ]);

  const timeZone =
    (tzRow as { timezone?: string | null } | null)?.timezone?.trim() ||
    DEFAULT_RESTAURANT_TIMEZONE;

  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  let capturesToday = 0;
  for (const row of completionRows ?? []) {
    const completedAt = row.completed_at as string | null;
    if (!completedAt) continue;
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(completedAt));
    if (ymd === todayYmd) capturesToday += 1;
  }

  return {
    openTodos: openTodos ?? 0,
    overdueTodos: overdueTodos ?? 0,
    capturesToday,
  };
}
