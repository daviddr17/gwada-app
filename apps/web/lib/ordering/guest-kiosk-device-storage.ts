/** Client-side guest kiosk device credential (localStorage), Display-style. */

const INSTALLATION_KEY = "gwada-guest-kiosk-installation-id";
const CREDENTIAL_KEY = "gwada-guest-kiosk-device-credential";

export type StoredGuestKioskDeviceCredential = {
  deviceId: string;
  token: string;
  installationId: string;
  restaurantSlug: string;
  deviceName?: string;
  mollieTerminalId?: string | null;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getOrCreateGuestKioskInstallationId(): string {
  if (!canUseStorage()) {
    return `tmp-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  const existing = localStorage.getItem(INSTALLATION_KEY)?.trim();
  if (existing && existing.length >= 8) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

export function saveGuestKioskDeviceCredential(
  credential: StoredGuestKioskDeviceCredential,
): void {
  if (!canUseStorage()) return;
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
}

export function readGuestKioskDeviceCredential(): StoredGuestKioskDeviceCredential | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestKioskDeviceCredential;
    if (
      typeof parsed?.deviceId !== "string" ||
      typeof parsed?.token !== "string" ||
      typeof parsed?.installationId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuestKioskDeviceCredential(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(CREDENTIAL_KEY);
}

export function guestKioskDeviceHeaderValue(
  credential: StoredGuestKioskDeviceCredential,
): string {
  return `${credential.deviceId}.${credential.token}`;
}
