/**
 * Guest reservation terms (GDPR / BGB-oriented template).
 * Copy lives under messages Embed.reservation.termsSheet for each locale.
 * Have the restaurant (and counsel if needed) review before go-live.
 */

export type ReservationBookingTermsSection = {
  title: string;
  paragraphs: readonly string[];
};

export function reservationBookingTermsSections(
  t: (key: string, values?: Record<string, string | number>) => string,
  restaurantName: string,
): ReservationBookingTermsSection[] {
  const name = restaurantName.trim() || t("nameFallback");

  return [
    {
      title: t("scope.title"),
      paragraphs: [t("scope.p1", { name }), t("scope.p2")],
    },
    {
      title: t("contract.title"),
      paragraphs: [t("contract.p1"), t("contract.p2")],
    },
    {
      title: t("guestDuties.title"),
      paragraphs: [t("guestDuties.p1"), t("guestDuties.p2")],
    },
    {
      title: t("privacy.title"),
      paragraphs: [
        t("privacy.p1", { name }),
        t("privacy.p2"),
        t("privacy.p3"),
        t("privacy.p4"),
        t("privacy.p5"),
        t("privacy.p6"),
        t("privacy.p7"),
        t("privacy.p8"),
      ],
    },
    {
      title: t("notifications.title"),
      paragraphs: [t("notifications.p1"), t("notifications.p2")],
    },
    {
      title: t("cancellation.title"),
      paragraphs: [t("cancellation.p1"), t("cancellation.p2")],
    },
    {
      title: t("liability.title"),
      paragraphs: [t("liability.p1"), t("liability.p2")],
    },
    {
      title: t("final.title"),
      paragraphs: [t("final.p1"), t("final.p2"), t("final.p3")],
    },
  ];
}
