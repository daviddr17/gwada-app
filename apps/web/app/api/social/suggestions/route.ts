import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { resolveSocialSuggestionImageUrl } from "@/lib/social/social-asset-resolve-server";
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

  const [rawSuggestions, tasks] = await Promise.all([
    listSocialSuggestionsFromDb(admin, restaurantId, {
      statuses: ["pending", "needs_asset", "approved"],
      limit: 40,
    }),
    listOpenSocialTasksFromDb(admin, restaurantId),
  ]);

  // Signierte URLs immer frisch — gespeicherte Preview-URLs laufen ab.
  const suggestions = await Promise.all(
    rawSuggestions.map(async (s) => {
      const imageUrl = await resolveSocialSuggestionImageUrl(
        admin,
        restaurantId,
        s.asset,
      );
      return {
        ...s,
        asset: { ...s.asset, imageUrl },
      };
    }),
  );

  return Response.json({
    suggestions,
    tasks,
    generation,
  });
}
