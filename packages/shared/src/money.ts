/** ISO 4217 — Gwada POS default. */
export const DEFAULT_CURRENCY = "EUR" as const;

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: DEFAULT_CURRENCY,
});

/** Display integer cents as localized EUR string (e.g. 1299 → „12,99 €“). */
export function formatCentsEUR(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/** Parse decimal string (e.g. `"12.99"`) to integer cents. */
export function parseEuroToCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  const negative = normalized.startsWith("-");
  const abs = negative ? normalized.slice(1) : normalized;
  const [whole, frac = ""] = abs.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

/** Serialize integer cents to fixed two-decimal string for APIs/DB. */
export function formatCentsAsDecimal(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function addCents(a: number, b: number): number {
  return a + b;
}
