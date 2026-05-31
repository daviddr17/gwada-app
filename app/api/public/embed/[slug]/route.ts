import { fetchPublicEmbedRestaurant, publicCountries } from "@/lib/reservations/public-reservation-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
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
