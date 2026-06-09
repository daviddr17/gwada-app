import "server-only";

import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { isRestaurantWhatsappSessionWorking } from "@/lib/staff/staff-invite-send-server";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendFile } from "@/lib/whatsapp/waha-send-media";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildSalesDocumentMessage(params: {
  restaurantName: string;
  documentLabel: string;
  voucherNumber: string | null;
  totalGross: number;
  currency: string;
}): string {
  const number = params.voucherNumber ? ` (${params.voucherNumber})` : "";
  const amount = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: params.currency,
  }).format(params.totalGross);
  return [
    params.restaurantName,
    "",
    `${params.documentLabel}${number}`,
    `Betrag: ${amount}`,
    "",
    "Bei Rückfragen antworten Sie bitte auf diese Nachricht.",
  ].join("\n");
}

export type SalesDocumentAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export async function sendSalesDocumentNotification(params: {
  restaurantId: string;
  restaurantName: string;
  documentLabel: string;
  voucherNumber: string | null;
  totalGross: number;
  currency: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  sendWhatsapp: boolean;
  sendEmail: boolean;
  sbForName: SupabaseClient;
  attachments?: SalesDocumentAttachment[];
}): Promise<{ channels: string[]; error: string | null }> {
  const text = buildSalesDocumentMessage(params);
  const channels: string[] = [];
  let lastError: string | null = null;
  const pdfAttachment = params.attachments?.find((a) =>
    a.contentType.includes("pdf"),
  );

  if (params.sendWhatsapp && params.recipientPhone?.trim()) {
    const sessionOk = await isRestaurantWhatsappSessionWorking(
      params.restaurantId,
    );
    if (!sessionOk) {
      lastError = "WhatsApp ist nicht verbunden.";
    } else {
      const chatId = guestPhoneToWhatsAppChatId(params.recipientPhone.trim());
      if (!chatId) {
        lastError = "Ungültige Telefonnummer.";
      } else if (pdfAttachment) {
        const wa = await wahaSendFile({
          restaurantId: params.restaurantId,
          chatId,
          caption: text,
          file: {
            fileName: pdfAttachment.filename,
            mimeType: pdfAttachment.contentType,
            base64: pdfAttachment.content.toString("base64"),
          },
        });
        if (wa.ok) channels.push("whatsapp");
        else lastError = wa.error;
      } else {
        const wa = await wahaSendText({
          restaurantId: params.restaurantId,
          chatId,
          text,
        });
        if (wa.ok) channels.push("whatsapp");
        else lastError = wa.error;
      }
    }
  }

  if (params.sendEmail && params.recipientEmail?.trim()) {
    const delivery = await resolveEmailDeliveryForRestaurant(
      params.restaurantId,
      params.sbForName,
    );
    if (!delivery) {
      lastError = lastError ?? "E-Mail ist nicht konfiguriert.";
    } else {
      const mail = await sendReservationEmail(delivery, {
        to: params.recipientEmail.trim(),
        subject: `${params.documentLabel} — ${params.restaurantName}`,
        text,
        headline: params.documentLabel,
        intro: text,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      if (mail.ok) channels.push("email");
      else lastError = mail.error ?? lastError;
    }
  }

  if (!channels.length) {
    return {
      channels,
      error: lastError ?? "Kein Versandkanal verfügbar.",
    };
  }
  return { channels, error: null };
}
