"use client";

import { useEffect, useState } from "react";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";

export function useRestaurantIanaTimezone(restaurantId: string | null | undefined) {
  const [timeZone, setTimeZone] = useState(DEFAULT_RESTAURANT_TIMEZONE);

  useEffect(() => {
    if (!restaurantId) {
      setTimeZone(DEFAULT_RESTAURANT_TIMEZONE);
      return;
    }
    let cancelled = false;
    void fetchRestaurantIanaTimezone(restaurantId).then((tz) => {
      if (!cancelled) setTimeZone(tz);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return timeZone;
}
