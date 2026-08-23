"use client";

import { RestaurantSettingsPanel } from "@/components/settings/restaurant-settings";

/** SPA-Route: Einstellungen → Übersicht (Stammdaten). */
export function SettingsRestaurantRoute() {
  return <RestaurantSettingsPanel section="restaurant" />;
}
