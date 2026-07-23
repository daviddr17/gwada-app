/** Client-seitige Erkennung abgelaufener Display-PIN-Sessions (Tablet). */

export const DISPLAY_SESSION_EXPIRED_EVENT = "gwada:display-session-expired";

export function isDisplaySessionAuthError(
  error: string | undefined | null,
): boolean {
  return (
    error === "session_expired" ||
    error === "session_locked" ||
    error === "session_invalid"
  );
}

export function displaySessionAuthErrorMessage(
  error: string | undefined | null,
): string {
  if (error === "session_locked") return "Bitte mit PIN anmelden.";
  return "Anmeldung abgelaufen — bitte erneut PIN eingeben.";
}

/** UI zurück auf PIN; DisplayScreen hört darauf. */
export function notifyDisplaySessionExpired(
  error?: string | null,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DISPLAY_SESSION_EXPIRED_EVENT, {
      detail: { error: error ?? "session_expired" },
    }),
  );
}

export async function readDisplayJsonError(
  res: Response,
): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { error?: string };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/** Bei 401/403 Session-Fehler: Event feuern und true zurückgeben. */
export async function handleDisplaySessionAuthFailure(
  res: Response,
): Promise<boolean> {
  if (res.status !== 401 && res.status !== 403) return false;
  const error = await readDisplayJsonError(res);
  if (!isDisplaySessionAuthError(error)) return false;
  notifyDisplaySessionExpired(error);
  return true;
}
