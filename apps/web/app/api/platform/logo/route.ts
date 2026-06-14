import {
  loadPlatformMarketingLogoAsset,
  platformMarketingLogoResponse,
} from "@/lib/platform/platform-marketing-logo-server";
import { isAllowedPlatformLogoStoragePath } from "@/lib/platform/platform-marketing-logo-url";
import type { PlatformLogoTheme } from "@/lib/platform/resolve-platform-logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseTheme(value: string | null): PlatformLogoTheme {
  return value === "dark" ? "dark" : "light";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storagePath = url.searchParams.get("v")?.trim() ?? "";
  const theme = parseTheme(url.searchParams.get("theme"));

  if (!isAllowedPlatformLogoStoragePath(storagePath)) {
    return new Response(null, { status: 404 });
  }

  const asset = await loadPlatformMarketingLogoAsset({ storagePath, theme });
  if (!asset) {
    return new Response(null, { status: 404 });
  }

  return platformMarketingLogoResponse(asset, request);
}
