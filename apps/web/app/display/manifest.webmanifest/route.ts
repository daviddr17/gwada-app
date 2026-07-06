import { buildDisplayPwaManifest } from "@/lib/display/build-display-pwa-manifest";
import { normalizeDisplayPwaRestaurantSlug } from "@/lib/display/display-pwa-config";
import { getCachedRootLayoutBranding } from "@/lib/platform/cached-layout-branding";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadRestaurantNameForManifest(slug: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurants")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  return typeof data?.name === "string" ? data.name : null;
}

export async function GET(request: Request) {
  const branding = await getCachedRootLayoutBranding();
  const slugParam = new URL(request.url).searchParams.get("slug");
  const slug = normalizeDisplayPwaRestaurantSlug(slugParam);
  const restaurantName = slug ? await loadRestaurantNameForManifest(slug) : null;
  const manifest = buildDisplayPwaManifest(branding, {
    slug,
    restaurantName,
  });

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
