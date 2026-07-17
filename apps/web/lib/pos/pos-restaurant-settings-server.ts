import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantPosSettings = {
  restaurantId: string;
  inventoryBookingEnabled: boolean;
};

export async function getRestaurantPosSettings(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantPosSettings> {
  const { data, error } = await supabase
    .from("restaurant_pos_settings")
    .select("restaurant_id, inventory_booking_enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.warn("[pos] settings load", error.message);
  }

  return {
    restaurantId,
    inventoryBookingEnabled: Boolean(data?.inventory_booking_enabled),
  };
}

export async function upsertRestaurantPosSettings(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  inventoryBookingEnabled: boolean;
}): Promise<RestaurantPosSettings | null> {
  const { data, error } = await params.supabase
    .from("restaurant_pos_settings")
    .upsert(
      {
        restaurant_id: params.restaurantId,
        inventory_booking_enabled: params.inventoryBookingEnabled,
      },
      { onConflict: "restaurant_id" },
    )
    .select("restaurant_id, inventory_booking_enabled")
    .single();

  if (error || !data) {
    console.warn("[pos] settings upsert", error?.message);
    return null;
  }

  return {
    restaurantId: data.restaurant_id as string,
    inventoryBookingEnabled: Boolean(data.inventory_booking_enabled),
  };
}
