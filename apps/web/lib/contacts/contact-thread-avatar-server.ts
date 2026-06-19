import "server-only";

import {
  contactAvatarStoragePath,
  extFromImageContentType,
  RESTAURANT_CONTACT_AVATARS_BUCKET,
  shouldRefreshWhatsappAvatarSync,
} from "@/lib/contacts/contact-avatar-storage";
import { contactThreadAvatarInitials } from "@/lib/contacts/contact-thread-avatar-initials";
import { signDisplayStorageUrl } from "@/lib/display/display-storage-urls";
import { wahaGetChatPictureUrl } from "@/lib/waha/waha-inbox";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
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

async function downloadImageBuffer(
  url: string,
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;
    return { buffer, contentType: res.headers.get("content-type") };
  } catch {
    return null;
  }
}

async function storeWhatsappChatAvatar(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    pictureUrl: string;
  },
): Promise<string | null> {
  const downloaded = await downloadImageBuffer(params.pictureUrl);
  if (!downloaded) return null;

  const ext = extFromImageContentType(downloaded.contentType);
  const path = contactAvatarStoragePath({
    restaurantId: params.restaurantId,
    kind: "whatsapp",
    id: params.chatId,
    ext,
  });

  const { error: uploadError } = await admin.storage
    .from(RESTAURANT_CONTACT_AVATARS_BUCKET)
    .upload(path, downloaded.buffer, {
      contentType: downloaded.contentType ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });

  if (uploadError) return null;

  await admin.from("restaurant_whatsapp_chat_avatars").upsert(
    {
      restaurant_id: params.restaurantId,
      chat_id: params.chatId,
      avatar_storage_path: path,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,chat_id" },
  );

  return path;
}

async function syncWhatsappChatAvatarIfNeeded(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    existingPath?: string | null;
    existingSyncedAt?: string | null;
  },
): Promise<string | null> {
  if (
    params.existingPath?.trim() &&
    !shouldRefreshWhatsappAvatarSync(params.existingSyncedAt)
  ) {
    return params.existingPath.trim();
  }

  const config = await getWahaServerConfigAdmin();
  if (!config) return params.existingPath?.trim() ?? null;

  const pictureUrl = await wahaGetChatPictureUrl({
    config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
  });
  if (!pictureUrl) return params.existingPath?.trim() ?? null;

  return storeWhatsappChatAvatar(admin, {
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    pictureUrl,
  });
}

async function resolveLinkedContactAvatarPath(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    whatsappChatId?: string | null;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("contacts")
    .select("avatar_storage_path")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.contactId)
    .maybeSingle();

  const existing = (data as { avatar_storage_path: string | null } | null)
    ?.avatar_storage_path?.trim();

  const chatId = params.whatsappChatId?.trim();
  if (!chatId) return existing ?? null;

  const syncedPath = await syncWhatsappChatAvatarIfNeeded(admin, {
    restaurantId: params.restaurantId,
    chatId,
    existingPath: existing,
    existingSyncedAt: null,
  });

  if (syncedPath && syncedPath !== existing) {
    await admin
      .from("contacts")
      .update({ avatar_storage_path: syncedPath })
      .eq("restaurant_id", params.restaurantId)
      .eq("id", params.contactId);
    return syncedPath;
  }

  return existing ?? syncedPath;
}

async function resolveWhatsappPseudoAvatarPath(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
  },
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_whatsapp_chat_avatars")
    .select("avatar_storage_path, synced_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("chat_id", params.chatId)
    .maybeSingle();

  const row = data as {
    avatar_storage_path: string | null;
    synced_at: string | null;
  } | null;

  return syncWhatsappChatAvatarIfNeeded(admin, {
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    existingPath: row?.avatar_storage_path,
    existingSyncedAt: row?.synced_at,
  });
}

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

  let storagePath: string | null = null;

  if (params.linkedContactId) {
    storagePath = await resolveLinkedContactAvatarPath(admin, {
      restaurantId: params.restaurantId,
      contactId: params.linkedContactId,
      whatsappChatId: params.whatsappChatId,
    });
  } else if (params.whatsappChatId?.trim()) {
    storagePath = await resolveWhatsappPseudoAvatarPath(admin, {
      restaurantId: params.restaurantId,
      chatId: params.whatsappChatId.trim(),
    });
  }

  const avatarUrl = await signContactAvatarPath(admin, storagePath);

  return { avatarUrl, avatarInitials };
}
