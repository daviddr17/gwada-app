/** Dashboard UI density — cookie/local first; DB optional when column exists. */

export const UI_DENSITIES = ["compact", "normal", "comfortable"] as const;

export type UiDensity = (typeof UI_DENSITIES)[number];

export const DEFAULT_UI_DENSITY: UiDensity = "normal";

export const UI_DENSITY_COOKIE = "gwada_ui_density";

export const UI_DENSITY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const UI_DENSITY_HTML_ATTR = "data-ui-density";

export const UI_DENSITY_LOCAL_STORAGE_KEY = "gwada:ui-density";

export function isUiDensity(value: string): value is UiDensity {
  return (UI_DENSITIES as readonly string[]).includes(value);
}

export function normalizeUiDensity(value: string | null | undefined): UiDensity {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return isUiDensity(raw) ? raw : DEFAULT_UI_DENSITY;
}

/** Apply density to `documentElement` (no-op on server). */
export function applyUiDensityToDocument(density: UiDensity): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(UI_DENSITY_HTML_ATTR, density);
}

export function readUiDensityCookieFromDocument(): UiDensity | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${UI_DENSITY_COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(UI_DENSITY_COOKIE.length + 1));
  return isUiDensity(raw) ? raw : null;
}

export function writeUiDensityCookie(density: UiDensity): void {
  if (typeof document === "undefined") return;
  const parts = [
    `${UI_DENSITY_COOKIE}=${encodeURIComponent(density)}`,
    "Path=/",
    `Max-Age=${UI_DENSITY_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
  ) {
    parts.push("Secure");
  }
  document.cookie = parts.join("; ");
}

export function readUiDensityLocalStorage(): UiDensity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UI_DENSITY_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return isUiDensity(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeUiDensityLocalStorage(density: UiDensity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_DENSITY_LOCAL_STORAGE_KEY, density);
  } catch {
    /* quota / private mode */
  }
}

/** Prefer cookie, then localStorage — never throws. */
export function readStoredUiDensityClient(): UiDensity | null {
  return readUiDensityCookieFromDocument() ?? readUiDensityLocalStorage();
}

/** Persist locally (cookie + localStorage). Safe without DB. */
export function persistUiDensityLocally(density: UiDensity): void {
  writeUiDensityCookie(density);
  writeUiDensityLocalStorage(density);
  applyUiDensityToDocument(density);
}

/** PostgREST / Postgres: Spalte fehlt noch (Migration nicht auf Live). */
export function isMissingUiDensityColumnError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): boolean {
  if (!error) return false;
  const code = (error.code ?? "").toUpperCase();
  if (code === "42703" || code === "PGRST204" || code === "PGRST116") {
    return true;
  }
  const hay = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return hay.includes("ui_density");
}
