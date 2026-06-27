export type ProfileDisplayPinStatus = {
  hasPin: boolean;
  setAt: string | null;
  selfServiceEnabled: boolean;
};

function displayPinErrorMessage(error: string | undefined): string {
  switch (error) {
    case "invalid_password":
      return "Das Passwort ist falsch.";
    case "pin_format":
      return "Die PIN muss genau vier Ziffern haben.";
    case "pin_mismatch":
      return "Die PIN-Bestätigung stimmt nicht überein.";
    case "pin_duplicate":
      return "Diese PIN wird im Restaurant bereits von einem anderen Mitarbeiter verwendet.";
    case "password_auth_required":
      return "Display-PIN kann nur mit E-Mail-Passwort geändert werden (nicht bei reiner OAuth-Anmeldung).";
    case "self_service_disabled":
      return "Self-Service für Display-PIN ist für dieses Restaurant deaktiviert.";
    case "no_staff_profile":
      return "Dein Profil ist mit keinem Mitarbeiterdatensatz verknüpft.";
    default:
      return "Display-PIN konnte nicht gespeichert werden.";
  }
}

export async function fetchProfileDisplayPinStatus(params: {
  restaurantId: string;
}): Promise<{ data: ProfileDisplayPinStatus | null; error: string | null }> {
  try {
    const res = await globalThis.fetch(
      `/api/profile/display-pin?${new URLSearchParams({
        restaurantId: params.restaurantId,
      })}`,
      { cache: "no-store", credentials: "include" },
    );
    const json = (await res.json()) as {
      has_pin?: boolean;
      set_at?: string | null;
      self_service_enabled?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { data: null, error: displayPinErrorMessage(json.error) };
    }
    return {
      data: {
        hasPin: Boolean(json.has_pin),
        setAt: json.set_at ?? null,
        selfServiceEnabled: Boolean(json.self_service_enabled),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Netzwerkfehler." };
  }
}

export async function saveProfileDisplayPin(params: {
  restaurantId: string;
  pin: string | null;
  pinConfirm?: string;
  currentPassword: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await globalThis.fetch("/api/profile/display-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        restaurantId: params.restaurantId,
        pin: params.pin,
        pinConfirm: params.pinConfirm,
        currentPassword: params.currentPassword,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: displayPinErrorMessage(json.error) };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Netzwerkfehler." };
  }
}
