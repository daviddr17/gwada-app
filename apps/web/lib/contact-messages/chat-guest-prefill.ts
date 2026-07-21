/**
 * Gastfelder aus Chat-Kontext für Reservierung / Bewertungseinladung.
 * Keine Spekulation: nur Anzeigename, bekannte Telefon-/E-Mail-Quellen.
 */

export function guestNamePartsFromChatDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const t = name.trim();
  if (!t) return { firstName: "", lastName: "" };
  // reine Nummer / Chat-ID → kein Name
  if (t.startsWith("+") || /^\d[\d\s().-]{5,}$/.test(t)) {
    return { firstName: "", lastName: "" };
  }
  if (/^whatsapp$/i.test(t) || /^e-?mail$/i.test(t) || /^facebook$/i.test(t) || /^instagram$/i.test(t)) {
    return { firstName: "", lastName: "" };
  }
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0]!.slice(0, 80), lastName: "" };
  return {
    firstName: parts[0]!.slice(0, 80),
    lastName: parts.slice(1).join(" ").slice(0, 80),
  };
}

export type ChatGuestPrefill = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export function buildChatGuestPrefill(params: {
  displayName: string;
  phone?: string | null;
  email?: string | null;
}): ChatGuestPrefill {
  const { firstName, lastName } = guestNamePartsFromChatDisplayName(
    params.displayName,
  );
  const phone = params.phone?.trim() || null;
  const email = params.email?.trim().includes("@")
    ? params.email.trim()
    : null;
  return { firstName, lastName, phone, email };
}
