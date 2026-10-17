import { NextResponse } from "next/server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { listPendingStaffProfileChangeRequestsForRestaurant } from "@/lib/staff/staff-profile-change-request-server";
import { buildStaffProfileChangeDiff } from "@/lib/staff/staff-profile-change-request-types";
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

  const rows = await listPendingStaffProfileChangeRequestsForRestaurant(
    admin,
    restaurantId,
  );

  const requests = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      staff_id: row.staff_id,
      previous_fields: row.previous_fields,
      proposed_fields: row.proposed_fields,
      created_at: row.created_at,
      diff: buildStaffProfileChangeDiff(
        row.previous_fields,
        row.proposed_fields,
      ),
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
