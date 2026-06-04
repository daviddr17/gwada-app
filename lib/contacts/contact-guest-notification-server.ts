import "server-only";

import {
  fetchGuestChatAuthSettings,
  issueGuestLoginCode,
} from "@/lib/contacts/guest-chat-auth-server";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
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

  for (const row of emails ?? []) {
    const email = (row as { email: string }).email?.trim();
    if (email && email.includes("@")) return email;
  }
  return null;
}

export type GuestChatNotificationVariant = "new_message" | "access_renewal";

function buildNotificationText(params: {
  restaurantName: string;
  chatUrl: string;
  code: string;
  validHours: number;
  messagePreview?: string | null;
  variant?: GuestChatNotificationVariant;
}): string {
  const name = params.restaurantName.trim() || "Ihr Restaurant";
  const variant = params.variant ?? "new_message";
  const lines =
    variant === "access_renewal"
      ? [
          `Ihr Zugang zu den Nachrichten von ${name} ist abgelaufen oder ungültig.`,
          "Hier ist Ihr neuer Zugangscode:",
        ]
      : [`Sie haben eine neue Nachricht von ${name}.`];
  const preview =
    variant === "new_message" ? params.messagePreview?.trim() : null;
  if (preview) {
    lines.push("", preview);
  }
  lines.push(
    "",
    `Zugangscode (gültig ${params.validHours} Stunden): ${params.code}`,
    `Chat öffnen: ${params.chatUrl}`,
    "",
    "Antworten können Sie im Chat oder per E-Mail auf diese Nachricht.",
  );
  return lines.join("\n");
}

export async function resolveGuestNotifyChannels(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string; reservationId?: string | null },
): Promise<{ notifyEmail: boolean; notifyWhatsapp: boolean }> {
  const hasEmail = Boolean(
    await resolveContactEmail(admin, params.restaurantId, params.contactId),
  );
  let notifyWhatsapp = false;
  if (await isWhatsappSessionWorking(params.restaurantId)) {
    const phone = await resolveWhatsappPhoneForContact(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      reservationId: params.reservationId ?? null,
    });
    notifyWhatsapp = Boolean(
      phone && guestPhoneToWhatsAppChatId(phone),
    );
  }
  const delivery = hasEmail
    ? await resolveEmailDeliveryForRestaurant(params.restaurantId, admin)
    : null;
  return {
    notifyEmail: hasEmail && Boolean(delivery),
    notifyWhatsapp,
  };
}

export async function sendContactGuestChatNotifications(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    restaurantName?: string | null;
    notifyWhatsapp: boolean;
    notifyEmail: boolean;
    reservationId?: string | null;
    messagePreview?: string | null;
    variant?: GuestChatNotificationVariant;
  },
): Promise<{ ok: boolean; errors: string[]; channelsSent: ("email" | "whatsapp")[] }> {
  const errors: string[] = [];
  const channelsSent: ("email" | "whatsapp")[] = [];

  if (!params.notifyWhatsapp && !params.notifyEmail) {
    return { ok: true, errors: [], channelsSent };
  }

  const issued = await issueGuestLoginCode(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
  });
  if (!issued) {
    return { ok: false, errors: ["guest_chat:no_access"], channelsSent };
  }

  const settings = await fetchGuestChatAuthSettings(admin, params.restaurantId);
  const label = params.restaurantName?.trim() || "Ihrem Restaurant";
  const text = buildNotificationText({
    restaurantName: label,
    chatUrl: issued.chatUrl,
    code: issued.code,
    validHours: settings.codeValidHours,
    messagePreview: params.messagePreview,
    variant: params.variant,
  });

  if (params.notifyWhatsapp) {
    if (!(await isWhatsappSessionWorking(params.restaurantId))) {
      errors.push("notify_whatsapp:session_not_working");
    } else {
      const phone = await resolveWhatsappPhoneForContact(admin, {
        restaurantId: params.restaurantId,
        contactId: params.contactId,
        reservationId: params.reservationId,
      });
      const chatId = phone ? guestPhoneToWhatsAppChatId(phone) : null;
      if (!chatId) {
        errors.push("notify_whatsapp:no_phone");
      } else {
        const sent = await wahaSendText({
          restaurantId: params.restaurantId,
          chatId,
          text,
        });
        if (!sent.ok) errors.push(`notify_whatsapp:${sent.error}`);
        else channelsSent.push("whatsapp");
      }
    }
  }

  if (params.notifyEmail) {
    const to = await resolveContactEmail(
      admin,
      params.restaurantId,
      params.contactId,
    );
    if (!to) {
      errors.push("notify_email:no_email");
    } else {
      const delivery = await resolveEmailDeliveryForRestaurant(
        params.restaurantId,
        admin,
      );
      if (!delivery) {
        errors.push("notify_email:smtp_not_configured");
      } else {
        const renewal = params.variant === "access_renewal";
        const result = await sendReservationEmail(delivery, {
          to,
          subject: renewal
            ? `Neuer Zugang — Nachrichten von ${label}`
            : `Neue Nachricht von ${label}`,
          text,
          headline: renewal
            ? `Zugang erneuert — ${label}`
            : `Nachricht von ${label}`,
          intro: renewal
            ? "Ihr früherer Zugangscode ist abgelaufen. Verwenden Sie den neuen Code unten oder antworten Sie auf diese E-Mail."
            : "Öffnen Sie den Chat mit Ihrem Zugangscode oder antworten Sie direkt auf diese E-Mail.",
          replyTo: delivery.smtp.email,
        });
        if (!result.ok) errors.push(`notify_email:${result.error}`);
        else channelsSent.push("email");
      }
    }
  }

  return { ok: errors.length === 0, errors, channelsSent };
}
