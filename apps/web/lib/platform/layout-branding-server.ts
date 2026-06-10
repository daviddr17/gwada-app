import "server-only";

import {
  DEFAULT_PLATFORM_APP_BRANDING,
  fetchPlatformAppBranding,
  type PlatformAppBranding,
} from "@/lib/supabase/platform-app-settings-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BRANDING_FETCH_TIMEOUT_MS = 2_500;

export async function loadRootLayoutBranding(): Promise<PlatformAppBranding> {
  try {
    const sb = await createSupabaseServerClient();
    return await Promise.race([
      fetchPlatformAppBranding(sb),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("branding_fetch_timeout")),
          BRANDING_FETCH_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    return DEFAULT_PLATFORM_APP_BRANDING;
  }
}
