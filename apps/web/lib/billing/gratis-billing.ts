/**
 * Legacy / Complimentary: Pro-Features ohne Zahlung (Grandfathering / Kulanz).
 * Katalogpreis (z. B. Pro 99€) darf hier nicht als MRR oder Rechnungsbetrag gelten.
 */
export function isGratisBillingSource(
  source: string | null | undefined,
  status?: string | null | undefined,
): boolean {
  return (
    source === "legacy" ||
    source === "complimentary" ||
    status === "legacy"
  );
}
