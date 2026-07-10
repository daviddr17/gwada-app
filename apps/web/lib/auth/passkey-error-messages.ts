/** Nutzerfreundliche Passkey-Fehlertexte. */

function isPasskeyUserCancelled(raw: string): boolean {
  return (
    /not allowed|notallowed|abort|cancel|user cancelled|user canceled/i.test(
      raw,
    ) || raw === "WebAuthn ceremony failed"
  );
}

export function isPasskeyUserCancelledError(
  error: { message?: string; name?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const msg = `${error.name ?? ""} ${error.message ?? ""}`.trim();
  return isPasskeyUserCancelled(msg);
}

export function humanizePasskeyErrorMessage(
  raw: string | undefined | null,
): string {
  const t = raw?.trim() ?? "";
  if (!t || isPasskeyUserCancelled(t)) return "";
  if (/Browser does not support WebAuthn/i.test(t)) {
    return "Dieser Browser unterstützt keine Passkeys.";
  }
  if (
    /expected pattern/i.test(t) ||
    /Unexpected token/i.test(t) ||
    /invalid base64/i.test(t)
  ) {
    return "Passkey-Server antwortet nicht korrekt (Auth zu alt oder nicht konfiguriert). Bitte kurz warten und erneut versuchen.";
  }
  if (/passkey_disabled|webauthn.*disabled/i.test(t)) {
    return "Passkey-Anmeldung ist auf dem Auth-Server noch nicht aktiviert.";
  }
  if (/webauthn_credential_not_found/i.test(t)) {
    return "Kein Passkey für dieses Gerät hinterlegt. Bitte zuerst normal anmelden und unter Profil → Anmeldung einen Passkey anlegen.";
  }
  if (/webauthn_credential_exists/i.test(t)) {
    return "Dieser Passkey ist bereits mit deinem Konto verknüpft.";
  }
  if (/too_many_passkeys/i.test(t)) {
    return "Maximale Anzahl an Passkeys erreicht. Bitte einen alten Passkey unter Profil → Anmeldung entfernen.";
  }
  if (/webauthn_challenge_expired/i.test(t)) {
    return "Passkey-Anfrage abgelaufen. Bitte erneut versuchen.";
  }
  if (/email_not_confirmed|phone_not_confirmed/i.test(t)) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse, bevor du dich mit Passkey anmeldest.";
  }
  if (/user_banned/i.test(t)) {
    return "Dieses Konto ist gesperrt.";
  }
  return t || "Passkey-Anmeldung fehlgeschlagen.";
}
