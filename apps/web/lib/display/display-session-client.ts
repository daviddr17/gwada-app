/** Client-seitige Erkennung abgelaufener Display-PIN-Sessions (Tablet). */

export const DISPLAY_SESSION_EXPIRED_EVENT = "gwada:display-session-expired";

/** Nach so langer Tab-/PWA-Hintergrundzeit: Hard-Reload (frischer PIN-Stand). */
export const DISPLAY_RESUME_RELOAD_HIDDEN_MS = 5 * 60 * 1000;

/** Max. Alter der Display-Seite — danach Reload sobald idle. */
export const DISPLAY_PAGE_RELOAD_MAX_AGE_MS = 2 * 60 * 60 * 1000;

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

/** Kompletter Neustart — verhindert stale React/Cookie-Zustände auf Tablets. */
export function reloadDisplayPage(): void {
  if (typeof window === "undefined") return;
  window.location.reload();
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
