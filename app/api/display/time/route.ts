import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  getStaffDisplayTimeState,
  runDisplayTimeAction,
} from "@/lib/staff/staff-display-time-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TimeAction = "clock_in" | "start_break" | "end_break" | "clock_out";

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { action?: TimeAction };
  try {
    body = (await request.json()) as { action?: TimeAction };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await runDisplayTimeAction(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
    action,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, status: result.state.status });
}

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const state = await getStaffDisplayTimeState(admin, access.staffId);
  return NextResponse.json(state);
}
