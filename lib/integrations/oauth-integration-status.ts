import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";

export async function oauthPlatformEnabledForProvider(
  sb: SupabaseClient,
  provider: "facebook" | "instagram" | "google_business",
): Promise<boolean> {
  const flags = await fetchPlatformMessagingFlags(sb);
  switch (provider) {
    case "facebook":
      return flags.facebookEnabled;
    case "instagram":
      return flags.instagramEnabled;
    case "google_business":
      return flags.googleBusinessEnabled;
  }
}
