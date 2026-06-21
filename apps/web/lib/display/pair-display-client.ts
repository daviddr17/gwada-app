"use client";

import {
  getOrCreateDisplayInstallationId,
  saveDisplayDeviceCredential,
} from "@/lib/display/display-device-storage";

export type PairDisplayClientResult =
  | {
      ok: true;
      slug: string;
      restaurantName?: string;
      accentHex?: string | null;
      displayId: string;
    }
  | { ok: false; message: string };

export async function pairDisplayWithCode(
  code: string,
): Promise<PairDisplayClientResult> {
  const installationId = getOrCreateDisplayInstallationId();
  const res = await fetch("/api/display/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code, installation_id: installationId }),
  });
  const data = (await res.json()) as {
    error?: string;
    restaurant?: { slug: string; name?: string; accent_hex?: string | null };
    display_id?: string;
    device_token?: string;
    installation_id?: string;
  };

  if (!res.ok) {
    const message =
      data.error === "code_expired"
        ? "Code abgelaufen — bitte neuen Kopplungscode erzeugen."
        : data.error === "code_not_found" || data.error === "invalid_code"
          ? "Code ungültig — bitte aktuellen Code aus den Einstellungen nutzen."
          : data.error === "display_inactive"
            ? "Display ist deaktiviert."
            : data.error === "server_misconfigured"
              ? "Server-Konfiguration unvollständig."
              : data.error === "restaurant_not_found"
                ? "Restaurant nicht gefunden."
                : "Kopplung fehlgeschlagen.";
    return { ok: false, message };
  }

  if (data.display_id && data.device_token && data.installation_id) {
    saveDisplayDeviceCredential({
      displayId: data.display_id,
      token: data.device_token,
      installationId: data.installation_id,
    });
  }

  const slug = data.restaurant?.slug?.trim();
  if (!slug) {
    return { ok: false, message: "Display-Link konnte nicht ermittelt werden." };
  }

  return {
    ok: true,
    slug,
    restaurantName: data.restaurant?.name,
    accentHex: data.restaurant?.accent_hex ?? null,
    displayId: data.display_id ?? "",
  };
}
