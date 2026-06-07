import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";
import { fetchPublicEmbedReviews } from "@/lib/reviews/public-reviews-server";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

const MODULES = ["reservation", "menu", "reviews"] as const;
type ProfileModule = (typeof MODULES)[number];

function isProfileModule(value: string): value is ProfileModule {
  return (MODULES as readonly string[]).includes(value);
}

const CACHE_HEADER = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; module: string }> },
) {
  const { slug: rawSlug, module: rawModule } = await ctx.params;
  const slug = normalizeRestaurantSlugInput(rawSlug);

  if (!slug || isReservedRestaurantSlug(slug)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (!isProfileModule(rawModule)) {
    return Response.json({ error: "invalid_module" }, { status: 400 });
  }

  if (rawModule === "reservation") {
    const result = await fetchPublicEmbedRestaurant(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(result.data, { headers: { "Cache-Control": CACHE_HEADER } });
  }

  if (rawModule === "menu") {
    const result = await fetchPublicEmbedMenu(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(result.data, { headers: { "Cache-Control": CACHE_HEADER } });
  }

  const result = await fetchPublicEmbedReviews(slug);
  if (!result.data) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(result.data, { headers: { "Cache-Control": CACHE_HEADER } });
}
