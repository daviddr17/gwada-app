import { enforcePublicApiWriteRateLimit } from "@/lib/api/public-api-rate-limit";
import { loadReservationCalendarFile } from "@/lib/reservations/reservation-calendar-server";
import { loadPublicReservationForManage } from "@/lib/reservations/public-reservation-server";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    reservation_number?: number;
    pin?: string;
  };

  const slug = normalizeRestaurantSlugInput(body.slug?.trim() ?? "");
  const rateLimited = enforcePublicApiWriteRateLimit(req, slug || undefined);
  if (rateLimited) return rateLimited;

  const reservationNumber = Number(body.reservation_number);
  const pin = body.pin?.trim() ?? "";
  if (!slug || !Number.isFinite(reservationNumber) || !pin) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const loaded = await loadPublicReservationForManage(slug, reservationNumber, pin);
  if (!loaded.data) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }
  if (loaded.data.status_code !== "confirmed") {
    return Response.json({ error: "not_confirmed" }, { status: 409 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const file = await loadReservationCalendarFile(admin, loaded.data.id);
  if (!file) {
    return Response.json({ error: "not_confirmed" }, { status: 409 });
  }

  return new Response(file.content, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
