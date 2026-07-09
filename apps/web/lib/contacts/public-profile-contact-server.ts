import "server-only";

import { randomUUID } from "crypto";
import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import {
  isProfileContactRateLimited,
  isProfileContactSpamAttempt,
  PROFILE_CONTACT_SPAM_ACCEPTED,
} from "@/lib/contacts/public-profile-contact-spam";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import {
  loadPublicProfileContactChannelsForRestaurant,
} from "@/lib/contacts/public-profile-contact-channels-server";
import {
  sendPublicProfileContactConfirmation,
  type ProfileContactConfirmationChannel,
} from "@/lib/contacts/public-profile-contact-confirmation-server";
import { executeContactIdentityResolution } from "@/lib/contacts/contact-identity-resolver";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicProfileContactBody = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
  /** Honeypot — muss leer bleiben. */
  website?: string | null;
  /** Client-Zeitstempf (ms) beim Anzeigen des Formulars. */
  opened_at?: number | null;
  confirmation_channel?: ProfileContactConfirmationChannel | null;
};

export type PublicProfileContactResult = {
  ok: true;
  messageId: string;
};

async function resolveOrCreateProfileContact(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  params: {
    restaurantId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    emailNormalized: string | null;
    phoneDisplay: string | null;
    phoneNormalized: string | null;
  },
): Promise<string | null> {
  const { contactId } = await executeContactIdentityResolution(admin, {
    restaurantId: params.restaurantId,
    eventType: "message",
    email: params.email,
    phoneDisplay: params.phoneDisplay,
    firstName: params.firstName,
    lastName: params.lastName,
  });
  return contactId;
}

function parseConfirmationChannel(
  raw: unknown,
): ProfileContactConfirmationChannel | null {
  if (raw === "email" || raw === "whatsapp") return raw;
  return null;
}

async function validateConfirmationChannel(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  params: {
    restaurantId: string;
    channel: ProfileContactConfirmationChannel | null;
    emailNormalized: string | null;
    phoneRaw: string | null;
  },
): Promise<
  | { ok: true; channel: ProfileContactConfirmationChannel | null }
  | { ok: false; error: string }
> {
  const channels = await loadPublicProfileContactChannelsForRestaurant(
    admin,
    params.restaurantId,
  );
  const canEmail = channels.emailAvailable && Boolean(params.emailNormalized);
  const canWhatsapp =
    channels.whatsappAvailable && Boolean(params.phoneRaw?.trim());

  if (!canEmail && !canWhatsapp) {
    return { ok: true, channel: null };
  }

  const channel = params.channel;
  if (!channel) {
    return { ok: false, error: "confirmation_channel_required" };
  }
  if (channel === "email" && !canEmail) {
    return { ok: false, error: "confirmation_email_unavailable" };
  }
  if (channel === "whatsapp" && !canWhatsapp) {
    return { ok: false, error: "confirmation_whatsapp_unavailable" };
  }

  return { ok: true, channel };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitPublicProfileContact(
  slugInput: string,
  body: PublicProfileContactBody,
): Promise<
  | { data: PublicProfileContactResult; error: null; status: 200 }
  | { data: null; error: string; status: number }
> {
  const restaurantRes = await fetchPublicEmbedRestaurant(slugInput);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }

  const firstName = body.first_name?.trim() ?? "";
  const lastName = body.last_name?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const emailRaw = body.email?.trim() ?? "";
  const phoneRaw = body.phone?.trim() ?? "";

  if (!firstName) {
    return { data: null, error: "invalid_request", status: 400 };
  }

  const emailNormalized = emailRaw ? normalizeContactEmail(emailRaw) : null;
  const phoneNormalized = phoneRaw ? normalizeContactPhone(phoneRaw) : null;

  if (!emailNormalized && !phoneNormalized) {
    return { data: null, error: "contact_required", status: 400 };
  }
  if (emailRaw && !emailNormalized) {
    return { data: null, error: "invalid_email", status: 400 };
  }
  if (emailNormalized && !isValidEmail(emailNormalized)) {
    return { data: null, error: "invalid_email", status: 400 };
  }
  if (phoneRaw && !phoneNormalized) {
    return { data: null, error: "invalid_phone", status: 400 };
  }
  if (!message) {
    return { data: null, error: "message_required", status: 400 };
  }
  if (message.length > 8000) {
    return { data: null, error: "message_too_long", status: 400 };
  }

  if (
    isProfileContactSpamAttempt({
      website: body.website,
      opened_at: body.opened_at,
    })
  ) {
    return { data: PROFILE_CONTACT_SPAM_ACCEPTED, error: null, status: 200 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const confirmationChannelInput = parseConfirmationChannel(
    body.confirmation_channel,
  );
  const confirmationCheck = await validateConfirmationChannel(admin, {
    restaurantId: restaurantRes.data.id,
    channel: confirmationChannelInput,
    emailNormalized,
    phoneRaw,
  });
  if (!confirmationCheck.ok) {
    return { data: null, error: confirmationCheck.error, status: 400 };
  }
  const confirmationChannel = confirmationCheck.channel;

  const contactId = await resolveOrCreateProfileContact(admin, {
    restaurantId: restaurantRes.data.id,
    firstName,
    lastName,
    email: emailRaw || null,
    emailNormalized,
    phoneDisplay: phoneRaw || null,
    phoneNormalized,
  });

  if (!contactId) {
    return { data: null, error: "contact_create_failed", status: 500 };
  }

  if (
    await isProfileContactRateLimited(admin, {
      restaurantId: restaurantRes.data.id,
      contactId,
      message,
    })
  ) {
    return { data: PROFILE_CONTACT_SPAM_ACCEPTED, error: null, status: 200 };
  }

  const externalSourceId = `profile-contact:${randomUUID()}`;
  const { imported, messageId } = await ingestInboundContactMessage(admin, {
    restaurantId: restaurantRes.data.id,
    contactId,
    platform: "gwada",
    direction: "inbound",
    body: message,
    externalSourceId,
  });

  if (!imported || !messageId) {
    return { data: null, error: "message_send_failed", status: 500 };
  }

  if (confirmationChannel) {
    const confirmResult = await sendPublicProfileContactConfirmation(admin, {
      restaurantId: restaurantRes.data.id,
      restaurantName: restaurantRes.data.name,
      contactId,
      firstName,
      guestEmail: emailRaw || null,
      guestPhone: phoneRaw || null,
      channel: confirmationChannel,
    });
    if (!confirmResult.ok) {
      console.warn(
        "[profile-contact] confirmation not delivered",
        confirmResult.errors.join(", "),
      );
    }
  }

  return {
    data: { ok: true, messageId },
    error: null,
    status: 200,
  };
}
