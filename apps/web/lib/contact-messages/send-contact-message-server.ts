import "server-only";

import { randomUUID } from "crypto";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { composeOutboundWithReservationContext } from "@/lib/contact-messages/compose-reservation-message-text";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { buildGuestManageUrl } from "@/lib/reservations/guest-manage-url";
import {
  fetchReservationForEmail,
  resolveEmailDeliveryForRestaurant,
} from "@/lib/reservations/reservation-email-dispatch";
import { fetchReservationForWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import {
  finalizeOutboundWhatsappMessage,
  insertPendingOutboundWhatsappMessage,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import { storeGwadaMessageAttachments } from "@/lib/contact-messages/gwada-message-attachments-server";
import {
  sendWhatsappAttachmentFiles,
  sendWhatsappVoiceNote,
  smtpPartsFromOutboundFiles,
} from "@/lib/contact-messages/send-channel-attachments";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { sendMetaMessageServer } from "@/lib/contact-messages/meta-send-message-server";
import {
  metaPseudoContactIdForSender,
  resolveMetaSenderIdForContact,
} from "@/lib/contact-messages/resolve-meta-sender-server";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SendContactMessageChannel =
  | "gwada"
  | "whatsapp"
  | "email"
  | "facebook"
  | "instagram";

export type SendContactMessageServerInput = {
  restaurantId: string;
  contactId: string;
  body: string;
  direction: "inbound" | "outbound";
  channels: SendContactMessageChannel[];
  reservationId?: string | null;
  sentBy?: string | null;
  /** Klarname Absender (Display-PIN ohne Profil). */
  sentByLabel?: string | null;
  restaurantName?: string | null;
  attachmentFiles?: OutboundAttachmentFile[];
  voiceFile?: OutboundAttachmentFile;
  clientSendId?: string;
  /** Kein separates Nachrichten-Push (z. B. Gast-Nachricht bei neuer Reservierung). */
  suppressNotifications?: boolean;
};

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

async function resolveWhatsappChatId(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    reservationId?: string | null;
  },
): Promise<string | null> {
  const fromPseudo = wahaChatIdFromPseudoContactId(params.contactId);
  if (fromPseudo) return fromPseudo;

  const phone = await resolveWhatsappPhoneForContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    reservationId: params.reservationId,
  });
  return phone ? guestPhoneToWhatsAppChatId(phone) : null;
}

async function resolveContactEmail(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<string | null> {
  const { data: emails } = await admin
    .from("contact_emails")
    .select("email, is_primary, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  const sorted = [...(emails ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      (a.sort_order as number) - (b.sort_order as number),
  );
  for (const row of sorted) {
    const email = (row as { email: string }).email?.trim();
    if (email && email.includes("@")) return email;
  }
  return null;
}

async function loadReservationMessageContext(
  admin: SupabaseClient,
  reservationId: string,
  restaurantName?: string | null,
): Promise<{
  ctx: ReservationMessageContext;
  guestPhone: string | null;
  guestEmail: string | null;
} | null> {
  const wa = await fetchReservationForWhatsapp(admin, reservationId);
  if (!wa) return null;
  const [{ data: settings }, { data: restaurant }] = await Promise.all([
    admin
      .from("restaurant_reservation_settings")
      .select("guest_manage_url_template")
      .eq("restaurant_id", wa.restaurant_id)
      .maybeSingle(),
    admin
      .from("restaurants")
      .select("timezone")
      .eq("id", wa.restaurant_id)
      .maybeSingle(),
  ]);

  const template =
    (settings as { guest_manage_url_template: string | null } | null)
      ?.guest_manage_url_template ?? null;
  const timeZoneRaw = (restaurant as { timezone?: string | null } | null)
    ?.timezone;
  const timeZone =
    typeof timeZoneRaw === "string" && timeZoneRaw.trim()
      ? timeZoneRaw.trim()
      : DEFAULT_RESTAURANT_TIMEZONE;

  const ctx: ReservationMessageContext = {
    guestFirstName: wa.guest_first_name,
    guestLastName: wa.guest_last_name,
    partySize: wa.party_size,
    startsAt: new Date(wa.starts_at),
    timeZone,
    reservationNumber: wa.reservation_number,
    guestPin: wa.guest_pin,
    restaurantName: restaurantName?.trim() || undefined,
    manageUrl: buildGuestManageUrl(
      template,
      wa.reservation_number,
      wa.guest_pin,
    ),
  };

  return {
    ctx,
    guestPhone: wa.guest_phone,
    guestEmail: (await fetchReservationForEmail(admin, reservationId))
      ?.guest_email ?? null,
  };
}

async function insertMessage(
  admin: SupabaseClient,
  row: {
    restaurant_id: string;
    contact_id: string;
    platform: ContactMessagePlatform;
    direction: "inbound" | "outbound";
    body: string;
    reservation_id: string | null;
    sent_by: string | null;
    sent_by_label?: string | null;
    delivery_status: string;
    send_batch_id?: string | null;
    external_source_id?: string | null;
    suppress_notifications?: boolean;
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await admin
    .from("contact_messages")
    .insert(row)
    .select("id")
    .single();
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null };
}

export async function sendContactMessageServer(
  admin: SupabaseClient,
  input: SendContactMessageServerInput,
): Promise<{
  ok: boolean;
  errors: string[];
  wahaMessageId?: string | null;
  messageId?: string;
}> {
  const body = input.body.trim();
  const attachmentFiles = input.attachmentFiles ?? [];
  const voiceFile = input.voiceFile;
  if (!body && attachmentFiles.length === 0 && !voiceFile) {
    return { ok: false, errors: ["empty_body"] };
  }

  const channels = [...new Set(input.channels)];
  if (channels.length === 0) {
    return { ok: false, errors: ["no_channels"] };
  }

  const sendBatchId = channels.length > 1 ? randomUUID() : null;
  const errors: string[] = [];
  let whatsappWahaMessageId: string | null = null;
  let whatsappMessageId: string | undefined;
  let reservationMeta: Awaited<
    ReturnType<typeof loadReservationMessageContext>
  > = null;

  if (input.reservationId && input.direction === "outbound") {
    reservationMeta = await loadReservationMessageContext(
      admin,
      input.reservationId,
      input.restaurantName,
    );
  }

  const externalText =
    reservationMeta && input.direction === "outbound"
      ? composeOutboundWithReservationContext(reservationMeta.ctx, body)
      : body;

  for (const channel of channels) {
    if (channel === "gwada") {
      const { id, error } = await insertMessage(admin, {
        restaurant_id: input.restaurantId,
        contact_id: input.contactId,
        platform: "gwada",
        direction: input.direction,
        body: body || " ",
        reservation_id: input.reservationId ?? null,
        sent_by: input.sentBy ?? null,
        sent_by_label: input.sentByLabel ?? null,
        delivery_status: "delivered",
        send_batch_id: sendBatchId,
        suppress_notifications: input.suppressNotifications === true,
      });
      if (error) errors.push(`gwada:${error}`);
      else if (id && attachmentFiles.length > 0) {
        const stored = await storeGwadaMessageAttachments(admin, {
          restaurantId: input.restaurantId,
          messageId: id,
          files: attachmentFiles,
        });
        if (stored.error) errors.push(`gwada_attachments:${stored.error}`);
      }
      continue;
    }

    if (channel === "whatsapp") {
      if (input.direction !== "outbound") {
        const { id, error } = await insertMessage(admin, {
          restaurant_id: input.restaurantId,
          contact_id: input.contactId,
          platform: "whatsapp",
          direction: input.direction,
          body: body || " ",
          reservation_id: input.reservationId ?? null,
          sent_by: input.sentBy ?? null,
          sent_by_label: input.sentByLabel ?? null,
          delivery_status: "delivered",
          send_batch_id: sendBatchId,
        });
        if (error) errors.push(`whatsapp_db:${error}`);
        continue;
      }

      const sessionOk = await isWhatsappSessionWorking(input.restaurantId);
      const chatId = await resolveWhatsappChatId(admin, {
        restaurantId: input.restaurantId,
        contactId: input.contactId,
        reservationId: input.reservationId,
      });

      const mirrorBody =
        externalText ||
        (voiceFile ? "Sprachnachricht" : attachmentFiles.length > 0 ? " " : " ");

      const pending = await insertPendingOutboundWhatsappMessage(admin, {
        restaurantId: input.restaurantId,
        threadContactId: input.contactId,
        body: mirrorBody,
        sentBy: input.sentBy ?? null,
        sentByLabel: input.sentByLabel ?? null,
        clientSendId: input.clientSendId,
        sendBatchId,
        deliveryStatus:
          !sessionOk ? "failed" : !chatId ? "failed" : "pending",
      });

      if (!pending.ok) {
        errors.push(`whatsapp_db:${pending.error}`);
        continue;
      }

      whatsappMessageId = pending.messageId;

      if (!sessionOk) {
        errors.push("whatsapp:session_not_working");
        continue;
      }
      if (!chatId) {
        errors.push("whatsapp:no_phone");
        continue;
      }

      if (attachmentFiles.length > 0) {
        const stored = await storeGwadaMessageAttachments(admin, {
          restaurantId: input.restaurantId,
          messageId: pending.messageId,
          files: attachmentFiles,
        });
        if (stored.error) {
          await finalizeOutboundWhatsappMessage(admin, {
            restaurantId: input.restaurantId,
            messageId: pending.messageId,
            deliveryStatus: "failed",
          });
          errors.push(`whatsapp_attachments:${stored.error}`);
          continue;
        }
      }

      let wahaMessageId: string | null = null;
      let deliveryStatus: "sent" | "failed" = "sent";

      if (voiceFile) {
        const sent = await sendWhatsappVoiceNote({
          restaurantId: input.restaurantId,
          chatId,
          file: voiceFile,
        });
        if (!sent.ok) {
          deliveryStatus = "failed";
          errors.push(`whatsapp:${sent.error}`);
        }
      } else if (attachmentFiles.length > 0) {
        const sent = await sendWhatsappAttachmentFiles({
          restaurantId: input.restaurantId,
          chatId,
          files: attachmentFiles,
          caption: externalText || undefined,
        });
        if (!sent.ok) {
          deliveryStatus = "failed";
          errors.push(...sent.errors);
        }
      } else {
        const sent = await wahaSendText({
          restaurantId: input.restaurantId,
          chatId,
          text: externalText,
        });
        if (!sent.ok) {
          deliveryStatus = "failed";
          errors.push(`whatsapp:${sent.error}`);
        } else {
          wahaMessageId = sent.wahaMessageId ?? null;
        }
      }

      if (wahaMessageId) {
        whatsappWahaMessageId = wahaMessageId;
      }

      await finalizeOutboundWhatsappMessage(admin, {
        restaurantId: input.restaurantId,
        messageId: pending.messageId,
        deliveryStatus,
        wahaMessageId,
      });
      continue;
    }

    if (channel === "email") {
      let deliveryStatus = "pending";

      if (input.direction === "outbound") {
        let to: string | null = null;
        if (input.reservationId) {
          const emailRow = await fetchReservationForEmail(
            admin,
            input.reservationId,
          );
          to = emailRow?.guest_email?.trim() ?? null;
        }
        if (!to) {
          to = await resolveContactEmail(
            admin,
            input.restaurantId,
            input.contactId,
          );
        }

        if (to && to.includes("@")) {
          const delivery = await resolveEmailDeliveryForRestaurant(
            input.restaurantId,
            admin,
          );
          if (delivery) {
            const restaurantLabel =
              input.restaurantName?.trim() || "Ihrem Restaurant";
            const subject = reservationMeta
              ? `Nachricht zu Reservierung #${reservationMeta.ctx.reservationNumber}`
              : `Nachricht von ${restaurantLabel}`;
            const result = await sendReservationEmail(delivery, {
              to,
              subject,
              text: externalText || " ",
              attachments:
                attachmentFiles.length > 0
                  ? smtpPartsFromOutboundFiles(attachmentFiles)
                  : undefined,
            });
            if (result.ok) {
              deliveryStatus = "sent";
            } else {
              deliveryStatus = "failed";
              errors.push(`email:${result.error}`);
            }
          } else {
            deliveryStatus = "failed";
            errors.push("email:smtp_not_configured");
          }
        } else {
          deliveryStatus = "failed";
          errors.push("email:no_email");
        }
      } else {
        deliveryStatus = "delivered";
      }

      const { id, error } = await insertMessage(admin, {
        restaurant_id: input.restaurantId,
        contact_id: input.contactId,
        platform: "email",
        direction: input.direction,
        body: body || " ",
        reservation_id: input.reservationId ?? null,
        sent_by: input.sentBy ?? null,
        sent_by_label: input.sentByLabel ?? null,
        delivery_status: deliveryStatus,
        send_batch_id: sendBatchId,
      });
      if (error) errors.push(`email_db:${error}`);
      else if (id && attachmentFiles.length > 0 && input.direction === "outbound") {
        const stored = await storeGwadaMessageAttachments(admin, {
          restaurantId: input.restaurantId,
          messageId: id,
          files: attachmentFiles,
        });
        if (stored.error) errors.push(`email_attachments:${stored.error}`);
      }
      continue;
    }

    if (channel === "facebook" || channel === "instagram") {
      let deliveryStatus = "pending";

      if (input.direction === "outbound") {
        const senderId = await resolveMetaSenderIdForContact(admin, {
          restaurantId: input.restaurantId,
          contactId: input.contactId,
          platform: channel,
        });

        if (!senderId) {
          deliveryStatus = "failed";
          errors.push(`${channel}:no_messaging_id`);
        } else {
          const sent = await sendMetaMessageServer(admin, {
            restaurantId: input.restaurantId,
            metaContactId: metaPseudoContactIdForSender(channel, senderId),
            body: externalText,
            attachmentFiles:
              input.direction === "outbound" ? attachmentFiles : undefined,
            voiceFile:
              input.direction === "outbound" ? voiceFile : undefined,
          });
          if (sent.ok) {
            deliveryStatus = "sent";
          } else {
            deliveryStatus = "failed";
            errors.push(...sent.errors);
          }
        }
      } else {
        deliveryStatus = "delivered";
      }

      const voiceOnlyOutbound =
        input.direction === "outbound" &&
        voiceFile &&
        !body &&
        attachmentFiles.length === 0;
      const skipDbMirror = voiceOnlyOutbound && deliveryStatus === "sent";

      if (!skipDbMirror) {
        const { error } = await insertMessage(admin, {
          restaurant_id: input.restaurantId,
          contact_id: input.contactId,
          platform: channel,
          direction: input.direction,
          body: body || " ",
          reservation_id: input.reservationId ?? null,
          sent_by: input.sentBy ?? null,
          sent_by_label: input.sentByLabel ?? null,
          delivery_status: deliveryStatus,
          send_batch_id: sendBatchId,
        });
        if (error) errors.push(`${channel}_db:${error}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    wahaMessageId: whatsappWahaMessageId,
    messageId: whatsappMessageId,
  };
}
