import "server-only";

import { resolveContactIdByMetaSender } from "@/lib/contact-messages/resolve-meta-sender-server";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { upsertContactMessagingId } from "@/lib/contact-messages/link-meta-thread-server";
import {
  displayNameFromWahaChatId,
  formatDigitsAsWhatsAppPhone,
  pickReadableName,
} from "@/lib/contact-messages/waha-chat-label";
import {
  resolveWahaInboundIdentity,
} from "@/lib/contact-messages/waha-inbound-identity-server";
import { fetchRestaurantContactSettingsAdmin } from "@/lib/contacts/contact-settings-server";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { isWahaLidChatId } from "@/lib/waha/waha-lids";
import type { SupabaseClient } from "@supabase/supabase-js";

async function touchContact(
  admin: SupabaseClient,
  contactId: string,
  patch?: { firstName?: string; lastName?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, string> = {
    last_interaction_at: now,
    updated_at: now,
  };
  if (patch?.firstName?.trim()) {
    updates.first_name = patch.firstName.trim();
  }
  if (patch?.lastName?.trim()) {
    updates.last_name = patch.lastName.trim();
  }
  await admin.from("contacts").update(updates).eq("id", contactId);
}

async function insertContactRow(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    firstName: string;
    lastName?: string;
  },
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("contacts")
    .insert({
      restaurant_id: params.restaurantId,
      first_name: params.firstName.trim() || "Gast",
      last_name: params.lastName?.trim() ?? "",
      last_interaction_at: now,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn("[contact-auto-create] insert contact", error?.message);
    return null;
  }
  return (data as { id: string }).id;
}

function splitPersonName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Gast", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

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
    await touchContact(admin, existing, patch);
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

  const settings = await fetchRestaurantContactSettingsAdmin(
    admin,
    params.restaurantId,
  );
  if (!settings.autoCreateFromMessages) return null;

  const byPhone = await admin
    .from("contact_phones")
    .select("contact_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("phone_normalized", identity.phoneNormalized)
    .maybeSingle();
  const raceContactId =
    (byPhone.data as { contact_id: string } | null)?.contact_id ?? null;
  if (raceContactId) {
    await touchContact(admin, raceContactId);
    if (identity.isLidChat) {
      await linkWhatsappLidToContact(admin, {
        restaurantId: params.restaurantId,
        contactId: raceContactId,
        lidChatId: identity.sourceChatId,
        label: identity.displayLabel,
      });
    }
    return raceContactId;
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

  const contactId = await insertContactRow(admin, {
    restaurantId: params.restaurantId,
    firstName: name.firstName,
    lastName: name.lastName,
  });
  if (!contactId) return null;

  const { error: phoneErr } = await admin.from("contact_phones").insert({
    contact_id: contactId,
    restaurant_id: params.restaurantId,
    phone_display: phoneDisplay,
    phone_normalized: identity.phoneNormalized,
    is_primary: true,
  });

  if (phoneErr) {
    const retry = await admin
      .from("contact_phones")
      .select("contact_id")
      .eq("restaurant_id", params.restaurantId)
      .eq("phone_normalized", identity.phoneNormalized)
      .maybeSingle();
    const recovered =
      (retry.data as { contact_id: string } | null)?.contact_id ?? null;
    if (recovered) {
      await admin.from("contacts").delete().eq("id", contactId);
      await touchContact(admin, recovered);
      if (identity.isLidChat) {
        await linkWhatsappLidToContact(admin, {
          restaurantId: params.restaurantId,
          contactId: recovered,
          lidChatId: identity.sourceChatId,
          label: identity.displayLabel,
        });
      }
      return recovered;
    }
    return null;
  }

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

async function findContactIdByEmail(
  admin: SupabaseClient,
  restaurantId: string,
  emailNormalized: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact_emails")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("email_normalized", emailNormalized)
    .maybeSingle();
  return (data as { contact_id: string } | null)?.contact_id ?? null;
}

function firstNameFromEmail(emailNormalized: string): string {
  const local = emailNormalized.split("@")[0]?.trim() ?? "";
  if (!local || local.length < 2) return "Gast";
  return local.slice(0, 80);
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
    await touchContact(admin, existing, patch);
    return existing;
  }

  const settings = await fetchRestaurantContactSettingsAdmin(
    admin,
    params.restaurantId,
  );
  if (!settings.autoCreateFromMessages) return null;

  const readable = pickReadableName(params.senderName);
  const fallback =
    params.platform === "instagram" ? "Instagram" : "Facebook";
  const name = readable
    ? splitPersonName(readable)
    : { firstName: fallback, lastName: "" };

  const contactId = await insertContactRow(admin, {
    restaurantId: params.restaurantId,
    firstName: name.firstName,
    lastName: name.lastName,
  });
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
      await touchContact(admin, retry);
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
  const emailNormalized = normalizeContactEmail(params.email);
  if (!emailNormalized) return null;

  const existing = await findContactIdByEmail(
    admin,
    params.restaurantId,
    emailNormalized,
  );
  if (existing) {
    const readable = pickReadableName(params.displayName);
    const patch = readable ? splitPersonName(readable) : undefined;
    await touchContact(admin, existing, patch);
    return existing;
  }

  const settings = await fetchRestaurantContactSettingsAdmin(
    admin,
    params.restaurantId,
  );
  if (!settings.autoCreateFromMessages) return null;

  const readable = pickReadableName(params.displayName);
  const name = readable
    ? splitPersonName(readable)
    : { firstName: firstNameFromEmail(emailNormalized), lastName: "" };

  const contactId = await insertContactRow(admin, {
    restaurantId: params.restaurantId,
    firstName: name.firstName,
    lastName: name.lastName,
  });
  if (!contactId) return null;

  const { error: emailErr } = await admin.from("contact_emails").insert({
    contact_id: contactId,
    restaurant_id: params.restaurantId,
    email: params.email.trim(),
    email_normalized: emailNormalized,
    is_primary: true,
  });

  if (emailErr) {
    const recovered = await findContactIdByEmail(
      admin,
      params.restaurantId,
      emailNormalized,
    );
    if (recovered) {
      await admin.from("contacts").delete().eq("id", contactId);
      await touchContact(admin, recovered);
      return recovered;
    }
    return null;
  }

  return contactId;
}
