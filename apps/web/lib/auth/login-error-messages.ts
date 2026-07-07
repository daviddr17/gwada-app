/** Nutzerfreundliche Login-Fehlertexte — keine technischen Details. */

export function isLikelyNetworkAuthFailure(message: string): boolean {
  return /load failed|failed to fetch|networkerror|network request failed|fetch|keine antwort nach/i.test(
    message,
  );
}

function isTechnicalLoginDetail(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t === "{}" || t === "[object Object]") return true;
  return (
    /Restaurant-|Workspace-|App-State|Supabase-Session|Erreichbarkeit|keine Antwort nach|\d+\s*s\b|Zeitüberschreitung|\bnpm\b|`npm|db:start|NEXT_PUBLIC|127\.0\.0\.1|localhost:\d+/i.test(
      t,
    ) ||
    /^Anmeldung \(Passwort\):/i.test(t) ||
    /Missing NEXT_PUBLIC_SUPABASE/i.test(t)
  );
}

export function humanizeLoginErrorMessage(raw: string | undefined | null): string {
  const t = raw?.trim() ?? "";
  if (!t || t === "{}" || t === "[object Object]") {
    return "Anmeldung fehlgeschlagen. Bitte später erneut versuchen.";
  }
  if (/invalid login credentials|invalid_credentials/i.test(t)) {
    return "E-Mail oder Passwort ist falsch.";
  }
  if (
    /Anmelde-Sitzung abgelaufen|Ungültige Anmelde-Sitzung/i.test(t)
  ) {
    return "Die Anmeldung mit Google ist abgelaufen. Bitte erneut versuchen.";
  }
  if (isLikelyNetworkAuthFailure(t)) {
    return "Keine Verbindung zum Anmeldedienst. Bitte Netzwerk prüfen und es später erneut versuchen.";
  }
  if (
    /supabase_upstream|upstream_unreachable|502|503|bad gateway|service unavailable/i.test(
      t,
    )
  ) {
    return "Der Anmeldedienst ist gerade nicht erreichbar. Bitte in wenigen Minuten erneut versuchen.";
  }
  if (/Supabase ist nicht konfiguriert/i.test(t)) {
    return "Anmeldung ist derzeit nicht verfügbar. Bitte später erneut versuchen.";
  }
  return t;
}

/** Eine Zeile für Banner + Toast-Titel (ohne technische Zusatzinfos). */
export function loginErrorBannerText(
  headline: string,
  detail?: string,
): string {
  const h = humanizeLoginErrorMessage(headline);
  const d = detail?.trim();
  if (d && !isTechnicalLoginDetail(d)) {
    const friendlyDetail = humanizeLoginErrorMessage(d);
    if (friendlyDetail !== h) {
      return `${h} ${friendlyDetail}`;
    }
  }
  return h;
}

export const LOGIN_REAUTH_MESSAGE =
  "Bitte melde dich erneut an, um fortzufahren.";
