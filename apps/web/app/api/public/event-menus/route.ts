import { listActiveEventMenusPublic } from "@/lib/events/event-menus-server";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = normalizeRestaurantSlugInput(
    new URL(req.url).searchParams.get("slug") ?? "",
  );
  if (!slug) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const restaurantRes = await fetchPublicEmbedRestaurant(slug);
  if (restaurantRes.error || !restaurantRes.data) {
    return Response.json(
      { error: restaurantRes.error ?? "not_found" },
      { status: restaurantRes.status ?? 404 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const menus = await listActiveEventMenusPublic(admin, restaurantRes.data.id);
  return Response.json({ menus });
}
