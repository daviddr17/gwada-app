import "server-only";

import {
  contactAvatarStoragePath,
  extFromImageContentType,
  RESTAURANT_CONTACT_AVATARS_BUCKET,
  shouldRefreshWhatsappAvatarSync,
} from "@/lib/contacts/contact-avatar-storage";
import { wahaGetChatPictureUrl } from "@/lib/waha/waha-inbox";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import type { SupabaseClient } from "@supabase/supabase-js";

async function downloadImageBuffer(
  url: string,
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
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

/**
 * WAHA → Storage/DB — nur aus Webhooks/Cron, nie beim Chat-Öffnen.
 */
export async function syncWhatsappChatAvatarFromWaha(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    linkedContactId?: string | null;
  },
): Promise<string | null> {
  const chatId = params.chatId.trim();
  if (!chatId) return null;

  const { data: row } = await admin
    .from("restaurant_whatsapp_chat_avatars")
    .select("avatar_storage_path, synced_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("chat_id", chatId)
    .maybeSingle();

  const existing = row as {
    avatar_storage_path: string | null;
    synced_at: string | null;
  } | null;

  if (
    existing?.avatar_storage_path?.trim() &&
    !shouldRefreshWhatsappAvatarSync(existing.synced_at)
  ) {
    return existing.avatar_storage_path.trim();
  }

  const config = await getWahaServerConfigForRestaurantAdmin(
    params.restaurantId,
  );
  if (!config) return existing?.avatar_storage_path?.trim() ?? null;

  const pictureUrl = await wahaGetChatPictureUrl({
    config,
    restaurantId: params.restaurantId,
    chatId,
  });
  if (!pictureUrl) return existing?.avatar_storage_path?.trim() ?? null;

  const path = await storeWhatsappChatAvatar(admin, {
    restaurantId: params.restaurantId,
    chatId,
    pictureUrl,
  });

  if (path && params.linkedContactId) {
    await admin
      .from("contacts")
      .update({ avatar_storage_path: path })
      .eq("restaurant_id", params.restaurantId)
      .eq("id", params.linkedContactId);
  }

  return path;
}
