import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  fetchPlatformMessagingFlags,
  type PlatformMessagingFlags,
} from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isReviewPlatformEnabledBySuperadmin(
  platform: ReviewPlatform,
  flags: PlatformMessagingFlags,
): boolean {
  if (platform === "gwada") return true;
  if (platform === "google") return flags.googleBusinessEnabled;
  if (platform === "facebook") return flags.facebookEnabled;
  if (platform === "tripadvisor") return flags.tripadvisorEnabled;
  return false;
}

export function isReviewPlatformVisibleInDashboard(
  platform: ReviewPlatform,
  params: {
    flags: PlatformMessagingFlags;
    googleConnected: boolean;
    facebookConnected: boolean;
    tripadvisorConnected: boolean;
  },
): boolean {
  if (platform === "gwada") return true;
  if (!isReviewPlatformEnabledBySuperadmin(platform, params.flags)) {
    return false;
  }
  if (platform === "google") return params.googleConnected;
  if (platform === "facebook") return params.facebookConnected;
  if (platform === "tripadvisor") return params.tripadvisorConnected;
  return false;
}

export async function fetchReviewPlatformMessagingFlags(
  sb: SupabaseClient,
): Promise<PlatformMessagingFlags> {
  return fetchPlatformMessagingFlags(sb);
}
