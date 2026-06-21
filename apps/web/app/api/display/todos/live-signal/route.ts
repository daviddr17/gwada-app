import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplaySessionAccess } from "@/lib/display/display-auth-server";
import { loadDisplayTodosLiveSignal } from "@/lib/staff/staff-display-todos-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplaySessionAccess(cookieStore);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const signal = await loadDisplayTodosLiveSignal(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
  });
  return NextResponse.json(signal);
}
