import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseProfileVisibility } from "@/lib/profile/profile-nav";
import type {
  CreateStaffAvailabilitySlotInput,
  StaffAvailabilitySlotKind,
  StaffAvailabilityWeekday,
} from "@/lib/types/staff-availability";

const SLOT_SELECT =
  "id, restaurant_id, staff_id, weekday, service_date, start_time, end_time, note, created_by, created_at, updated_at";

async function assertAvailabilityEnabled(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
): Promise<Response | null> {
  const { data } = await admin
    .from("restaurant_staff_module_settings")
    .select("profile_show_availability")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const visibility = parseProfileVisibility(data);
  if (!visibility.profile_show_availability) {
    return NextResponse.json(
      { error: "availability_disabled", enabled: false },
      { status: 403 },
    );
  }
  return null;
}

function normalizeHmInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  return `${trimmed}:00`;
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

  const disabled = await assertAvailabilityEnabled(admin, access.restaurantId);
  if (disabled) return disabled;

  const { data, error } = await admin
    .from("restaurant_staff_availability_slots")
    .select(SLOT_SELECT)
    .eq("restaurant_id", access.restaurantId)
    .eq("staff_id", access.staffId)
    .order("weekday", { ascending: true, nullsFirst: false })
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const disabled = await assertAvailabilityEnabled(admin, access.restaurantId);
  if (disabled) return disabled;

  let body: Partial<CreateStaffAvailabilitySlotInput> & {
    kind?: StaffAvailabilitySlotKind;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "weekly" && kind !== "date") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const startTime = normalizeHmInput(String(body.startTime ?? ""));
  const endTime = normalizeHmInput(String(body.endTime ?? ""));
  if (!startTime || !endTime) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }
  if (endTime <= startTime) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  const weekday =
    kind === "weekly" ? (body.weekday as StaffAvailabilityWeekday | null) : null;
  const serviceDate =
    kind === "date" ? (body.serviceDate?.trim() ?? null) : null;

  if (kind === "weekly" && !weekday) {
    return NextResponse.json({ error: "missing_weekday" }, { status: 400 });
  }
  if (kind === "date" && !serviceDate) {
    return NextResponse.json({ error: "missing_date" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("restaurant_staff_availability_slots")
    .insert({
      restaurant_id: access.restaurantId,
      staff_id: access.staffId,
      weekday,
      service_date: serviceDate,
      start_time: startTime,
      end_time: endTime,
      note: body.note?.trim() || null,
    })
    .select(SLOT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slot: data });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const disabled = await assertAvailabilityEnabled(admin, access.restaurantId);
  if (disabled) return disabled;

  const { searchParams } = new URL(request.url);
  const slotId = searchParams.get("id");
  if (!slotId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { error } = await admin
    .from("restaurant_staff_availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("staff_id", access.staffId)
    .eq("restaurant_id", access.restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
