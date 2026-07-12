import { NextResponse } from "next/server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { listPendingStaffInvitesForRestaurant } from "@/lib/staff/staff-pending-invites-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurant_id")?.trim() ?? "";
  const auth = await authorizeStaffRestaurant(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const invites = await listPendingStaffInvitesForRestaurant(admin, restaurantId);
  return NextResponse.json({ invites });
}
