import "server-only";

import { sendViaSmtp, type SmtpSendPayload } from "@/lib/email/send-via-smtp";
import { reservationEmailTextToHtml } from "@/lib/n8n/n8n-send-reservation-email";
import type { N8nEmailSender, N8nEmailSmtp } from "@/lib/n8n/n8n-send-reservation-email";

export type ReservationEmailDelivery = {
  sender: N8nEmailSender;
  smtp: N8nEmailSmtp;
};

export async function sendReservationEmail(
  delivery: ReservationEmailDelivery,
  payload: Omit<SmtpSendPayload, "html" | "fromName"> & { text: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return sendViaSmtp(delivery.smtp, {
    ...payload,
    fromName: delivery.sender.name,
    html: reservationEmailTextToHtml(payload.text),
  });
}
