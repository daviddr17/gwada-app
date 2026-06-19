import "server-only";

import { after } from "next/server";
import { syncRestaurantNewsPlatformAfterPublish } from "@/lib/news/news-feed-sync-server";
import { revalidatePublicNewsEmbedForRestaurant } from "@/lib/news/revalidate-public-news-embed";
import {
  createWahaChannelForRestaurant,
  listWahaChannelsForRestaurant,
  type WahaChannel,
} from "@/lib/waha/waha-channels";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { getPublicSiteUrl } from "@/lib/public-env";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsappNewsChannelCreateDefaults = {
  name: string;
  descriptionSuggestion: string;
  hasAvatar: boolean;
};

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

function mimeFromStoragePath(path: string): {
  mimetype: string;
  filename: string;
} {
  const ext = path.split(".").pop()?.toLowerCase() ?? "webp";
  if (ext === "png") {
    return { mimetype: "image/png", filename: "avatar.png" };
  }
  if (ext === "jpeg" || ext === "jpg") {
    return { mimetype: "image/jpeg", filename: "avatar.jpg" };
  }
  return { mimetype: "image/webp", filename: "avatar.webp" };
}

async function resolveRestaurantAvatarPictureForWaha(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ mimetype: string; filename: string; url: string } | null> {
  const { data } = await admin
    .from("restaurants")
    .select("avatar_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();

  const path = (data as { avatar_storage_path: string | null } | null)
    ?.avatar_storage_path;
  if (!path?.trim()) return null;

  const signed = await resolveRestaurantProfileImageSignedUrl(admin, path, 900);
  if (!signed) return null;

  let url = signed;
  if (url.startsWith("/")) {
    const site = getPublicSiteUrl();
    if (!site) return null;
    url = `${site}${url}`;
  }

  const { mimetype, filename } = mimeFromStoragePath(path);
  return { mimetype, filename, url };
}

export async function loadWhatsappNewsChannelCreateDefaults(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WhatsappNewsChannelCreateDefaults | { error: string }> {
  const { data } = await admin
    .from("restaurants")
    .select("name, avatar_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!data) return { error: "restaurant_not_found" };

  const name = ((data as { name: string }).name ?? "").trim() || "News";
  const hasAvatar = Boolean(
    (data as { avatar_storage_path: string | null }).avatar_storage_path?.trim(),
  );

  return {
    name,
    descriptionSuggestion: "",
    hasAvatar,
  };
}

export async function createWhatsappNewsChannelForRestaurant(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    name: string;
    description?: string | null;
    includeLogo?: boolean;
  },
): Promise<
  | {
      ok: true;
      channel: WahaChannel;
      whatsappChannelIds: string[];
    }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  if (!(await isWhatsappSessionWorking(params.restaurantId))) {
    return { ok: false, error: "whatsapp_not_connected" };
  }

  const existing = await listWahaChannelsForRestaurant(params.restaurantId, {
    role: "OWNER",
  });
  if ("error" in existing) {
    return { ok: false, error: existing.error };
  }
  if (existing.channels.length > 0) {
    return { ok: false, error: "owner_channel_exists" };
  }

  const name = params.name.trim();
  if (!name || name.length > 120) {
    return { ok: false, error: "invalid_channel_name" };
  }

  const description = params.description?.trim() ?? "";
  if (description.length > 500) {
    return { ok: false, error: "invalid_channel_description" };
  }

  let picture: { mimetype: string; filename: string; url: string } | null = null;
  if (params.includeLogo !== false) {
    picture = await resolveRestaurantAvatarPictureForWaha(
      admin,
      params.restaurantId,
    );
  }

  const created = await createWahaChannelForRestaurant(params.restaurantId, {
    name,
    description: description || null,
    picture,
  });
  if ("error" in created) {
    return { ok: false, error: created.error };
  }

  const channelId = created.channel.id.trim();
  const whatsappChannelIds = [channelId];

  const { error: upsertErr } = await sb.from("restaurant_news_settings").upsert(
    {
      restaurant_id: params.restaurantId,
      whatsapp_channel_ids: whatsappChannelIds,
      whatsapp_channel_id: channelId,
    },
    { onConflict: "restaurant_id" },
  );
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  await revalidatePublicNewsEmbedForRestaurant(sb, params.restaurantId);
  after(() => {
    void syncRestaurantNewsPlatformAfterPublish(
      params.restaurantId,
      "whatsapp_channel",
    );
  });

  return {
    ok: true,
    channel: created.channel,
    whatsappChannelIds,
  };
}
