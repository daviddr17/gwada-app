import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayStaffProfile } from "@/lib/display/display-profile-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "profile");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const profile = await loadDisplayStaffProfile(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
  });

  if (!profile) {
    return NextResponse.json({ error: "staff_not_found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
