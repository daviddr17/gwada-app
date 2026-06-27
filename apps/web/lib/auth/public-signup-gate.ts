/** Vor Live-Start: keine neuen Konten per OAuth/Passwort-Registrierung. */
export const GWADA_PUBLIC_SIGNUP_ENABLED = false;

export function parseOAuthIdTokenEmail(idToken: string): string | null {
  try {
    const segment = idToken.split(".")[1];
    if (!segment) return null;
    const json = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    ) as { email?: unknown };
    return typeof json.email === "string"
      ? json.email.trim().toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export const GWADA_WAITLIST_SIGNUP_MESSAGE =
  "Gwada ist noch nicht öffentlich verfügbar. Trage dich auf der Anmeldeseite auf die Warteliste ein.";
