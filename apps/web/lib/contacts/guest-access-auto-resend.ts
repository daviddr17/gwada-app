import "server-only";

import {
  resolveGuestNotifyChannels,
  sendContactGuestChatNotifications,
} from "@/lib/contacts/contact-guest-notification-server";
import {
  canIssueAnotherGuestLoginCode,
  canResendGuestCode,
  countGuestLoginCodesIssuedSince,
  hasValidUnusedGuestLoginCode,
  lastCodeSentAt,
} from "@/lib/contacts/guest-chat-auth-server";
import { GUEST_CHAT_RESEND_COOLDOWN_MS } from "@/lib/contacts/guest-chat-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AutoResendGuestAccessResult =
  | {
      ok: true;
      sent: true;
      channels: ("email" | "whatsapp")[];
    }
  | {
      ok: true;
      sent: false;
      reason: "valid_code_exists" | "no_delivery_channel";
    }
  | {
      ok: false;
      error: string;
      status: number;
      retryAfterMs?: number;
    };

/**
 * Neuen Zugangscode ausstellen und an alle erreichbaren Kanäle des Kontakts senden
 * (z. B. abgelaufener Link / Session, Gast öffnet Chat-URL erneut).
 */
export async function autoResendGuestAccessCode(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    restaurantName?: string | null;
  },
): Promise<AutoResendGuestAccessResult> {
  if (await hasValidUnusedGuestLoginCode(admin, params.contactId)) {
    return { ok: true, sent: false, reason: "valid_code_exists" };
  }

  const issued24h = await countGuestLoginCodesIssuedSince(
    admin,
    params.contactId,
    DAY_MS,
  );
  if (!canIssueAnotherGuestLoginCode(issued24h)) {
    return {
      ok: false,
      error: "daily_limit",
      status: 429,
    };
  }

  const last = await lastCodeSentAt(admin, params.contactId);
  if (!canResendGuestCode(last)) {
    const retryAfterMs = last
      ? Math.max(
          0,
          GUEST_CHAT_RESEND_COOLDOWN_MS - (Date.now() - last.getTime()),
        )
      : GUEST_CHAT_RESEND_COOLDOWN_MS;
    return {
      ok: false,
      error: "resend_cooldown",
      status: 429,
      retryAfterMs,
    };
  }

  const channels = await resolveGuestNotifyChannels(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
  });

  if (!channels.notifyEmail && !channels.notifyWhatsapp) {
    return { ok: true, sent: false, reason: "no_delivery_channel" };
  }

  let restaurantName = params.restaurantName?.trim() || null;
  if (!restaurantName) {
    const { data: r } = await admin
      .from("restaurants")
      .select("name")
      .eq("id", params.restaurantId)
      .maybeSingle();
    restaurantName = (r as { name: string } | null)?.name?.trim() || null;
  }

  const result = await sendContactGuestChatNotifications(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    restaurantName,
    notifyWhatsapp: channels.notifyWhatsapp,
    notifyEmail: channels.notifyEmail,
    variant: "access_renewal",
  });

  if (!result.ok || result.channelsSent.length === 0) {
    return {
      ok: false,
      error: result.errors[0] ?? "send_failed",
      status: 422,
    };
  }

  return {
    ok: true,
    sent: true,
    channels: result.channelsSent,
  };
}
