import { NextResponse } from "next/server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { listPendingDisplayTimeRequestsForRestaurant } from "@/lib/staff/staff-display-time-request-server";
import { signStaffAvatarUrl } from "@/lib/display/display-storage-urls";
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

  const rows = await listPendingDisplayTimeRequestsForRestaurant(
    admin,
    restaurantId,
  );

  const requests = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      staff_id: row.staff_id,
      entry_type: row.entry_type,
      requested_starts_at: row.requested_starts_at,
      requested_ends_at: row.requested_ends_at,
      created_at: row.created_at,
      staff: {
        given_name: row.staff.given_name,
        family_name: row.staff.family_name,
        avatar_url: await signStaffAvatarUrl(
          admin,
          row.staff.avatar_storage_path,
        ),
      },
    })),
  );

  return NextResponse.json({ requests });
}
