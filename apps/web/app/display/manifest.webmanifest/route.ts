import { buildDisplayPwaManifest } from "@/lib/display/build-display-pwa-manifest";
import { normalizeDisplayPwaRestaurantSlug } from "@/lib/display/display-pwa-config";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const branding = await getCachedRootLayoutBranding();
  const slugParam = new URL(request.url).searchParams.get("slug");
  const slug = normalizeDisplayPwaRestaurantSlug(slugParam);
  const manifest = buildDisplayPwaManifest(branding, { slug });

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
