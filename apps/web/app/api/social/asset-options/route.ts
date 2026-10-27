import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import {
  listSocialAssetOptions,
  type SocialAssetOptionGroup,
} from "@/lib/social/social-asset-options-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GROUPS = new Set<SocialAssetOptionGroup>([
  "gallery",
  "menu",
  "profile",
  "event",
  "all",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const groupRaw = url.searchParams.get("group")?.trim() ?? "all";
  const group = GROUPS.has(groupRaw as SocialAssetOptionGroup)
    ? (groupRaw as SocialAssetOptionGroup)
    : "all";

  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const options = await listSocialAssetOptions(admin, restaurantId, { group });
  return Response.json({ options });
}
