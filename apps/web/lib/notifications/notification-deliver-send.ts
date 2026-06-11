import "server-only";

import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEffectiveNotificationEmail } from "@/lib/notifications/notification-contact-server";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { isRestaurantWhatsappSessionWorking } from "@/lib/staff/staff-invite-send-server";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadProfilePushContact(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ phone: string | null; email: string | null }> {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("profiles")
      .select("phone, notification_email")
      .eq("id", profileId)
      .maybeSingle(),
    admin.auth.admin.getUserById(profileId),
  ]);

  const phone =
    typeof profile?.phone === "string" ? profile.phone.trim() || null : null;
  const notificationEmail =
    typeof profile?.notification_email === "string"
      ? profile.notification_email.trim() || null
      : null;
  const authEmail = authUser?.user?.email?.trim() || null;
  const email =
    resolveEffectiveNotificationEmail(notificationEmail, authEmail) || null;

  return { phone, email };
}

export async function sendNotificationPushWhatsapp(params: {
  restaurantId: string;
  phone: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sessionOk = await isRestaurantWhatsappSessionWorking(params.restaurantId);
  if (!sessionOk) {
    return { ok: false, error: "whatsapp_not_connected" };
  }

  const chatId = guestPhoneToWhatsAppChatId(params.phone);
  if (!chatId) {
    return { ok: false, error: "invalid_phone" };
  }

  return wahaSendText({
    restaurantId: params.restaurantId,
    chatId,
    text: params.text,
  });
}

export async function sendNotificationPushEmail(params: {
  restaurantId: string;
  to: string;
  subject: string;
  text: string;
  admin: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const delivery = await resolveEmailDeliveryForRestaurant(
    params.restaurantId,
    params.admin,
  );
  if (!delivery) {
    return { ok: false, error: "email_not_configured" };
  }

  const headline = params.subject.trim();
  return sendReservationEmail(delivery, {
    to: params.to,
    subject: headline,
    text: params.text,
    headline,
    intro: "Du hast eine neue Benachrichtigung in gwada.",
  });
}
