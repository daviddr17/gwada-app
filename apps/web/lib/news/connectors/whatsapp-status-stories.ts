import "server-only";

import { assertPlatformWhatsappEnabled } from "@/lib/integrations/platform-messaging-guard";
import { readCachedNewsStorySlides } from "@/lib/news/news-stories-cache-db";
import { upsertNewsStoriesPlatformCache } from "@/lib/news/news-stories-cache-db";
import type { UnifiedNewsStorySlide } from "@/lib/news/unified-news-story";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { wahaSendStatusMedia } from "@/lib/whatsapp/waha-send-status";
import type { SupabaseClient } from "@supabase/supabase-js";

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export async function isRestaurantWhatsappStatusConnected(
  restaurantId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const waPlatform = await assertPlatformWhatsappEnabled(admin);
  if (!waPlatform.ok) return false;
  const { data } = await admin
    .from("restaurant_integrations")
    .select("status")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", "whatsapp")
    .maybeSingle();
  return data?.status === "working";
}

function stillActive(slide: UnifiedNewsStorySlide, nowMs: number): boolean {
  if (!slide.expiresAt) return true;
  const exp = Date.parse(slide.expiresAt);
  return Number.isFinite(exp) ? exp > nowMs : true;
}

/** Cache pflegen: abgelaufene Status-Slides entfernen (kein Remote-List-API). */
export async function syncWhatsappStatusStoriesCache(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: true; slides: UnifiedNewsStorySlide[] }> {
  const now = Date.now();
  const syncedAt = new Date(now).toISOString();
  const cached = await readCachedNewsStorySlides(admin, restaurantId);
  const active = cached.filter(
    (s) => s.platform === "whatsapp_status" && stillActive(s, now),
  );
  await upsertNewsStoriesPlatformCache(
    admin,
    restaurantId,
    "whatsapp_status",
    active,
    syncedAt,
    null,
  );
  return { ok: true, slides: active };
}

export async function publishWhatsappStatusStory(
  restaurantId: string,
  input: { imageUrl?: string; videoUrl?: string; caption?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind = input.videoUrl ? "video" : "image";
  const mediaUrl = (input.videoUrl ?? input.imageUrl)?.trim();
  if (!mediaUrl) return { ok: false, error: "media_required" };

  const sent = await wahaSendStatusMedia({
    restaurantId,
    kind,
    mediaUrl,
    caption: input.caption ?? undefined,
  });
  if (!sent.ok) return sent;

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: true };

  const now = Date.now();
  const publishedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + STATUS_TTL_MS).toISOString();
  const externalId = `status:${now}`;
  const newSlide: UnifiedNewsStorySlide = {
    id: `whatsapp_status:${externalId}`,
    platform: "whatsapp_status",
    kind,
    url: mediaUrl,
    caption: input.caption?.trim() || null,
    externalUrl: null,
    publishedAt,
    expiresAt,
  };

  const cached = await readCachedNewsStorySlides(admin, restaurantId);
  const kept = cached.filter(
    (s) => s.platform === "whatsapp_status" && stillActive(s, now),
  );
  await upsertNewsStoriesPlatformCache(
    admin,
    restaurantId,
    "whatsapp_status",
    [...kept, newSlide],
    publishedAt,
    null,
  );

  return { ok: true };
}
