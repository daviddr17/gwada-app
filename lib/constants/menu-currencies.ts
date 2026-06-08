/** Bekannte ISO-4217-Währungen für die Speisekarte (Label auf Deutsch). */
export const MENU_CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US-Dollar" },
  { value: "GBP", label: "GBP — Britisches Pfund" },
  { value: "CHF", label: "CHF — Schweizer Franken" },
  { value: "JPY", label: "JPY — Japanischer Yen" },
  { value: "CAD", label: "CAD — Kanadischer Dollar" },
  { value: "AUD", label: "AUD — Australischer Dollar" },
  { value: "NZD", label: "NZD — Neuseeland-Dollar" },
  { value: "SEK", label: "SEK — Schwedische Krone" },
  { value: "NOK", label: "NOK — Norwegische Krone" },
  { value: "DKK", label: "DKK — Dänische Krone" },
  { value: "PLN", label: "PLN — Polnischer Złoty" },
  { value: "CZK", label: "CZK — Tschechische Krone" },
  { value: "HUF", label: "HUF — Ungarischer Forint" },
  { value: "RON", label: "RON — Rumänischer Leu" },
  { value: "BGN", label: "BGN — Bulgarischer Lew" },
  { value: "HRK", label: "HRK — Kroatische Kuna" },
  { value: "TRY", label: "TRY — Türkische Lira" },
  { value: "RUB", label: "RUB — Russischer Rubel" },
  { value: "CNY", label: "CNY — Chinesischer Yuan" },
  { value: "HKD", label: "HKD — Hongkong-Dollar" },
  { value: "SGD", label: "SGD — Singapur-Dollar" },
  { value: "INR", label: "INR — Indische Rupie" },
  { value: "BRL", label: "BRL — Brasilianischer Real" },
  { value: "MXN", label: "MXN — Mexikanischer Peso" },
  { value: "ZAR", label: "ZAR — Südafrikanischer Rand" },
  { value: "AED", label: "AED — VAE-Dirham" },
  { value: "SAR", label: "SAR — Saudi-Riyal" },
  { value: "KRW", label: "KRW — Südkoreanischer Won" },
  { value: "THB", label: "THB — Thailändischer Baht" },
  { value: "VND", label: "VND — Vietnamesischer Dong" },
  { value: "PHP", label: "PHP — Philippinischer Peso" },
  { value: "IDR", label: "IDR — Indonesische Rupiah" },
  { value: "MYR", label: "MYR — Malaysischer Ringgit" },
  { value: "ILS", label: "ILS — Israelischer Schekel" },
  { value: "EGP", label: "EGP — Ägyptisches Pfund" },
  { value: "MAD", label: "MAD — Marokkanischer Dirham" },
  { value: "XPF", label: "XPF — CFP-Franc (Pazifik)" },
  { value: "XCD", label: "XCD — Ostkaribischer Dollar" },
  { value: "ARS", label: "ARS — Argentinischer Peso" },
  { value: "CLP", label: "CLP — Chilenischer Peso" },
  { value: "COP", label: "COP — Kolumbianischer Peso" },
  { value: "PEN", label: "PEN — Peruanischer Sol" },
  { value: "UYU", label: "UYU — Uruguayischer Peso" },
  { value: "ISK", label: "ISK — Isländische Krone" },
] as const;

export type MenuCurrencyCode = (typeof MENU_CURRENCY_OPTIONS)[number]["value"];

export const DEFAULT_MENU_CURRENCY_CODE: MenuCurrencyCode = "EUR";

const MENU_CURRENCY_SET = new Set<string>(
  MENU_CURRENCY_OPTIONS.map((o) => o.value),
);

export function isMenuCurrencyCode(code: string): code is MenuCurrencyCode {
  return MENU_CURRENCY_SET.has(code);
}

export function normalizeMenuCurrencyCode(code: string | null | undefined): MenuCurrencyCode {
  const upper = (code ?? "").trim().toUpperCase();
  return isMenuCurrencyCode(upper) ? upper : DEFAULT_MENU_CURRENCY_CODE;
}

export function menuCurrencyLabel(code: string): string {
  const normalized = normalizeMenuCurrencyCode(code);
  return (
    MENU_CURRENCY_OPTIONS.find((o) => o.value === normalized)?.label ?? normalized
  );
}
