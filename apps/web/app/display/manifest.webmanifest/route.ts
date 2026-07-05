import { buildDisplayPwaManifest } from "@/lib/display/build-display-pwa-manifest";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const branding = await getCachedRootLayoutBranding();
  const manifest = buildDisplayPwaManifest(branding);

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
