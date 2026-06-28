import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";

export async function fetchRestaurantIanaTimezone(
  restaurantId: string,
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();
  const tz =
    typeof (data as { timezone?: string } | null)?.timezone === "string"
      ? (data as { timezone: string }).timezone.trim()
      : "";
  return tz || DEFAULT_RESTAURANT_TIMEZONE;
}
