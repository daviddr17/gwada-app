import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseProfileVisibility } from "@/lib/profile/profile-nav";
import type {
  StaffAvailabilitySlotKind,
  StaffAvailabilityWeekday,
} from "@/lib/types/staff-availability";
import {
  STAFF_AVAILABILITY_ALL_DAY_END,
  STAFF_AVAILABILITY_ALL_DAY_START,
} from "@/lib/types/staff-availability";

const SLOT_SELECT =
  "id, restaurant_id, staff_id, weekday, service_date, start_time, end_time, is_available, note, created_by, created_at, updated_at";

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

function normalizeServiceDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ].sort();
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

  let body: {
    kind?: StaffAvailabilitySlotKind;
    weekday?: StaffAvailabilityWeekday | null;
    serviceDate?: string | null;
    serviceDates?: unknown;
    startTime?: string;
    endTime?: string;
    isAvailable?: boolean;
    note?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const isAvailable = body.isAvailable !== false;
  const batchDates = normalizeServiceDates(body.serviceDates);
  const singleDate =
    typeof body.serviceDate === "string" ? body.serviceDate.trim() : "";
  const dateSlots =
    batchDates.length > 0
      ? batchDates
      : singleDate && /^\d{4}-\d{2}-\d{2}$/.test(singleDate)
        ? [singleDate]
        : [];

  const kind = body.kind;
  const useDateBatch = dateSlots.length > 0 || kind === "date";

  if (!useDateBatch && kind !== "weekly") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  if (!isAvailable && !useDateBatch) {
    return NextResponse.json(
      { error: "unavailable_requires_date" },
      { status: 400 },
    );
  }

  const startHm = isAvailable
    ? String(body.startTime ?? "")
    : STAFF_AVAILABILITY_ALL_DAY_START;
  const endHm = isAvailable
    ? String(body.endTime ?? "")
    : STAFF_AVAILABILITY_ALL_DAY_END;
  const startTime = normalizeHmInput(startHm);
  const endTime = normalizeHmInput(endHm);
  if (!startTime || !endTime) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }
  if (endTime <= startTime) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  if (useDateBatch) {
    if (dateSlots.length === 0) {
      return NextResponse.json({ error: "missing_date" }, { status: 400 });
    }

    const rows = dateSlots.map((serviceDate) => ({
      restaurant_id: access.restaurantId,
      staff_id: access.staffId,
      weekday: null as null,
      service_date: serviceDate,
      start_time: startTime,
      end_time: endTime,
      is_available: isAvailable,
      note: body.note?.trim() || null,
    }));

    const { data, error } = await admin
      .from("restaurant_staff_availability_slots")
      .insert(rows)
      .select(SLOT_SELECT);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      slots: data ?? [],
      created: rows.length,
      slot: data?.[0] ?? null,
    });
  }

  const weekday = body.weekday as StaffAvailabilityWeekday | null;
  if (!weekday) {
    return NextResponse.json({ error: "missing_weekday" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("restaurant_staff_availability_slots")
    .insert({
      restaurant_id: access.restaurantId,
      staff_id: access.staffId,
      weekday,
      service_date: null,
      start_time: startTime,
      end_time: endTime,
      is_available: true,
      note: body.note?.trim() || null,
    })
    .select(SLOT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slot: data, created: 1 });
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
