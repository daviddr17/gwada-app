import { enforcePublicApiReadRateLimit } from "@/lib/api/public-api-rate-limit";
import { fetchPublicEmbedRestaurant, publicCountries } from "@/lib/reservations/public-reservation-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = normalizeRestaurantSlugInput(rawSlug);

  const rateLimited = enforcePublicApiReadRateLimit(req, slug || undefined);
  if (rateLimited) return rateLimited;

  const result = await fetchPublicEmbedRestaurant(slug);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const { id: _id, ...publicConfig } = result.data;
  return Response.json({
    restaurant: publicConfig,
    countries: publicCountries(),
  });
}
