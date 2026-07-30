import "server-only";

import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import {
  emailAddressFromPseudoContactId,
  isEmailPseudoContactId,
} from "@/lib/contact-messages/email-pseudo-contact";
import {
  resolveRestaurantImapCredentials,
  threadEnvelopesForContact,
} from "@/lib/contact-messages/email-inbox-service";
import { smtpPartsFromOutboundFiles } from "@/lib/contact-messages/send-channel-attachments";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import { storeGwadaMessageAttachments } from "@/lib/contact-messages/gwada-message-attachments-server";
import { mirrorOutboundEmailToContactMessages } from "@/lib/contact-messages/mirror-outbound-email-server";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { resolveEmailDeliveryForRestaurant } from "@/lib/reservations/reservation-email-dispatch";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

function replySubject(previous: string | undefined, restaurantName?: string | null): string {
  const base = (previous ?? "").trim() || `Nachricht von ${restaurantName?.trim() || "Ihrem Restaurant"}`;
  if (/^re:\s/i.test(base)) return base;
  return `Re: ${base}`;
}

async function resolveRecipientEmail(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<string | null> {
  const fromPseudo = emailAddressFromPseudoContactId(contactId);
  if (fromPseudo) return fromPseudo;

  if (!isUuidRestaurantId(contactId)) return null;

  const { data: emails } = await admin
    .from("contact_emails")
    .select("email, is_primary, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId);

  const sorted = [...(emails ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      (a.sort_order as number) - (b.sort_order as number),
  );
  for (const row of sorted) {
    const email = (row as { email: string }).email?.trim();
    const norm = normalizeContactEmail(email);
    if (norm) return norm;
  }
  return null;
}

async function lastInboundSubject(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<string | undefined> {
  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  if (!creds) return undefined;

  const { envelopes, error } = await threadEnvelopesForContact(
    admin,
    { restaurantId, contactId },
    creds,
  );
  if (error || envelopes.length === 0) return undefined;

  const inbound = envelopes
    .filter((m) => !m.outbound)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return inbound[0]?.subject ?? envelopes[envelopes.length - 1]?.subject;
}

export async function sendEmailInboxMessageServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    body: string;
    sentBy?: string | null;
    restaurantName?: string | null;
    storeUnderContact?: boolean;
    attachmentFiles?: OutboundAttachmentFile[];
  },
): Promise<{ ok: boolean; errors?: string[] }> {
  const errors: string[] = [];
  const text = params.body.trim();
  const files = params.attachmentFiles ?? [];
  if (!text && files.length === 0) {
    return { ok: false, errors: ["empty_body"] };
  }

  const to = await resolveRecipientEmail(
    admin,
    params.restaurantId,
    params.contactId,
  );
  if (!to) {
    return { ok: false, errors: ["email:no_email"] };
  }

  const delivery = await resolveEmailDeliveryForRestaurant(
    params.restaurantId,
    admin,
  );
  if (!delivery) {
    return { ok: false, errors: ["email:smtp_not_configured"] };
  }

  const prevSubject = await lastInboundSubject(
    admin,
    params.restaurantId,
    params.contactId,
  );
  const subject = replySubject(prevSubject, params.restaurantName);

  const result = await sendReservationEmail(delivery, {
    to,
    subject,
    text: text || " ",
    attachments: files.length > 0 ? smtpPartsFromOutboundFiles(files) : undefined,
  });

  if (!result.ok) {
    return { ok: false, errors: [`email:${result.error}`] };
  }

  const shouldStore =
    params.storeUnderContact !== false &&
    (isUuidRestaurantId(params.contactId) ||
      isEmailPseudoContactId(params.contactId));

  if (shouldStore) {
    const mirrored = await mirrorOutboundEmailToContactMessages(admin, {
      restaurantId: params.restaurantId,
      guestEmail: to,
      body: text || " ",
      contactId: isUuidRestaurantId(params.contactId) ? params.contactId : null,
      sentBy: params.sentBy ?? null,
      deliveryStatus: "sent",
    });
    if (!mirrored.ok) {
      errors.push(`email_db:${mirrored.error}`);
    } else if (files.length > 0) {
      const stored = await storeGwadaMessageAttachments(admin, {
        restaurantId: params.restaurantId,
        messageId: mirrored.messageId,
        files,
      });
      if (stored.error) errors.push(`email_attachments:${stored.error}`);
    }
  }

  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}
