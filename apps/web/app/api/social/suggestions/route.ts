import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { generateSocialSuggestionsForRestaurant } from "@/lib/social/social-suggestion-generate-server";
import {
  listOpenSocialTasksFromDb,
  listSocialSuggestionsFromDb,
} from "@/lib/social/social-suggestions-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const refresh = url.searchParams.get("refresh") === "1";

  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const generation = await generateSocialSuggestionsForRestaurant(
    admin,
    restaurantId,
    { force: refresh },
  );

  const [suggestions, tasks] = await Promise.all([
    listSocialSuggestionsFromDb(admin, restaurantId, {
      statuses: ["pending", "needs_asset", "approved"],
      limit: 40,
    }),
    listOpenSocialTasksFromDb(admin, restaurantId),
  ]);

  return Response.json({
    suggestions,
    tasks,
    generation,
  });
}
