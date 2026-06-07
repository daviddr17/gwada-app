import type { DashboardWidgetPrefs } from "@/lib/constants/dashboard-widgets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type RawDashboardWidgetRow = {
  order: string[];
  visibility: Record<string, unknown>;
};

export async function loadUserRestaurantDashboardWidgets(
  profileId: string,
  restaurantId: string,
): Promise<RawDashboardWidgetRow | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_restaurant_dashboard_widgets")
    .select("widget_order, widget_visibility")
    .eq("profile_id", profileId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    order: Array.isArray(data.widget_order)
      ? (data.widget_order as string[])
      : [],
    visibility:
      data.widget_visibility &&
      typeof data.widget_visibility === "object" &&
      !Array.isArray(data.widget_visibility)
        ? (data.widget_visibility as Record<string, unknown>)
        : {},
  };
}

export async function upsertUserRestaurantDashboardWidgets(
  profileId: string,
  restaurantId: string,
  prefs: DashboardWidgetPrefs,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("user_restaurant_dashboard_widgets").upsert(
    {
      profile_id: profileId,
      restaurant_id: restaurantId,
      widget_order: prefs.order,
      widget_visibility: prefs.visibility,
    },
    { onConflict: "profile_id,restaurant_id" },
  );
  if (error) {
    console.warn("[gwada] upsertUserRestaurantDashboardWidgets", error.message);
    return false;
  }
  return true;
}
