import {
  listPublicHolidaysInRange,
  publicHolidaysByDate,
  resolveRestaurantCountryIso2,
} from "@/lib/holidays/public-holidays-server";
import { authorizeRestaurantMemberRoute } from "@/lib/auth/restaurant-member-route";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";

  const auth = await authorizeRestaurantMemberRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return Response.json({ error: "invalid_range" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select("country")
    .eq("id", auth.restaurantId)
    .maybeSingle();

  if (error || !row) {
    return Response.json({ error: "restaurant_not_found" }, { status: 404 });
  }

  const country = String(row.country ?? "").trim() || "Deutschland";
  const holidays = await listPublicHolidaysInRange(country, from, to);

  return Response.json({
    ok: true,
    countryIso2: resolveRestaurantCountryIso2(country),
    byDate: publicHolidaysByDate(holidays),
    holidays,
  });
}
