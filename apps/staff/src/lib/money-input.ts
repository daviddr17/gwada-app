/** Euro-String (Komma/Punkt) → Cent; null bei ungültigem/leerem Wert. */
export function parseEuroToCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Cent → editierbarer Euro-String (z. B. für Anfangsbestand-Vorschlag). */
export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
