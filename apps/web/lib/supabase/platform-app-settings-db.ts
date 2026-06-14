import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SIDEBAR_MODULE_ORDER,
  normalizeSidebarModuleOrder,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import {
  DEFAULT_PLATFORM_APP_NAME,
  type PlatformAppBranding,
} from "@/lib/types/platform-app-settings";
import { platformBrandingPublicObjectUrl } from "@/lib/supabase/platform-branding-public-url";
import { withBrandingAssetCacheBust } from "@/lib/platform/branding-asset-url";

export { DEFAULT_PLATFORM_APP_NAME, type PlatformAppBranding };

type SettingsRow = {
  app_name: string;
  logo_path: string | null;
  logo_dark_path: string | null;
  favicon_path: string | null;
  sidebar_module_order: unknown;
};

function rowToBranding(row: SettingsRow): PlatformAppBranding {
  const appName = row.app_name?.trim() || DEFAULT_PLATFORM_APP_NAME;
  const logoPath = row.logo_path;
  const logoDarkPath = row.logo_dark_path;
  const faviconPath = row.favicon_path;
  const logoUrl = platformBrandingPublicObjectUrl(logoPath);
  const logoDarkUrl = platformBrandingPublicObjectUrl(logoDarkPath);
  const faviconUrl = platformBrandingPublicObjectUrl(faviconPath);
  return {
    appName,
    logoPath,
    logoDarkPath,
    faviconPath,
    logoUrl: withBrandingAssetCacheBust(logoUrl, logoPath),
    logoDarkUrl: withBrandingAssetCacheBust(logoDarkUrl, logoDarkPath),
    faviconUrl: withBrandingAssetCacheBust(faviconUrl, faviconPath),
  };
}

export const DEFAULT_PLATFORM_APP_BRANDING: PlatformAppBranding = {
  appName: DEFAULT_PLATFORM_APP_NAME,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  logoPath: null,
  logoDarkPath: null,
  faviconPath: null,
};

export async function fetchPlatformAppBranding(
  client: SupabaseClient,
): Promise<PlatformAppBranding> {
  const { data, error } = await client
    .from("platform_app_settings")
    .select("app_name, logo_path, logo_dark_path, favicon_path")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_PLATFORM_APP_BRANDING;
  }

  return rowToBranding(data as SettingsRow);
}

export async function fetchSidebarModuleOrder(
  client: SupabaseClient,
): Promise<SidebarModuleId[]> {
  const { data, error } = await client
    .from("platform_app_settings")
    .select("sidebar_module_order")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return [...DEFAULT_SIDEBAR_MODULE_ORDER];
  }

  return normalizeSidebarModuleOrder(
    (data as Pick<SettingsRow, "sidebar_module_order">).sidebar_module_order,
  );
}

export async function updateSidebarModuleOrder(
  admin: SupabaseClient,
  order: SidebarModuleId[],
): Promise<{ error: string | null }> {
  const normalized = normalizeSidebarModuleOrder(order);
  const { error } = await admin
    .from("platform_app_settings")
    .update({ sidebar_module_order: normalized })
    .eq("id", "default");

  return { error: error?.message ?? null };
}

export async function updatePlatformAppName(
  admin: SupabaseClient,
  appName: string,
): Promise<{ error: string | null }> {
  const name = appName.trim();
  if (!name || name.length > 80) {
    return { error: "invalid_app_name" };
  }

  const { error } = await admin
    .from("platform_app_settings")
    .update({ app_name: name })
    .eq("id", "default");

  return { error: error?.message ?? null };
}

export async function updatePlatformBrandingAssetPath(
  admin: SupabaseClient,
  field: "logo_path" | "logo_dark_path" | "favicon_path",
  path: string | null,
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("platform_app_settings")
    .update({ [field]: path })
    .eq("id", "default");

  return { error: error?.message ?? null };
}
