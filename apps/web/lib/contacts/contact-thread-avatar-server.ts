import "server-only";

import { RESTAURANT_CONTACT_AVATARS_BUCKET } from "@/lib/contacts/contact-avatar-storage";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";
import { signDisplayStorageUrl } from "@/lib/display/display-storage-urls";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactThreadAvatarPresentation = {
  avatarUrl: string | null;
  avatarInitials: string;
};

async function signContactAvatarPath(
  admin: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  return signDisplayStorageUrl(admin, RESTAURANT_CONTACT_AVATARS_BUCKET, path);
}

async function readLinkedContactAvatarPath(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("contacts")
    .select("avatar_storage_path")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.contactId)
    .maybeSingle();

  return (
    (data as { avatar_storage_path: string | null } | null)?.avatar_storage_path?.trim() ??
    null
  );
}

async function readWhatsappChatAvatarPath(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_whatsapp_chat_avatars")
    .select("avatar_storage_path")
    .eq("restaurant_id", params.restaurantId)
    .eq("chat_id", params.chatId)
    .maybeSingle();

  return (
    (data as { avatar_storage_path: string | null } | null)?.avatar_storage_path?.trim() ??
    null
  );
}

/** Nur DB/Storage — kein WAHA, kein Live-Fetch. UI-Fallback: Initialen. */
async function readThreadAvatarStoragePath(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    linkedContactId?: string | null;
    whatsappChatId?: string | null;
  },
): Promise<string | null> {
  if (params.linkedContactId) {
    const fromContact = await readLinkedContactAvatarPath(admin, {
      restaurantId: params.restaurantId,
      contactId: params.linkedContactId,
    });
    if (fromContact) return fromContact;
  }

  const chatId = params.whatsappChatId?.trim();
  if (chatId) {
    return readWhatsappChatAvatarPath(admin, {
      restaurantId: params.restaurantId,
      chatId,
    });
  }

  return null;
}

/** Chat-Header: gespeichertes Bild oder sofort Initialen — nie WAHA im Request-Pfad. */
export async function resolveContactThreadAvatarPresentation(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    linkedContactId?: string | null;
    whatsappChatId?: string | null;
  },
): Promise<ContactThreadAvatarPresentation> {
  const avatarInitials = contactThreadAvatarInitials({
    displayName: params.displayName,
    firstName: params.firstName,
    lastName: params.lastName,
  });

  const storagePath = await readThreadAvatarStoragePath(admin, {
    restaurantId: params.restaurantId,
    linkedContactId: params.linkedContactId,
    whatsappChatId: params.whatsappChatId,
  });

  const avatarUrl = await signContactAvatarPath(admin, storagePath);

  return { avatarUrl, avatarInitials };
}
