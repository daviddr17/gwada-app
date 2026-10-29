/**
 * „Angemeldet bleiben“ — steuert, ob Auth-Session-Cookies persistent
 * (langer Max-Age, Standard) oder Session-Cookies (Browser-Schluss = weg) sind.
 *
 * @supabase/ssr erzwingt beim Schreiben immer maxAge ≈ 400 Tage; wir kürzen
 * das in den setAll-Hooks, wenn der Nutzer die Option abwählt.
 */

export const STAY_SIGNED_IN_COOKIE = "gwada_stay_signed_in";
export const STAY_SIGNED_IN_STORAGE_KEY = "gwada:stay-signed-in";

/** Restaurant-Mitarbeiter: standardmäßig angemeldet bleiben. */
export const STAY_SIGNED_IN_DEFAULT = true;

/** Wie @supabase/ssr DEFAULT_COOKIE_OPTIONS.maxAge (400 Tage). */
export const STAY_SIGNED_IN_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60;

export type AuthCookieWriteOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  priority?: "low" | "medium" | "high";
  [key: string]: unknown;
};

export function parseStaySignedInValue(
  raw: string | null | undefined,
): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return null;
}

export function resolveStaySignedInPreference(
  raw: string | null | undefined,
): boolean {
  return parseStaySignedInValue(raw) ?? STAY_SIGNED_IN_DEFAULT;
}

/**
 * Session-Cookie (kein Max-Age/Expires), außer Löschen (maxAge === 0).
 * Persistent: Optionen unverändert (ssr liefert langen Max-Age).
 */
export function applyStaySignedInToAuthCookieOptions<
  T extends AuthCookieWriteOptions,
>(options: T | undefined, staySignedIn: boolean): T {
  const next = { ...(options ?? ({} as T)) } as T;
  if (staySignedIn) return next;

  const maxAge = next.maxAge;
  if (typeof maxAge === "number" && maxAge === 0) return next;

  delete next.maxAge;
  delete next.expires;
  return next;
}

export function mapAuthCookiesForStaySignedIn<
  T extends { name: string; value: string; options?: AuthCookieWriteOptions },
>(cookiesToSet: T[], staySignedIn: boolean): T[] {
  return cookiesToSet.map((entry) => ({
    ...entry,
    options: applyStaySignedInToAuthCookieOptions(entry.options, staySignedIn),
  }));
}

/** Browser: localStorage zuerst, sonst Preference-Cookie, sonst Default. */
export function readStaySignedInPreference(): boolean {
  if (typeof window === "undefined") return STAY_SIGNED_IN_DEFAULT;

  try {
    const fromLs = parseStaySignedInValue(
      localStorage.getItem(STAY_SIGNED_IN_STORAGE_KEY),
    );
    if (fromLs != null) return fromLs;
  } catch {
    /* private mode */
  }

  try {
    const match = document.cookie.match(
      new RegExp(
        `(?:^|;\\s*)${STAY_SIGNED_IN_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
      ),
    );
    const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
    return resolveStaySignedInPreference(raw);
  } catch {
    return STAY_SIGNED_IN_DEFAULT;
  }
}

/** Speichert UI-Wahl (LS) + Cookie für Server/Proxy bei Token-Refresh. */
export function writeStaySignedInPreference(staySignedIn: boolean): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STAY_SIGNED_IN_STORAGE_KEY,
      staySignedIn ? "1" : "0",
    );
  } catch {
    /* private mode */
  }

  const secure =
    typeof location !== "undefined" && location.protocol === "https:";
  const base = [
    `${STAY_SIGNED_IN_COOKIE}=${staySignedIn ? "1" : "0"}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (secure) base.push("Secure");

  // Altes persistentes Cookie entfernen, bevor Session-Cookie gesetzt wird.
  document.cookie = [
    `${STAY_SIGNED_IN_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");

  if (staySignedIn) {
    base.push(`Max-Age=${STAY_SIGNED_IN_COOKIE_MAX_AGE_SEC}`);
  }
  document.cookie = base.join("; ");
}
