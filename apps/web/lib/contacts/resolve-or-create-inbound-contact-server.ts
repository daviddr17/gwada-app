import "server-only";

import { resolveContactIdByMetaSender } from "@/lib/contact-messages/resolve-meta-sender-server";
import { upsertContactMessagingId } from "@/lib/contact-messages/link-meta-thread-server";
import {
  displayNameFromWahaChatId,
  formatDigitsAsWhatsAppPhone,
  pickReadableName,
} from "@/lib/contact-messages/waha-chat-label";
import {
  resolveWahaInboundIdentity,
} from "@/lib/contact-messages/waha-inbound-identity-server";
import { executeContactIdentityResolution, splitPersonName, touchContactRow } from "@/lib/contacts/contact-identity-resolver";
import { fetchRestaurantContactSettingsAdmin } from "@/lib/contacts/contact-settings-server";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { isWahaLidChatId } from "@/lib/waha/waha-lids";
import type { SupabaseClient } from "@supabase/supabase-js";

async function linkWhatsappLidToContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    lidChatId: string;
    label?: string | null;
  },
): Promise<void> {
  if (!isWahaLidChatId(params.lidChatId)) return;
  await upsertContactMessagingId(admin, {
    restaurantId: params.restaurantId,
    contactId: params.contactId,
    platform: "whatsapp",
    externalSenderId: params.lidChatId.trim(),
    label: pickReadableName(params.label),
  });
}

export async function resolveOrCreateContactForWhatsappInbound(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    pushName?: string | null;
  },
): Promise<string | null> {
  const chatId = params.chatId.trim();
  const identity = await resolveWahaInboundIdentity(admin, {
    restaurantId: params.restaurantId,
    chatId,
    pushName: params.pushName,
  });

  const matchChatId = identity.storageChatId;
  const existing = await resolveContactIdByWhatsappChat(admin, {
    restaurantId: params.restaurantId,
    chatId: matchChatId,
  });
  if (existing) {
    const readable = pickReadableName(params.pushName) ?? pickReadableName(identity.displayLabel);
    const patch = readable ? splitPersonName(readable) : undefined;
    await touchContactRow(admin, existing, patch);
    if (identity.isLidChat) {
      await linkWhatsappLidToContact(admin, {
        restaurantId: params.restaurantId,
        contactId: existing,
        lidChatId: identity.sourceChatId,
        label: identity.displayLabel,
      });
    }
    return existing;
  }

  if (!identity.phoneNormalized) {
    return null;
  }

  const readable = pickReadableName(params.pushName) ?? pickReadableName(identity.displayLabel);
  const phoneDisplay =
    identity.phoneDisplay ??
    formatDigitsAsWhatsAppPhone(identity.phoneNormalized) ??
    displayNameFromWahaChatId(matchChatId) ??
    `+${identity.phoneNormalized}`;
  const name = readable
    ? splitPersonName(readable)
    : { firstName: phoneDisplay, lastName: "" };

  const { contactId } = await executeContactIdentityResolution(admin, {
    restaurantId: params.restaurantId,
    eventType: "message",
    whatsappChatId: matchChatId,
    phoneDisplay,
    firstName: name.firstName,
    lastName: name.lastName,
  });

  if (!contactId) return null;

  if (identity.isLidChat) {
    await linkWhatsappLidToContact(admin, {
      restaurantId: params.restaurantId,
      contactId,
      lidChatId: identity.sourceChatId,
      label: identity.displayLabel,
    });
  }

  return contactId;
}

export async function resolveOrCreateContactForMetaInbound(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
    senderId: string;
    senderName?: string | null;
  },
): Promise<string | null> {
  const senderId = params.senderId.trim();
  if (!senderId) return null;

  const existing = await resolveContactIdByMetaSender(admin, {
    restaurantId: params.restaurantId,
    platform: params.platform,
    senderId,
  });
  if (existing) {
    const readable = pickReadableName(params.senderName);
    const patch = readable ? splitPersonName(readable) : undefined;
    await touchContactRow(admin, existing, patch);
    return existing;
  }

  const readable = pickReadableName(params.senderName);
  const fallback =
    params.platform === "instagram" ? "Instagram" : "Facebook";
  const name = readable
    ? splitPersonName(readable)
    : { firstName: fallback, lastName: "" };

  let contactId: string | null = null;
  const resolution = await executeContactIdentityResolution(admin, {
    restaurantId: params.restaurantId,
    eventType: "message",
    firstName: name.firstName,
    lastName: name.lastName,
  });
  contactId = resolution.contactId;

  if (!contactId) {
    const settings = await fetchRestaurantContactSettingsAdmin(
      admin,
      params.restaurantId,
    );
    if (!settings.autoLinkEnabled || !settings.autoCreateFromMessages) {
      return null;
    }

    const now = new Date().toISOString();
    const { data: created, error } = await admin
      .from("contacts")
      .insert({
        restaurant_id: params.restaurantId,
        first_name: name.firstName,
        last_name: name.lastName,
        last_interaction_at: now,
      })
      .select("id")
      .single();
    if (error || !created?.id) {
      console.warn("[contact-auto-create] meta insert", error?.message);
      return null;
    }
    contactId = created.id as string;
  }

  if (!contactId) return null;

  const link = await upsertContactMessagingId(admin, {
    restaurantId: params.restaurantId,
    contactId,
    platform: params.platform,
    externalSenderId: senderId,
    label: readable,
  });

  if (!link.ok) {
    const retry = await resolveContactIdByMetaSender(admin, {
      restaurantId: params.restaurantId,
      platform: params.platform,
      senderId,
    });
    if (retry) {
      await admin.from("contacts").delete().eq("id", contactId);
      await touchContactRow(admin, retry);
      return retry;
    }
    return null;
  }

  return contactId;
}

export async function resolveOrCreateContactForEmailInbound(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    email: string;
    displayName?: string | null;
  },
): Promise<string | null> {
  const readable = pickReadableName(params.displayName);
  const name = readable ? splitPersonName(readable) : undefined;

  const { contactId } = await executeContactIdentityResolution(admin, {
    restaurantId: params.restaurantId,
    eventType: "message",
    email: params.email,
    firstName: name?.firstName,
    lastName: name?.lastName,
  });

  return contactId;
}
