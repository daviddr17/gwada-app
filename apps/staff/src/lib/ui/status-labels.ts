export function orderStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Offen";
    case "in_progress":
      return "In Bearbeitung";
    case "ready":
      return "Bereit";
    case "served":
      return "Serviert";
    case "cancelled":
      return "Storniert";
    case "closed":
      return "Abgeschlossen";
    default:
      return status;
  }
}

export function paymentStateLabel(state: string): string {
  switch (state) {
    case "unpaid":
      return "Unbezahlt";
    case "partial":
      return "Teilweise bezahlt";
    case "paid":
      return "Bezahlt";
    case "refunded":
      return "Erstattet";
    default:
      return state;
  }
}
