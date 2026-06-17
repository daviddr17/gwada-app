import "server-only";

import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import {
  buildProfileContactConfirmationText,
} from "@/lib/contacts/public-profile-contact-messages";
import { checkReviewInviteWhatsappNumber } from "@/lib/reviews/review-invitation-send-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileContactConfirmationChannel = "email" | "whatsapp";

export async function sendPublicProfileContactConfirmation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    restaurantName: string;
    contactId: string;
    firstName: string;
    guestEmail: string | null;
    guestPhone: string | null;
    channel: ProfileContactConfirmationChannel;
  },
): Promise<{ ok: boolean; errors: string[] }> {
  const body = buildProfileContactConfirmationText({
    firstName: params.firstName,
    restaurantName: params.restaurantName,
  });

  const hasEmail = Boolean(params.guestEmail?.trim().includes("@"));
  const hasPhone = Boolean(params.guestPhone?.trim());

  const tryEmail = async (): Promise<{ ok: boolean; errors: string[] }> => {
    if (!hasEmail) {
      return { ok: false, errors: ["email:no_email"] };
    }
    return sendContactMessageServer(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      body,
      direction: "outbound",
      channels: ["gwada", "email"],
      sentBy: null,
      restaurantName: params.restaurantName,
    });
  };

  const tryWhatsapp = async (): Promise<{ ok: boolean; errors: string[] }> => {
    if (!hasPhone) {
      return { ok: false, errors: ["whatsapp:no_phone"] };
    }
    const wa = await checkReviewInviteWhatsappNumber(admin, {
      restaurantId: params.restaurantId,
      guestPhone: params.guestPhone!,
    });
    if (!wa.ok) {
      return { ok: false, errors: [`whatsapp:${wa.error}`] };
    }
    if (!wa.exists) {
      return { ok: false, errors: ["whatsapp:number_not_registered"] };
    }
    return sendContactMessageServer(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      body,
      direction: "outbound",
      channels: ["gwada", "whatsapp"],
      sentBy: null,
      restaurantName: params.restaurantName,
    });
  };

  if (params.channel === "whatsapp") {
    const waResult = await tryWhatsapp();
    if (waResult.ok) return waResult;
    if (hasEmail) {
      const emailResult = await tryEmail();
      if (emailResult.ok) return emailResult;
      return { ok: false, errors: [...waResult.errors, ...emailResult.errors] };
    }
    return waResult;
  }

  return tryEmail();
}
