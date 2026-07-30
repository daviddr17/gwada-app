/**
 * Anbieterkennzeichnung für Gwada (Marketing-/Legal-Seiten).
 * Quelle: techlion.de Impressum — angepasst auf die SaaS-Plattform gwada.app.
 */

export const PLATFORM_OPERATOR = {
  /** Handels-/Markenname der Plattform */
  productName: "Gwada",
  productUrl: "https://gwada.app",
  /** Rechtlicher Anbieter */
  legalName: "techlion",
  ownerName: "David Dreyer",
  street: "Im Steinbachshofe 14",
  postalCode: "37297",
  city: "Berkatal",
  country: "Deutschland",
  /** Öffentliche Kontaktadresse der Plattform */
  contactEmail: "contact@gwada.app",
  /** Datenschutz-Anfragen */
  privacyEmail: "contact@gwada.app",
  /** Anbieter-Website */
  operatorWebsite: "https://techlion.de",
  /** Stand der Rechtstexte (Anzeige) */
  documentsUpdatedLabel: "30. Juli 2026",
  /**
   * USt-IdNr. — auf techlion.de noch „folgt“.
   * Sobald vorhanden hier eintragen (Pflichtangabe, wenn erteilt).
   */
  vatId: null as string | null,
} as const;

export function platformOperatorAddressLines(): string[] {
  return [
    PLATFORM_OPERATOR.legalName,
    `Inhaber: ${PLATFORM_OPERATOR.ownerName}`,
    PLATFORM_OPERATOR.street,
    `${PLATFORM_OPERATOR.postalCode} ${PLATFORM_OPERATOR.city}`,
    PLATFORM_OPERATOR.country,
  ];
}
