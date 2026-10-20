import type { PosFulfillmentType, PosOrderStatus } from "@gwada/pos-domain";

/** German guest-facing status labels (Lieferando-ähnlich). */
export function guestOrderStatusLabelDe(
  status: PosOrderStatus | string,
  fulfillment: PosFulfillmentType | string,
): string {
  const delivery = fulfillment === "delivery";
  switch (status) {
    case "pending_payment":
      return "Zahlung ausstehend";
    case "received":
      return "Angenommen";
    case "preparing":
      return "In Zubereitung";
    case "ready":
      return delivery ? "Fertig zur Lieferung" : "Abholbereit";
    case "out_for_delivery":
      return "In Lieferung";
    case "delivered":
      if (delivery) return "Geliefert";
      if (fulfillment === "pickup") return "Abgeholt";
      return "Fertig";
    case "cancelled":
      return "Storniert";
    default:
      return String(status);
  }
}

export function posOrderChannelLabelDe(channel: string): string {
  switch (channel) {
    case "online":
      return "Online";
    case "kiosk":
      return "Kiosk";
    case "table":
      return "Tisch";
    case "pos":
      return "Kasse";
    default:
      return channel;
  }
}

export function posFulfillmentLabelDe(fulfillment: string): string {
  switch (fulfillment) {
    case "pickup":
      return "Abholung";
    case "delivery":
      return "Lieferung";
    case "dine_in":
      return "Vor Ort";
    default:
      return fulfillment;
  }
}

export const GUEST_STATUS_STEPS_PICKUP = [
  "received",
  "preparing",
  "ready",
  "delivered",
] as const;

export const GUEST_STATUS_STEPS_DELIVERY = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
] as const;
