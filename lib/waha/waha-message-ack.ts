/** WhatsApp / WAHA ACK-Stufen (siehe WAHA `ack` auf Chat-Nachrichten). */
export type WahaMessageAckLevel =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "played";

export function wahaAckLevel(ack: number | null | undefined): WahaMessageAckLevel {
  if (ack == null || !Number.isFinite(ack)) return "sent";
  if (ack >= 4) return "played";
  if (ack >= 3) return "read";
  if (ack >= 2) return "delivered";
  if (ack >= 1) return "sent";
  return "pending";
}

export function wahaAckToDeliveryStatus(
  ack: number | null | undefined,
  fromMe: boolean,
): string {
  if (!fromMe) return "delivered";
  return wahaAckLevel(ack);
}

export const WAHA_ACK_LABELS: Record<WahaMessageAckLevel, string> = {
  pending: "Wird gesendet",
  sent: "Gesendet",
  delivered: "Zugestellt",
  read: "Gelesen",
  played: "Abgespielt",
};
