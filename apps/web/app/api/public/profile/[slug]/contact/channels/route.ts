import { fetchPublicProfileContactChannels } from "@/lib/contacts/public-profile-contact-channels-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = normalizeRestaurantSlugInput(rawSlug);

  if (!slug || isReservedRestaurantSlug(slug)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const result = await fetchPublicProfileContactChannels(slug);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(result.data);
}
