import "server-only";

import {
  FEED_PIN_MODULE_TABLES,
  feedPinTargetFromItem,
  type FeedPinModule,
  type FeedPinTarget,
} from "@/lib/feed-pin/feed-pin-types";
import { revalidateFeedPinModule } from "@/lib/feed-pin/revalidate-feed-pin-module";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

async function clearModulePins(
  admin: SupabaseClient,
  restaurantId: string,
  module: FeedPinModule,
): Promise<void> {
  const { gwadaTable, cacheTable } = FEED_PIN_MODULE_TABLES[module];

  const [gwadaResult, cacheResult] = await Promise.all([
    admin
      .from(gwadaTable)
      .update({ is_pinned: false })
      .eq("restaurant_id", restaurantId)
      .eq("is_pinned", true),
    admin
      .from(cacheTable)
      .update({ is_pinned: false })
      .eq("restaurant_id", restaurantId)
      .eq("is_pinned", true),
  ]);

  if (gwadaResult.error) {
    throw new Error(gwadaResult.error.message);
  }
  if (cacheResult.error) {
    throw new Error(cacheResult.error.message);
  }
}

async function setPinOnTarget(
  admin: SupabaseClient,
  restaurantId: string,
  module: FeedPinModule,
  target: FeedPinTarget,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { gwadaTable, cacheTable } = FEED_PIN_MODULE_TABLES[module];

  if (target.source === "gwada") {
    const { data, error } = await admin
      .from(gwadaTable)
      .update({ is_pinned: true })
      .eq("restaurant_id", restaurantId)
      .eq("id", target.rowId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "not_found" };
    return { ok: true };
  }

  const { data, error } = await admin
    .from(cacheTable)
    .update({ is_pinned: true })
    .eq("restaurant_id", restaurantId)
    .eq("platform", target.platform)
    .eq("external_id", target.externalId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function setFeedItemPinned(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    module: FeedPinModule;
    pinned: boolean;
    platform: string;
    itemId: string;
  },
): Promise<{ ok: true; isPinned: boolean } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  try {
    await clearModulePins(admin, params.restaurantId, params.module);

    if (!params.pinned) {
      await revalidateFeedPinModule(sb, params.restaurantId, params.module);
      return { ok: true, isPinned: false };
    }

    const target = feedPinTargetFromItem({
      platform: params.platform,
      itemId: params.itemId,
    });

    const setResult = await setPinOnTarget(
      admin,
      params.restaurantId,
      params.module,
      target,
    );
    if (!setResult.ok) return setResult;

    await revalidateFeedPinModule(sb, params.restaurantId, params.module);
    return { ok: true, isPinned: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "pin_failed";
    return { ok: false, error: message };
  }
}
