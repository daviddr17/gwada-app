import { enforcePublicApiWriteRateLimit } from "@/lib/api/public-api-rate-limit";
import { publicProfileContactErrorMessage } from "@/lib/contacts/public-profile-contact-errors";
import {
  submitPublicProfileContact,
  type PublicProfileContactBody,
} from "@/lib/contacts/public-profile-contact-server";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = normalizeRestaurantSlugInput(rawSlug);

  if (!slug || isReservedRestaurantSlug(slug)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const rateLimited = enforcePublicApiWriteRateLimit(req, slug);
  if (rateLimited) return rateLimited;

  const body = (await req.json().catch(() => ({}))) as PublicProfileContactBody;
  const result = await submitPublicProfileContact(slug, body);

  if (!result.data) {
    return Response.json(
      {
        error: result.error,
        message: publicProfileContactErrorMessage(result.error),
      },
      { status: result.status },
    );
  }

  return Response.json(result.data);
}
