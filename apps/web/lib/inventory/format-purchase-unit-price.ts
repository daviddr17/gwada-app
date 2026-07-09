/** Einkaufspreis (EK) pro Lagereinheit — Anzeige mit zwei Nachkommastellen. */

export function roundPurchaseUnitPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatPurchaseUnitPriceDisplay(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "";
  return roundPurchaseUnitPrice(value).toFixed(2).replace(".", ",");
}

export function parsePurchaseUnitPriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return roundPurchaseUnitPrice(n);
}
