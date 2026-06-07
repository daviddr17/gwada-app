/** Standardtext für manuelle Bewertungseinladungen (WhatsApp / E-Mail). */

export function buildManualReviewInvitationMessage(params: {
  restaurantName: string;
  reviewUrl: string;
}): string {
  const name = params.restaurantName.trim() || "uns";
  return [
    `Hallo!`,
    ``,
    `wir würden uns sehr über eine positive Bewertung für ${name} freuen:`,
    params.reviewUrl,
    ``,
    `Der Link ist 24 Stunden gültig.`,
    ``,
    `Vielen Dank!`,
  ].join("\n");
}
