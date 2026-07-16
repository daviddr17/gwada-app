/** Lokaler POS-LAN-Hub (iPad-Kasse ↔ iPhone-Handgeräte). */

export const POS_LAN_PROTOCOL_VERSION = 1 as const;

/** TCP-Port des Hub-HTTP-Servers auf der iPad-Kasse. */
export const POS_LAN_HUB_PORT = 8787;

/**
 * Bonjour/mDNS service type ohne `_` / `._tcp` —
 * Native Layer publiziert `_gwada-pos._tcp`.
 */
export const POS_LAN_BONJOUR_TYPE = "gwada-pos";

/** Vollständiger Bonjour-Service-Typ für Info.plist `NSBonjourServices`. */
export const POS_LAN_BONJOUR_SERVICE = "_gwada-pos._tcp";

export const POS_LAN_BONJOUR_NAME_PREFIX = "Gwada Kasse";

export const POS_LAN_HEADER_PROTOCOL = "x-gwada-pos-lan";
export const POS_LAN_HEADER_RESTAURANT_ID = "x-gwada-restaurant-id";

export const POS_LAN_PATHS = {
  health: "/v1/health",
  snapshot: "/v1/snapshot",
} as const;

export type PosLanDeviceRole = "hub" | "handheld";

export function posLanHubBaseUrl(host: string, port = POS_LAN_HUB_PORT): string {
  const cleaned = host.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const hostname = cleaned.split(":")[0] ?? cleaned;
  return `http://${hostname}:${port}`;
}

export function posLanBonjourDisplayName(restaurantName: string): string {
  const name = restaurantName.trim() || "Restaurant";
  return `${POS_LAN_BONJOUR_NAME_PREFIX} · ${name}`.slice(0, 63);
}
