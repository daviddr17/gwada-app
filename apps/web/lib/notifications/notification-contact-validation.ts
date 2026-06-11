const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeNotificationEmail(
  email: string | null | undefined,
): string | null {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function validateNotificationEmail(
  email: string | null | undefined,
): string | null {
  const normalized = normalizeNotificationEmail(email);
  if (!normalized) return null;
  if (!EMAIL_PATTERN.test(normalized)) {
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  }
  return null;
}

function phoneDigits(phone: string): string {
  let work = phone.trim();
  if (work.startsWith("00")) {
    work = `+${work.slice(2)}`;
  }

  if (work.startsWith("+")) {
    return work.slice(1).replace(/\D/g, "");
  }

  return work.replace(/\D/g, "").replace(/^0+/, "");
}

/** Speicherformat: + und Ziffern (E.164-artig). */
export function normalizeNotificationPhoneForStorage(
  phone: string | null | undefined,
): string | null {
  const digits = phoneDigits(phone ?? "");
  if (!digits) return null;
  return `+${digits}`;
}

export function validateNotificationPhone(
  phone: string | null | undefined,
): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;

  const digits = phoneDigits(raw);
  if (digits.length < 8) {
    return "Bitte eine gültige Telefonnummer eingeben (mind. 8 Ziffern).";
  }

  const hasInternationalPrefix =
    raw.startsWith("+") || raw.startsWith("00") || digits.length > 11;

  if (!hasInternationalPrefix) {
    // DE-Heuristik: lokale Nummer ohne Ländervorwahl (z. B. 0151…, 030…)
    if (digits.length < 10 || digits.length > 11) {
      return "Bitte Ländervorwahl angeben (z. B. +49 …) oder eine gültige deutsche Nummer.";
    }
  }

  return null;
}
