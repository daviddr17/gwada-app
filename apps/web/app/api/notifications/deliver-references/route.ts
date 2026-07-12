import { NextResponse } from "next/server";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    restaurantId?: string;
    module?: string;
    referenceIds?: string[];
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const module = body.module?.trim() ?? "";
  const referenceIds = Array.isArray(body.referenceIds)
    ? body.referenceIds.filter((id) => typeof id === "string" && id.trim())
    : [];

  if (!restaurantId || !module || referenceIds.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: employee } = await sb
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  await scheduleDeliverForNotificationReferences(admin, {
    restaurantId,
    module,
    referenceIds,
  });

  return NextResponse.json({ ok: true });
}
