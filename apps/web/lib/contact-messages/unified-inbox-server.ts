import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { fetchContactConversationsAdmin } from "@/lib/contact-messages/fetch-contact-conversations-admin";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { enrichUnifiedInboxReadStateServer } from "@/lib/contact-messages/unified-inbox-read-state";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

type UnifiedInboxParams = {
  restaurantId: string;
  userId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
};

async function fetchUnifiedInboxFromDbAdmin(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
  options?: { light?: boolean },
): Promise<ContactConversationPreview[]> {
  const platforms: ContactMessagePlatform[] = ["gwada"];
  if (params.whatsappConnected) platforms.push("whatsapp");
  if (params.emailConnected) platforms.push("email");
  if (params.facebookConnected) platforms.push("facebook");
  if (params.instagramConnected) platforms.push("instagram");

  const sources = await Promise.all(
    platforms.map((platform) =>
      fetchContactConversationsAdmin(admin, {
        restaurantId: params.restaurantId,
        platform,
        light: options?.light,
      }),
    ),
  );

  const merged = mergeInboxConversationPreviews(sources);
  return enrichUnifiedInboxReadStateServer(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversations: merged,
  });
}

export async function fetchUnifiedInboxConversationsForDashboard(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
): Promise<ContactConversationPreview[]> {
  return fetchUnifiedInboxFromDbAdmin(admin, params, { light: true });
}

export async function fetchUnifiedInboxConversationsServer(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
): Promise<ContactConversationPreview[]> {
  return fetchUnifiedInboxFromDbAdmin(admin, params);
}
