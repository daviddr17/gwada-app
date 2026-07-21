import "server-only";

import { randomBytes } from "crypto";
import {
  MANUAL_REVIEW_INVITE_TTL_HOURS,
  reviewInvitationPublicUrl,
} from "@/lib/reviews/gwada-review-invitation-server";
import { contactHasSubmittedGwadaReview } from "@/lib/reviews/contact-gwada-review-server";
import { buildManualReviewInvitationMessage } from "@/lib/reviews/review-invitation-messages";
import { executeContactIdentityResolution } from "@/lib/contacts/contact-identity-resolver";
import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { getPublicSiteUrl } from "@/lib/public-env";
import { wahaCheckNumberExists, wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createManualGwadaReviewInvitation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    origin?: string;
    createdByUserId?: string | null;
  },
): Promise<
  | {
      token: string;
      url: string;
      expiresAt: string;
      defaultMessage: string;
      restaurantName: string;
    }
  | { error: string }
> {
  const { data: restaurant, error: restErr } = await admin
    .from("restaurants")
    .select("id, name")
    .eq("id", params.restaurantId)
    .maybeSingle();

  if (restErr || !restaurant?.id) {
    return { error: "not_found" };
  }

  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + MANUAL_REVIEW_INVITE_TTL_HOURS);

  const { error } = await admin.from("gwada_review_invitations").insert({
    restaurant_id: params.restaurantId,
    reservation_id: null,
    token,
    expires_at: expiresAt.toISOString(),
    completed_at: null,
    created_by: params.createdByUserId ?? null,
  });

  if (error) {
    console.warn("manual review invitation", error.message);
    return { error: "create_failed" };
  }

  const origin =
    params.origin?.replace(/\/$/, "") ||
    getPublicSiteUrl()?.replace(/\/$/, "") ||
    "";
  if (!origin) {
    return { error: "origin_missing" };
  }

  const url = reviewInvitationPublicUrl(origin, token);
  const restaurantName = (restaurant.name as string)?.trim() || "Restaurant";

  return {
    token,
    url,
    expiresAt: expiresAt.toISOString(),
    defaultMessage: buildManualReviewInvitationMessage({
      restaurantName,
      reviewUrl: url,
    }),
    restaurantName,
  };
}

async function resolveOrCreateContactForInvite(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    guestPhone: string | null;
    guestEmail: string | null;
    guestFirstName: string | null;
  },
): Promise<{ contactId: string } | { error: string }> {
  if (!params.guestPhone?.trim() && !params.guestEmail?.trim()) {
    return { error: "contact_required" };
  }

  const { contactId, resolution } = await executeContactIdentityResolution(
    admin,
    {
      restaurantId: params.restaurantId,
      eventType: "review",
      phone: params.guestPhone,
      phoneDisplay: params.guestPhone,
      email: params.guestEmail,
      firstName: params.guestFirstName,
    },
  );

  if (contactId) {
    return { contactId };
  }

  if (resolution.action === "ambiguous") {
    return { error: "contact_ambiguous" };
  }

  if (resolution.action === "skip" && resolution.reason === "auto_create_disabled") {
    return { error: "contact_create_disabled" };
  }

  return { error: "contact_create_failed" };
}

export async function checkReviewInviteWhatsappNumber(
  admin: SupabaseClient,
  params: { restaurantId: string; guestPhone: string },
): Promise<
  | { ok: true; exists: boolean }
  | { ok: false; error: string }
> {
  const phone = params.guestPhone.trim();
  if (!phone) return { ok: false, error: "no_phone" };

  const config = await getWahaServerConfigAdmin();
  if (!config) return { ok: false, error: "waha_not_configured" };

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const sessionRes = await wahaGetSession(config, session);
  if (!sessionRes.ok || sessionRes.data?.status !== "WORKING") {
    return { ok: false, error: "whatsapp_not_connected" };
  }

  const digits = phone.replace(/\D/g, "");
  const check = await wahaCheckNumberExists(config, session, digits);
  if (!check.ok) {
    return { ok: false, error: check.error };
  }

  return { ok: true, exists: Boolean(check.data.numberExists) };
}

export async function sendManualReviewInvitation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    invitationToken: string;
    messageBody: string;
    guestPhone: string | null;
    guestEmail: string | null;
    guestFirstName: string | null;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    sentByUserId: string | null;
    restaurantName?: string | null;
    clientSendId?: string | null;
  },
): Promise<{
  ok: boolean;
  errors: string[];
  messageId?: string;
  wahaMessageId?: string | null;
  contactId?: string;
}> {
  const token = params.invitationToken.trim();
  if (!token) {
    return { ok: false, errors: ["invalid_token"] };
  }

  const { data: inv, error: invErr } = await admin
    .from("gwada_review_invitations")
    .select("id, restaurant_id, completed_at, expires_at, link_sent_at")
    .eq("token", token)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (invErr || !inv) {
    return { ok: false, errors: ["invitation_not_found"] };
  }
  if (inv.completed_at) {
    return { ok: false, errors: ["invitation_completed"] };
  }
  if (new Date(inv.expires_at as string).getTime() < Date.now()) {
    return { ok: false, errors: ["invitation_expired"] };
  }

  if (!params.sendWhatsapp && !params.sendEmail) {
    return { ok: false, errors: ["no_send_channel"] };
  }

  const body = params.messageBody.trim();
  if (!body) {
    return { ok: false, errors: ["empty_body"] };
  }

  const contactRes = await resolveOrCreateContactForInvite(admin, {
    restaurantId: params.restaurantId,
    guestPhone: params.sendWhatsapp ? params.guestPhone : null,
    guestEmail: params.sendEmail ? params.guestEmail : null,
    guestFirstName: params.guestFirstName,
  });
  if ("error" in contactRes) {
    return { ok: false, errors: [contactRes.error] };
  }

  if (
    await contactHasSubmittedGwadaReview(
      admin,
      params.restaurantId,
      contactRes.contactId,
    )
  ) {
    return { ok: false, errors: ["contact_already_reviewed"] };
  }

  if (params.sendWhatsapp) {
    const wa = await checkReviewInviteWhatsappNumber(admin, {
      restaurantId: params.restaurantId,
      guestPhone: params.guestPhone ?? "",
    });
    if (!wa.ok) {
      return { ok: false, errors: [`whatsapp:${wa.error}`] };
    }
    if (!wa.exists) {
      return { ok: false, errors: ["whatsapp:number_not_registered"] };
    }
  }

  const channels: ("gwada" | "whatsapp" | "email")[] = ["gwada"];
  if (params.sendWhatsapp) channels.push("whatsapp");
  if (params.sendEmail) channels.push("email");

  const result = await sendContactMessageServer(admin, {
    restaurantId: params.restaurantId,
    contactId: contactRes.contactId,
    body,
    direction: "outbound",
    channels,
    reservationId: null,
    sentBy: params.sentByUserId,
    restaurantName: params.restaurantName,
    clientSendId: params.clientSendId ?? undefined,
  });

  const externalChannels = channels.filter(
    (c): c is "whatsapp" | "email" => c === "whatsapp" || c === "email",
  );
  if (
    result.ok &&
    externalChannels.length > 0 &&
    !inv.link_sent_at
  ) {
    await admin
      .from("gwada_review_invitations")
      .update({
        link_sent_at: new Date().toISOString(),
        link_sent_by: params.sentByUserId,
        link_sent_channels: externalChannels,
      })
      .eq("id", inv.id);
  }

  return {
    ...result,
    contactId: contactRes.contactId,
  };
}
