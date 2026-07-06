import { enforcePublicApiWriteRateLimit } from "@/lib/api/public-api-rate-limit";
import {
  createPublicReservation,
  type PublicReservationCreateBody,
} from "@/lib/reservations/public-reservation-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PublicReservationCreateBody;
  const slug = normalizeRestaurantSlugInput(body.slug ?? "");

  const rateLimited = enforcePublicApiWriteRateLimit(req, slug || undefined);
  if (rateLimited) return rateLimited;

  const result = await createPublicReservation(body);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
