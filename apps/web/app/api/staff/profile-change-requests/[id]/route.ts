import { NextResponse } from "next/server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { reviewStaffProfileChangeRequest } from "@/lib/staff/staff-profile-change-request-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: requestId } = await params;

  let body: {
    restaurant_id?: string;
    decision?: "approve" | "decline";
    review_note?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurant_id?.trim();
  const decision = body.decision;
  if (!restaurantId || (decision !== "approve" && decision !== "decline")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await reviewStaffProfileChangeRequest(admin, {
    restaurantId,
    requestId,
    actorUserId: auth.userId,
    decision,
    reviewNote: body.review_note ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: result.request.id,
      status: result.request.status,
      review_note: result.request.review_note,
    },
  });
}
