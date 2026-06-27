import {
  loadPlatformBrandingAsset,
  platformBrandingAssetResponse,
} from "@/lib/platform/platform-branding-asset-server";
import { isAllowedPlatformBrandingStoragePath } from "@/lib/supabase/platform-branding-public-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const storagePath = new URL(request.url).searchParams.get("v")?.trim() ?? "";

  if (!isAllowedPlatformBrandingStoragePath(storagePath)) {
    return new Response(null, { status: 404 });
  }

  const asset = await loadPlatformBrandingAsset(storagePath);
  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return platformBrandingAssetResponse(asset, request);
}
