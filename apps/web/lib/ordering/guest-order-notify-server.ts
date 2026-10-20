import "server-only";

import { guestOrderStatusLabelDe } from "@/lib/ordering/guest-order-labels";
import { loadOnlineOrderingSettings } from "@/lib/ordering/online-ordering-settings-server";
import { isEmailSendConfigured } from "@/lib/email/is-email-send-configured";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { getPublicSiteUrl } from "@/lib/public-env";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";

function siteBase(): string {
  return (getPublicSiteUrl() || "https://gwada.app").replace(/\/$/, "");
}

function buildStatusMessage(params: {
  restaurantName: string;
  orderNumber: number;
  status: string;
  fulfillmentType: string;
  statusToken: string | null;
  restaurantSlug: string | null;
}): { subject: string; text: string } {
  const label = guestOrderStatusLabelDe(
    params.status,
    params.fulfillmentType,
  );
  const subject = `Bestellung #${params.orderNumber}: ${label}`;
  const lines = [
    `Hallo!`,
    ``,
    `Deine Bestellung #${params.orderNumber} bei ${params.restaurantName} ist jetzt: ${label}.`,
  ];
  if (params.statusToken && params.restaurantSlug) {
    lines.push(
      ``,
      `Live-Status: ${siteBase()}/order/${params.restaurantSlug}/status/${params.statusToken}`,
    );
  }
  lines.push(``, `Viele Grüße`, params.restaurantName);
  return { subject, text: lines.join("\n") };
}

/** Fire-and-forget safe: never throws to caller. */
export async function notifyGuestOrderStatusChange(params: {
  orderId: string;
  status: string;
}): Promise<{ whatsapp: boolean; email: boolean }> {
  const result = { whatsapp: false, email: false };
  try {
    const admin = createSupabaseAdminClient();
    if (!admin) return result;

    const { data: order } = await admin
      .from("pos_orders")
      .select(
        `
        id, order_number, status, fulfillment_type, channel,
        guest_name, guest_phone, guest_email, guest_status_token,
        restaurant_id
      `,
      )
      .eq("id", params.orderId)
      .maybeSingle();

    if (!order?.restaurant_id) return result;

    // Only guest channels
    const channel = String(order.channel ?? "pos");
    if (channel === "pos") return result;

    const settings = await loadOnlineOrderingSettings(
      admin,
      order.restaurant_id as string,
    );
    if (!settings.notifyStatuses.includes(params.status)) {
      return result;
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("name, slug")
      .eq("id", order.restaurant_id as string)
      .maybeSingle();

    const msg = buildStatusMessage({
      restaurantName: String(restaurant?.name ?? "Restaurant"),
      orderNumber: Number(order.order_number),
      status: params.status,
      fulfillmentType: String(order.fulfillment_type ?? "pickup"),
      statusToken: (order.guest_status_token as string | null) ?? null,
      restaurantSlug: (restaurant?.slug as string | null) ?? null,
    });

    if (settings.notifyWhatsappEnabled && order.guest_phone) {
      const chatId = guestPhoneToWhatsAppChatId(order.guest_phone as string);
      if (chatId) {
        const sent = await wahaSendText({
          restaurantId: order.restaurant_id as string,
          chatId,
          text: msg.text,
          linkPreview: true,
        });
        result.whatsapp = sent.ok;
        if (!sent.ok) {
          console.warn("[ordering] WA notify", sent.error);
        }
      }
    }

    if (
      settings.notifyEmailEnabled &&
      order.guest_email &&
      isEmailSendConfigured()
    ) {
      const delivery = await resolveEmailDeliveryForRestaurant(
        order.restaurant_id as string,
        admin,
      );
      if (delivery) {
        const sent = await sendReservationEmail(delivery, {
          to: String(order.guest_email).trim(),
          subject: msg.subject,
          text: msg.text,
          headline: msg.subject,
        });
        result.email = sent.ok;
        if (!sent.ok) {
          console.warn("[ordering] email notify", sent.error);
        }
      }
    }
  } catch (err) {
    console.warn(
      "[ordering] notify failed",
      err instanceof Error ? err.message : err,
    );
  }
  return result;
}
