"use client";

import { RestaurantSettingsPanel } from "@/components/settings/restaurant-settings";

/** SPA-Route: Einstellungen → Öffnungszeiten. */
export function SettingsOeffnungszeitenRoute() {
  return <RestaurantSettingsPanel section="hours" />;
}
