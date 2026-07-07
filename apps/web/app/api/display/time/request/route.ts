import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  acknowledgeDisplayTimeRequestResolutions,
  createDisplayTimeRequest,
  listPendingDisplayTimeRequestsForStaff,
  listUnacknowledgedDisplayTimeResolutions,
  loadRestaurantTimezone,
  parseDisplayTimeRequestRange,
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

  const [pendingRows, resolutions] = await Promise.all([
    listPendingDisplayTimeRequestsForStaff(admin, access.staffId),
    listUnacknowledgedDisplayTimeResolutions(admin, access.staffId),
  ]);

  return NextResponse.json({
    pending_requests: pendingRows.map((row) => ({
      id: row.id,
      entry_type: row.entry_type,
      requested_starts_at: row.requested_starts_at,
      requested_ends_at: row.requested_ends_at,
      created_at: row.created_at,
    })),
    unacknowledged_resolutions: resolutions.map((row) => ({
      id: row.id,
      status: row.status,
      entry_type: row.entry_type,
      requested_starts_at: row.requested_starts_at,
      requested_ends_at: row.requested_ends_at,
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

  let body: {
    date?: string;
    start_time?: string;
    end_time?: string;
    entry_type?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const dateYmd = body.date?.trim();
  const startTime = body.start_time?.trim();
  const endTime = body.end_time?.trim();
  const entryType = body.entry_type?.trim();
  if (!dateYmd || !startTime || !endTime || !entryType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const timeZone = await loadRestaurantTimezone(admin, access.restaurantId);
  const parsed = parseDisplayTimeRequestRange(
    {
      dateYmd,
      startTime,
      endTime,
      entryType,
    },
    new Date(),
    timeZone,
  );
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createDisplayTimeRequest(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
    entryType: parsed.entryType,
    requestedStartsAt: parsed.startsAt,
    requestedEndsAt: parsed.endsAt,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: result.request.id,
      entry_type: result.request.entry_type,
      requested_starts_at: result.request.requested_starts_at,
      requested_ends_at: result.request.requested_ends_at,
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
