import "server-only";

import {
  DEFAULT_PLATFORM_APP_BRANDING,
  fetchPlatformAppBranding,
  type PlatformAppBranding,
} from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loadRootLayoutBranding(): Promise<PlatformAppBranding> {
  try {
    const sb = await createSupabaseServerClient();
    return await fetchPlatformAppBranding(sb);
  } catch {
    return DEFAULT_PLATFORM_APP_BRANDING;
  }
}
