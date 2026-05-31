import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { createDisplayReservation } from "@/lib/display/display-reservation-mutations-server";
import { loadDisplayReservationsDay } from "@/lib/display/display-reservations-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data = await loadDisplayReservationsDay(access.restaurantId);
  if ("error" in data) {
    return NextResponse.json({ error: data.error }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let body: {
    guest_first_name?: string;
    guest_last_name?: string;
    guest_phone?: string | null;
    guest_email?: string | null;
    party_size?: number;
    starts_at?: string;
    ends_at?: string;
    dining_table_id?: string | null;
    status_id?: string;
    dwell_minutes?: number;
    notify_email?: boolean;
    notify_whatsapp?: boolean;
    terms_accepted?: boolean;
    guest_message?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const given = body.guest_first_name?.trim();
  const family = body.guest_last_name?.trim();
  const partySize = body.party_size;
  const startsAt = body.starts_at?.trim();
  const endsAt = body.ends_at?.trim();

  if (!given || !family || !startsAt || !endsAt || !partySize || partySize < 1) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "invalid_starts_at" }, { status: 400 });
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
  }

  const { data: settings } = await admin
    .from("restaurant_reservation_settings")
    .select("default_dwell_minutes")
    .eq("restaurant_id", access.restaurantId)
    .maybeSingle();

  const dwellMin =
    body.dwell_minutes && body.dwell_minutes >= 15
      ? body.dwell_minutes
      : (settings?.default_dwell_minutes ?? 120);

  let statusId = body.status_id?.trim();
  if (!statusId) {
    const { data: pending } = await admin
      .from("reservation_statuses")
      .select("id")
      .eq("code", "confirmed")
      .maybeSingle();
    statusId = pending?.id as string | undefined;
  }
  if (!statusId) {
    return NextResponse.json({ error: "status_missing" }, { status: 500 });
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", access.restaurantId)
    .maybeSingle();

  const result = await createDisplayReservation(admin, access.restaurantId, {
    guest_first_name: given,
    guest_last_name: family,
    guest_phone: body.guest_phone?.trim() || null,
    guest_email: body.guest_email?.trim() || null,
    party_size: partySize,
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    status_id: statusId,
    dining_table_id: body.dining_table_id || null,
    dwell_minutes: dwellMin,
    notify_email: body.notify_email === true,
    notify_whatsapp: body.notify_whatsapp === true,
    terms_accepted: body.terms_accepted !== false,
    guest_message: body.guest_message?.trim() || null,
    restaurant_name: (restaurant?.name as string | undefined) ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    reservation_number: result.reservation_number,
    guest_pin: result.guest_pin,
  });
}
