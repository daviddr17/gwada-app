/** Platzhalter in `guest_manage_url_template` (Reservierungs-Einstellungen). */
export const GUEST_MANAGE_URL_PLACEHOLDERS = ["{nummer}", "{pin}"] as const;

export function buildGuestManageUrl(
  template: string | null | undefined,
  reservationNumber: number,
  guestPin: string,
): string | null {
  const raw = template?.trim();
  if (!raw) return null;
  return raw
    .replaceAll("{nummer}", String(reservationNumber))
    .replaceAll("{pin}", guestPin)
    .replaceAll("{NUMMER}", String(reservationNumber))
    .replaceAll("{PIN}", guestPin);
}

export function validateGuestManageUrlTemplate(
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000) {
    return "Link-Vorlage ist zu lang (max. 2000 Zeichen).";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return "Link muss mit http:// oder https:// beginnen.";
  }
  return null;
}
