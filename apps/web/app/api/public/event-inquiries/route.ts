import { enforcePublicApiWriteRateLimit } from "@/lib/api/public-api-rate-limit";
import {
  createPublicEventInquiry,
  type PublicEventInquiryCreateBody,
} from "@/lib/events/public-event-inquiry-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PublicEventInquiryCreateBody;
  const slug = normalizeRestaurantSlugInput(body.slug ?? "");

  const rateLimited = enforcePublicApiWriteRateLimit(req, slug || undefined);
  if (rateLimited) return rateLimited;

  const result = await createPublicEventInquiry(body);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
