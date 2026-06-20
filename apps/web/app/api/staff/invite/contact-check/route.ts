import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { resolveStaffInviteContactConflicts } from "@/lib/staff/staff-invite-contact-conflict-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const staffId = url.searchParams.get("staffId")?.trim() ?? "";
  const email = url.searchParams.get("email");
  const phone = url.searchParams.get("phone");

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(staffId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: staff } = await userSb
    .from("restaurant_staff")
    .select("id, profile_id")
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!staff) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (staff.profile_id) {
    return Response.json({
      emailConflict: null,
      phoneConflict: null,
    });
  }

  const result = await resolveStaffInviteContactConflicts(userSb, {
    restaurantId,
    staffId,
    email,
    phone,
  });

  return Response.json(result);
}
