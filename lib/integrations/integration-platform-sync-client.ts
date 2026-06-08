export type IntegrationPlatformSyncTarget =
  | "opening_hours_google"
  | "opening_hours_facebook"
  | "kitchen_hours_google"
  | "opening_exceptions_google"
  | "menu_google";

export const INTEGRATION_PLATFORM_SYNC_ENDPOINTS: Record<
  IntegrationPlatformSyncTarget,
  string
> = {
  opening_hours_google: "/api/integrations/google-business/sync-opening-hours",
  opening_hours_facebook: "/api/integrations/facebook/sync-opening-hours",
  kitchen_hours_google: "/api/integrations/google-business/sync-kitchen-hours",
  opening_exceptions_google:
    "/api/integrations/google-business/sync-opening-exceptions",
  menu_google: "/api/integrations/google-business/sync-menu",
};

export function integrationPlatformSyncLabel(
  target: IntegrationPlatformSyncTarget,
): "Google" | "Facebook" {
  return target === "opening_hours_facebook" ? "Facebook" : "Google";
}

export function integrationSyncSuccessMessage(
  target: IntegrationPlatformSyncTarget,
  itemCount?: number,
): string {
  switch (target) {
    case "opening_hours_google":
      return "Öffnungszeiten wurden übertragen.";
    case "opening_hours_facebook":
      return "Öffnungszeiten wurden übertragen.";
    case "kitchen_hours_google":
      return "Küchenzeiten wurden übertragen.";
    case "opening_exceptions_google":
      return "Zukünftige Ausnahmen wurden übertragen.";
    case "menu_google":
      return itemCount != null
        ? `Speisekarte übertragen (${itemCount} ${itemCount === 1 ? "Gericht" : "Gerichte"}).`
        : "Speisekarte wurde übertragen.";
    default:
      return "Erfolgreich übertragen.";
  }
}

export async function postIntegrationPlatformSync(
  target: IntegrationPlatformSyncTarget,
  restaurantId: string,
): Promise<
  { ok: true; itemCount?: number } | { ok: false; error: string }
> {
  const res = await fetch(INTEGRATION_PLATFORM_SYNC_ENDPOINTS[target], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    itemCount?: number;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? "sync_failed" };
  }
  return { ok: true, itemCount: data.itemCount };
}
