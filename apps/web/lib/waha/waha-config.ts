import "server-only";

import {
  isWahaPoolConfiguredAdmin,
  resolveDefaultWahaServerConfigAdmin,
  resolveWahaConfigForRestaurantAdmin,
} from "@/lib/waha/waha-server-pool";

export type WahaServerConfig = {
  baseUrl: string;
  apiKey: string;
  /** Pool-Server-ID, wenn aus waha_servers aufgelöst. */
  serverId?: string;
};

/**
 * Default-WAHA aus dem Server-Pool (oder Legacy platform_integrations).
 * Für Call-Sites ohne Restaurant — bei Multi-Server bevorzugt
 * `getWahaServerConfigForRestaurantAdmin` nutzen.
 */
export async function getWahaServerConfigAdmin(): Promise<WahaServerConfig | null> {
  return resolveDefaultWahaServerConfigAdmin();
}

export async function getWahaServerConfigForRestaurantAdmin(
  restaurantId: string,
): Promise<WahaServerConfig | null> {
  return resolveWahaConfigForRestaurantAdmin(restaurantId);
}

export async function isWahaConfiguredAdmin(): Promise<boolean> {
  return isWahaPoolConfiguredAdmin();
}
