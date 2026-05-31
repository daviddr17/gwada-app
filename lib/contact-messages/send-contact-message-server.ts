import "server-only";

import { randomUUID } from "crypto";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { composeOutboundWithReservationContext } from "@/lib/contact-messages/compose-reservation-message-text";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { buildGuestManageUrl } from "@/lib/reservations/guest-manage-url";
import {
  fetchReservationForEmail,
  resolveEmailDeliveryForRestaurant,
} from "@/lib/reservations/reservation-email-dispatch";
import { fetchReservationForWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SendContactMessageChannel = "gwada" | "whatsapp" | "email";

export type SendContactMessageServerInput = {
  restaurantId: string;
  contactId: string;
  body: string;
  direction: "inbound" | "outbound";
  channels: SendContactMessageChannel[];
  reservationId?: string | null;
  sentBy?: string | null;
  restaurantName?: string | null;
};

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
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
  const { data: settings } = await admin
    .from("restaurant_reservation_settings")
    .select("guest_manage_url_template")
    .eq("restaurant_id", wa.restaurant_id)
    .maybeSingle();

  const template =
    (settings as { guest_manage_url_template: string | null } | null)
      ?.guest_manage_url_template ?? null;

  const ctx: ReservationMessageContext = {
    guestFirstName: wa.guest_first_name,
    guestLastName: wa.guest_last_name,
    partySize: wa.party_size,
    startsAt: new Date(wa.starts_at),
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
    delivery_status: string;
    send_batch_id?: string | null;
    external_source_id?: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await admin.from("contact_messages").insert(row);
  return { error: error?.message ?? null };
}

export async function sendContactMessageServer(
  admin: SupabaseClient,
  input: SendContactMessageServerInput,
): Promise<{ ok: boolean; errors: string[] }> {
  const body = input.body.trim();
  if (!body) {
    return { ok: false, errors: ["empty_body"] };
  }

  const channels = [...new Set(input.channels)];
  if (channels.length === 0) {
    return { ok: false, errors: ["no_channels"] };
  }

  const sendBatchId = channels.length > 1 ? randomUUID() : null;
  const errors: string[] = [];
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
      const { error } = await insertMessage(admin, {
        restaurant_id: input.restaurantId,
        contact_id: input.contactId,
        platform: "gwada",
        direction: input.direction,
        body,
        reservation_id: input.reservationId ?? null,
        sent_by: input.sentBy ?? null,
        delivery_status: "delivered",
        send_batch_id: sendBatchId,
      });
      if (error) errors.push(`gwada:${error}`);
      continue;
    }

    if (channel === "whatsapp") {
      let deliveryStatus = "pending";
      let sendError: string | null = null;

      if (input.direction === "outbound") {
        const sessionOk = await isWhatsappSessionWorking(input.restaurantId);
        const chatId = await resolveWhatsappChatId(admin, {
          restaurantId: input.restaurantId,
          contactId: input.contactId,
          reservationId: input.reservationId,
        });

        if (!sessionOk) {
          deliveryStatus = "failed";
          sendError = "session_not_working";
          errors.push("whatsapp:session_not_working");
        } else if (!chatId) {
          deliveryStatus = "failed";
          sendError = "no_phone";
          errors.push("whatsapp:no_phone");
        } else {
          const sent = await wahaSendText({
            restaurantId: input.restaurantId,
            chatId,
            text: externalText,
          });
          if (sent.ok) {
            deliveryStatus = "sent";
          } else {
            deliveryStatus = "failed";
            sendError = sent.error;
            errors.push(`whatsapp:${sent.error}`);
          }
        }
      } else {
        deliveryStatus = "delivered";
      }

      const { error } = await insertMessage(admin, {
        restaurant_id: input.restaurantId,
        contact_id: input.contactId,
        platform: "whatsapp",
        direction: input.direction,
        body,
        reservation_id: input.reservationId ?? null,
        sent_by: input.sentBy ?? null,
        delivery_status: deliveryStatus,
        send_batch_id: sendBatchId,
      });
      if (error) errors.push(`whatsapp_db:${error}`);
      if (sendError && deliveryStatus === "failed") {
        /* already in errors */
      }
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
            const subject = reservationMeta
              ? `Nachricht zu Reservierung #${reservationMeta.ctx.reservationNumber}`
              : "Nachricht von Ihrem Restaurant";
            const result = await sendReservationEmail(delivery, {
              to,
              subject,
              text: externalText,
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

      const { error } = await insertMessage(admin, {
        restaurant_id: input.restaurantId,
        contact_id: input.contactId,
        platform: "email",
        direction: input.direction,
        body,
        reservation_id: input.reservationId ?? null,
        sent_by: input.sentBy ?? null,
        delivery_status: deliveryStatus,
        send_batch_id: sendBatchId,
      });
      if (error) errors.push(`email_db:${error}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
