import "server-only";

import { fetchFacebookPagePlatformInsights } from "@/lib/insights/facebook-page-platform-insights";
import { fetchGoogleBusinessPlatformInsights } from "@/lib/insights/google-business-platform-insights";
import { fetchInstagramAccountPlatformInsights } from "@/lib/insights/instagram-account-platform-insights";
import {
  emptyFacebookInsights,
  emptyGoogleInsights,
  emptyInstagramInsights,
  type PlatformInsightsBundle,
} from "@/lib/insights/platform-insights-types";
import type { PlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";

/** Meta Account-Insights: max. ~28 Tage sinnvoll anfragen. */
function clampRangeForMeta(
  startYmd: string,
  endYmd: string,
): { startYmd: string; endYmd: string } {
  const end = new Date(`${endYmd}T12:00:00`);
  const start = new Date(`${startYmd}T12:00:00`);
  const minStart = new Date(end);
  minStart.setDate(minStart.getDate() - 28);
  const effective = start < minStart ? minStart : start;
  const y = effective.getFullYear();
  const m = String(effective.getMonth() + 1).padStart(2, "0");
  const d = String(effective.getDate()).padStart(2, "0");
  return { startYmd: `${y}-${m}-${d}`, endYmd };
}

export async function fetchPlatformInsightsBundle(params: {
  restaurantId: string;
  startYmd: string;
  endYmd: string;
  flags: PlatformMessagingFlags;
}): Promise<PlatformInsightsBundle> {
  const metaRange = clampRangeForMeta(params.startYmd, params.endYmd);

  const [google, facebook, instagram] = await Promise.all([
    params.flags.googleBusinessEnabled
      ? fetchGoogleBusinessPlatformInsights({
          restaurantId: params.restaurantId,
          startYmd: params.startYmd,
          endYmd: params.endYmd,
        })
      : Promise.resolve(emptyGoogleInsights()),
    params.flags.facebookEnabled
      ? fetchFacebookPagePlatformInsights({
          restaurantId: params.restaurantId,
          startYmd: metaRange.startYmd,
          endYmd: metaRange.endYmd,
        })
      : Promise.resolve(emptyFacebookInsights()),
    params.flags.instagramEnabled
      ? fetchInstagramAccountPlatformInsights({
          restaurantId: params.restaurantId,
          startYmd: metaRange.startYmd,
          endYmd: metaRange.endYmd,
        })
      : Promise.resolve(emptyInstagramInsights()),
  ]);

  return { google, facebook, instagram };
}
