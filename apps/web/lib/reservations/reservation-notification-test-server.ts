import "server-only";

import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import { buildGuestManageUrl } from "@/lib/reservations/guest-manage-url";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { oauthConfigFromJson, type MetaOAuthIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import {
  buildReviewRequestPreviewBlock,
  type ReviewRequestSettings,
} from "@/lib/reviews/gwada-review-invitation-server";
import {
  hasAnyReviewInclude,
  type ReviewRequestIncludes,
} from "@/lib/reviews/review-request-settings";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";
import {
  buildEmailSubject,
  DEFAULT_WHATSAPP_TEMPLATES,
  renderWhatsappMessageTemplate,
  resolveEmailTemplate,
  resolveEmailSenderDisplayName,
  type EmailTemplateSettings,
  type WhatsappMessageKind,
} from "@/lib/whatsapp/reservation-whatsapp-message-config";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

const TEST_MESSAGE_FOOTER =
  "\n\n—\nTestnachricht mit Beispieldaten (Name, Termin, Reservierungsnr.). Bei echten Gästen werden persönliche Daten und Gwada-Links automatisch gesetzt.";

export function sampleReservationMessageContext(params: {
  guestManageUrlTemplate?: string | null;
  restaurantName?: string | null;
  timeZone?: string;
}): ReservationMessageContext {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 2);
  startsAt.setHours(19, 30, 0, 0);

  return {
    guestFirstName: "Max",
    guestLastName: "Mustermann",
    partySize: 4,
    startsAt,
    timeZone: params.timeZone?.trim() || DEFAULT_RESTAURANT_TIMEZONE,
    reservationNumber: 12345,
    guestPin: "4829",
    restaurantName: params.restaurantName?.trim() || "Restaurant Beispiel",
    manageUrl: buildGuestManageUrl(
      params.guestManageUrlTemplate,
      12345,
      "4829",
    ),
  };
}

function draftEmailSettings(
  kind: WhatsappMessageKind,
  template: string,
  subject: string,
  emailSenderName: string | null,
): EmailTemplateSettings {
  const t = template.trim() || null;
  const s = subject.trim() || null;
  return {
    email_sender_name: emailSenderName,
    email_received_template: kind === "received" ? t : null,
    email_confirmed_template: kind === "confirmed" ? t : null,
    email_reminder_template: kind === "reminder" ? t : null,
    email_thanks_template: kind === "thanks" ? t : null,
    email_cancelled_template: kind === "cancelled" ? t : null,
    email_declined_template: kind === "declined" ? t : null,
    email_no_show_template: kind === "no_show" ? t : null,
    email_received_subject: kind === "received" ? s : null,
    email_confirmed_subject: kind === "confirmed" ? s : null,
    email_reminder_subject: kind === "reminder" ? s : null,
    email_thanks_subject: kind === "thanks" ? s : null,
    email_cancelled_subject: kind === "cancelled" ? s : null,
    email_declined_subject: kind === "declined" ? s : null,
    email_no_show_subject: kind === "no_show" ? s : null,
  };
}

function facebookReviewUrl(pageId: string | undefined): string | null {
  if (!pageId?.trim()) return null;
  return `https://www.facebook.com/${pageId.trim()}/reviews`;
}

async function appendPreviewReviewBlock(params: {
  restaurantId: string;
  text: string;
  reviewIncludes: ReviewRequestIncludes;
  reviewGoogleUrl: string | null;
  reviewFacebookUrl: string | null;
}): Promise<string> {
  const settings: ReviewRequestSettings = {
    ...params.reviewIncludes,
    review_google_url: params.reviewGoogleUrl,
    review_facebook_url: params.reviewFacebookUrl,
  };
  if (!hasAnyReviewInclude(settings)) return params.text;

  const fbRow = settings.includeFacebook
    ? await fetchRestaurantOAuthIntegrationAdmin(
        params.restaurantId,
        "facebook",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      )
    : null;

  const block = buildReviewRequestPreviewBlock({
    settings,
    googleReviewUrl: settings.review_google_url,
    facebookReviewUrl:
      settings.review_facebook_url ??
      facebookReviewUrl(fbRow?.config.page_id),
  });

  if (!block.trim()) return params.text;
  return `${params.text.trim()}${block}`;
}

async function fetchRestaurantName(
  restaurantId: string,
): Promise<string | null> {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  const name = data?.name;
  return typeof name === "string" ? name.trim() || null : null;
}

export async function sendReservationNotificationTestWhatsapp(params: {
  restaurantId: string;
  kind: WhatsappMessageKind;
  toPhone: string;
  template: string;
  guestManageUrlTemplate: string | null;
  reviewIncludes?: ReviewRequestIncludes;
  reviewGoogleUrl?: string | null;
  reviewFacebookUrl?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const chatId = guestPhoneToWhatsAppChatId(params.toPhone);
  if (!chatId) {
    return { ok: false, error: "Ungültige Telefonnummer." };
  }

  const config = await getWahaServerConfigForRestaurantAdmin(
    params.restaurantId,
  );
  if (!config) {
    return { ok: false, error: "WhatsApp ist nicht konfiguriert." };
  }

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const live = await wahaGetSession(config, session);
  if (!live.ok || live.data?.status !== "WORKING") {
    return {
      ok: false,
      error: "WhatsApp ist nicht verbunden. Bitte unter Integrationen verbinden.",
    };
  }

  const restaurantName = await fetchRestaurantName(params.restaurantId);
  const ctx = sampleReservationMessageContext({
    guestManageUrlTemplate: params.guestManageUrlTemplate,
    restaurantName,
  });

  const template =
    params.template.trim() ||
    DEFAULT_WHATSAPP_TEMPLATES[params.kind];
  let text = renderWhatsappMessageTemplate(template, ctx);

  if (params.kind === "thanks" && params.reviewIncludes) {
    text = await appendPreviewReviewBlock({
      restaurantId: params.restaurantId,
      text,
      reviewIncludes: params.reviewIncludes,
      reviewGoogleUrl: params.reviewGoogleUrl?.trim() || null,
      reviewFacebookUrl: params.reviewFacebookUrl?.trim() || null,
    });
  }

  text = `${text}${TEST_MESSAGE_FOOTER}`;

  const result = await wahaSendText({
    restaurantId: params.restaurantId,
    chatId,
    text,
  });

  if (!result.ok) {
    return { ok: false, error: "WhatsApp-Versand fehlgeschlagen." };
  }

  return { ok: true };
}

export async function sendReservationNotificationTestEmail(params: {
  restaurantId: string;
  kind: WhatsappMessageKind;
  toEmail: string;
  template: string;
  subject: string;
  emailSenderName: string | null;
  guestManageUrlTemplate: string | null;
  reviewIncludes?: ReviewRequestIncludes;
  reviewGoogleUrl?: string | null;
  reviewFacebookUrl?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = params.toEmail.trim();
  if (!to.includes("@")) {
    return { ok: false, error: "Ungültige E-Mail-Adresse." };
  }

  const sb = await createSupabaseServerClient();
  const delivery = await resolveEmailDeliveryForRestaurant(params.restaurantId, sb);
  if (!delivery) {
    return {
      ok: false,
      error: "E-Mail-Versand ist nicht konfiguriert.",
    };
  }

  const restaurantName = await fetchRestaurantName(params.restaurantId);
  const ctx = sampleReservationMessageContext({
    guestManageUrlTemplate: params.guestManageUrlTemplate,
    restaurantName,
  });

  const settings = draftEmailSettings(
    params.kind,
    params.template,
    params.subject,
    params.emailSenderName,
  );

  const template =
    params.template.trim() || resolveEmailTemplate(settings, params.kind);
  let text = renderWhatsappMessageTemplate(template, ctx);
  const subject = buildEmailSubject(settings, params.kind, ctx);

  if (params.kind === "thanks" && params.reviewIncludes) {
    text = await appendPreviewReviewBlock({
      restaurantId: params.restaurantId,
      text,
      reviewIncludes: params.reviewIncludes,
      reviewGoogleUrl: params.reviewGoogleUrl?.trim() || null,
      reviewFacebookUrl: params.reviewFacebookUrl?.trim() || null,
    });
  }

  text = `${text}${TEST_MESSAGE_FOOTER}`;

  const fromName = resolveEmailSenderDisplayName(settings, delivery.sender.name);
  const result = await sendReservationEmail(
    { ...delivery, sender: { ...delivery.sender, name: fromName } },
    {
      to,
      subject: `[Test] ${subject}`,
      text,
      intro: "Testnachricht mit Beispieldaten — siehe Hinweis am Ende der Nachricht.",
      headline: subject,
    },
  );

  if (!result.ok) {
    return { ok: false, error: "E-Mail-Versand fehlgeschlagen." };
  }

  return { ok: true };
}

export function isWhatsappMessageKind(value: string): value is WhatsappMessageKind {
  return (
    value === "received" ||
    value === "confirmed" ||
    value === "reminder" ||
    value === "thanks" ||
    value === "cancelled" ||
    value === "declined" ||
    value === "no_show"
  );
}
