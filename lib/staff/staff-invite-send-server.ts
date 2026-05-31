import "server-only";

import { buildStaffInviteMessage } from "@/lib/staff/staff-invite-message";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isRestaurantWhatsappSessionWorking(
  restaurantId: string,
): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

export async function canSendStaffInviteEmail(
  restaurantId: string,
  sbForName?: SupabaseClient,
): Promise<boolean> {
  const delivery = await resolveEmailDeliveryForRestaurant(restaurantId, sbForName);
  return delivery != null;
}

export async function sendStaffInviteWhatsapp(params: {
  restaurantId: string;
  phone: string;
  staffName: string;
  restaurantName: string;
  inviteUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sessionOk = await isRestaurantWhatsappSessionWorking(params.restaurantId);
  if (!sessionOk) {
    return { ok: false, error: "whatsapp_not_connected" };
  }

  const chatId = guestPhoneToWhatsAppChatId(params.phone.trim());
  if (!chatId) {
    return { ok: false, error: "invalid_phone" };
  }

  const text = buildStaffInviteMessage({
    staffName: params.staffName,
    restaurantName: params.restaurantName,
    inviteUrl: params.inviteUrl,
  });

  return wahaSendText({
    restaurantId: params.restaurantId,
    chatId,
    text,
  });
}

export async function sendStaffInviteEmail(params: {
  restaurantId: string;
  to: string;
  staffName: string;
  restaurantName: string;
  inviteUrl: string;
  sbForName?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const delivery = await resolveEmailDeliveryForRestaurant(
    params.restaurantId,
    params.sbForName,
  );
  if (!delivery) {
    return { ok: false, error: "email_not_configured" };
  }

  const text = buildStaffInviteMessage({
    staffName: params.staffName,
    restaurantName: params.restaurantName,
    inviteUrl: params.inviteUrl,
  });

  const subject = `Einladung — ${params.restaurantName}`;

  return sendReservationEmail(delivery, {
    to: params.to.trim(),
    subject,
    text,
  });
}
