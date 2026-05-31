/** Client-seitige Normalisierung — spiegelt DB `normalize_contact_*` für Vorschau/Matching. */

export function normalizeContactEmail(
  email: string | null | undefined,
): string | null {
  const t = (email ?? "").trim();
  if (!t) return null;
  return t.toLowerCase();
}

export function normalizeContactPhone(
  phone: string | null | undefined,
): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;

  let work = raw;
  if (work.startsWith("00")) {
    work = `+${work.slice(2)}`;
  }

  let digits: string;
  if (work.startsWith("+")) {
    digits = work.slice(1).replace(/\D/g, "");
  } else {
    digits = work.replace(/\D/g, "").replace(/^0+/, "");
  }

  return digits.length > 0 ? digits : null;
}
