/** Mollie amount.value is a string with exactly two decimals, e.g. "10.00". */

export function formatMollieAmountValue(euros: number): string {
  if (!Number.isFinite(euros) || euros < 0) {
    throw new Error("invalid_mollie_amount");
  }
  return euros.toFixed(2);
}

export function parseMollieAmountValue(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export type MollieAmount = {
  currency: string;
  value: string;
};

export function mollieAmountEur(euros: number): MollieAmount {
  return { currency: "EUR", value: formatMollieAmountValue(euros) };
}
