import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  acknowledgeDisplayTimeRequestResolutions,
  createDisplayTimeRequest,
  findPendingDisplayTimeRequest,
  listUnacknowledgedDisplayTimeResolutions,
  loadRestaurantTimezone,
  parseDisplayTimeRequestLocalTime,
} from "@/lib/staff/staff-display-time-request-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const [pending, resolutions] = await Promise.all([
    findPendingDisplayTimeRequest(admin, access.staffId),
    listUnacknowledgedDisplayTimeResolutions(admin, access.staffId),
  ]);

  return NextResponse.json({
    pending_request: pending
      ? {
          id: pending.id,
          requested_starts_at: pending.requested_starts_at,
          created_at: pending.created_at,
        }
      : null,
    unacknowledged_resolutions: resolutions.map((row) => ({
      id: row.id,
      status: row.status,
      requested_starts_at: row.requested_starts_at,
      reviewed_at: row.reviewed_at,
    })),
  });
}

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

  let body: { time?: string };
  try {
    body = (await request.json()) as { time?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const timeValue = body.time?.trim();
  if (!timeValue) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const timeZone = await loadRestaurantTimezone(admin, access.restaurantId);
  const parsed = parseDisplayTimeRequestLocalTime(timeValue, new Date(), timeZone);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createDisplayTimeRequest(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
    requestedStartsAt: parsed.iso,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: result.request.id,
      requested_starts_at: result.request.requested_starts_at,
    },
  });
}

export async function PATCH(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { request_ids?: string[] };
  try {
    body = (await request.json()) as { request_ids?: string[] };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ids = Array.isArray(body.request_ids)
    ? body.request_ids.filter((id) => typeof id === "string" && id.length > 0)
    : [];

  await acknowledgeDisplayTimeRequestResolutions(admin, {
    staffId: access.staffId,
    requestIds: ids,
  });

  return NextResponse.json({ ok: true });
}
