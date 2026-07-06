"use client";

import { createId } from "@/lib/create-id";

const INSTALLATION_ID_KEY = "gwada-display-installation-id";
const DEVICE_CREDENTIAL_KEY = "gwada-display-device-credential";
const RESTAURANT_SLUG_KEY = "gwada-display-restaurant-slug";

export type StoredDisplayDeviceCredential = {
  displayId: string;
  token: string;
  installationId: string;
};

/** Stabile Geräte-ID pro Browser/Tablet (kein MAC — im Web nicht verfügbar). */
export function getOrCreateDisplayInstallationId(): string {
  if (typeof window === "undefined") return createId();
  try {
    let id = localStorage.getItem(INSTALLATION_ID_KEY)?.trim();
    if (!id || id.length < 8) {
      id =
        typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : createId();
      localStorage.setItem(INSTALLATION_ID_KEY, id);
    }
    return id;
  } catch {
    return createId();
  }
}

export function saveDisplayDeviceCredential(
  cred: StoredDisplayDeviceCredential,
  restaurantSlug?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEVICE_CREDENTIAL_KEY, JSON.stringify(cred));
    const slug = restaurantSlug?.trim();
    if (slug) {
      localStorage.setItem(RESTAURANT_SLUG_KEY, slug);
    }
  } catch {
    /* Speicher voll / privater Modus */
  }
}

export function readDisplayRestaurantSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(RESTAURANT_SLUG_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function readDisplayDeviceCredential(): StoredDisplayDeviceCredential | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEVICE_CREDENTIAL_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredDisplayDeviceCredential>;
    if (
      typeof data.displayId !== "string" ||
      typeof data.token !== "string" ||
      typeof data.installationId !== "string" ||
      !data.displayId ||
      !data.token ||
      !data.installationId
    ) {
      return null;
    }
    return {
      displayId: data.displayId,
      token: data.token,
      installationId: data.installationId,
    };
  } catch {
    return null;
  }
}

export function clearDisplayDeviceCredential(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DEVICE_CREDENTIAL_KEY);
    localStorage.removeItem(RESTAURANT_SLUG_KEY);
  } catch {
    /* ignore */
  }
}
