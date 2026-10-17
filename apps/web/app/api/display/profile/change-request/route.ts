import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  acknowledgeStaffProfileChangeResolutions,
  createStaffProfileChangeRequest,
  findPendingStaffProfileChangeRequest,
  listUnacknowledgedStaffProfileChangeResolutions,
  sanitizeProposedStaffProfileFields,
} from "@/lib/staff/staff-profile-change-request-server";
import { buildStaffProfileChangeDiff } from "@/lib/staff/staff-profile-change-request-types";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "profile");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const [pending, resolutions] = await Promise.all([
    findPendingStaffProfileChangeRequest(admin, access.staffId),
    listUnacknowledgedStaffProfileChangeResolutions(admin, access.staffId),
  ]);

  return NextResponse.json({
    pending_request: pending
      ? {
          id: pending.id,
          previous_fields: pending.previous_fields,
          proposed_fields: pending.proposed_fields,
          created_at: pending.created_at,
          diff: buildStaffProfileChangeDiff(
            pending.previous_fields,
            pending.proposed_fields,
          ),
        }
      : null,
    unacknowledged_resolutions: resolutions.map((row) => ({
      id: row.id,
      status: row.status,
      review_note: row.review_note,
      reviewed_at: row.reviewed_at,
      proposed_fields: row.proposed_fields,
    })),
  });
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "profile");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { fields?: unknown };
  try {
    body = (await request.json()) as { fields?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = sanitizeProposedStaffProfileFields(body.fields);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createStaffProfileChangeRequest(admin, {
    restaurantId: access.restaurantId,
    staffId: access.staffId,
    proposed: parsed.fields,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: result.request.id,
      previous_fields: result.request.previous_fields,
      proposed_fields: result.request.proposed_fields,
      created_at: result.request.created_at,
      diff: buildStaffProfileChangeDiff(
        result.request.previous_fields,
        result.request.proposed_fields,
      ),
    },
  });
}

export async function PATCH(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "profile");
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

  await acknowledgeStaffProfileChangeResolutions(admin, {
    staffId: access.staffId,
    requestIds: ids,
  });

  return NextResponse.json({ ok: true });
}
