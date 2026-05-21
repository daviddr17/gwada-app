import {
  findCountryByIso2,
  type CountryReference,
} from "@/lib/constants/countries";

function dialDigits(dialCode: string): string {
  return dialCode.replace(/\D/g, "");
}

export function formatGuestPhone(
  iso2: string,
  localNumber: string,
  countries: CountryReference[],
): string | null {
  const local = localNumber.trim().replace(/\s+/g, " ");
  if (!local) return null;
  const country = findCountryByIso2(iso2, countries);
  if (!country) return local;
  const normalizedLocal = local.replace(/^0+/, "");
  return `${country.dial_code} ${normalizedLocal}`.trim();
}

export function parseGuestPhone(
  stored: string | null | undefined,
  countries: CountryReference[],
  defaultIso2: string,
): { iso2: string; local: string } {
  const raw = (stored ?? "").trim();
  if (!raw) {
    return { iso2: defaultIso2, local: "" };
  }

  const sorted = [...countries].sort(
    (a, b) => dialDigits(b.dial_code).length - dialDigits(a.dial_code).length,
  );

  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    for (const c of sorted) {
      const prefix = dialDigits(c.dial_code);
      if (digits.startsWith(prefix)) {
        const rest = digits.slice(prefix.length);
        return {
          iso2: c.iso2,
          local: rest.replace(/^0+/, ""),
        };
      }
    }
    return { iso2: defaultIso2, local: raw.replace(/^\+/, "").trim() };
  }

  if (/^00[1-9]/.test(raw)) {
    return parseGuestPhone(`+${raw.slice(2)}`, countries, defaultIso2);
  }

  return { iso2: defaultIso2, local: raw };
}
