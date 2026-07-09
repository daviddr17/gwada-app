import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  deleteDisplayReservation,
  updateDisplayReservation,
} from "@/lib/display/display-reservation-mutations-server";
import {
  loadDisplayReservationDetail,
  loadDisplayReservationRowById,
} from "@/lib/display/display-reservations-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { isValidReservationTimeRange } from "@/lib/display/display-reservation-save-times";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;
  const result = await loadDisplayReservationDetail(access.restaurantId, id);

  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "server_misconfigured"
          ? 503
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.detail);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const partySize = Number(body.party_size);
  if (
    typeof body.guest_first_name !== "string" ||
    typeof body.guest_last_name !== "string" ||
    typeof body.starts_at !== "string" ||
    typeof body.ends_at !== "string" ||
    typeof body.status_id !== "string" ||
    !Number.isFinite(partySize) ||
    partySize < 1 ||
    partySize > 50
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const dwellRaw = body.dwell_minutes;
  const dwellMinutes =
    dwellRaw == null
      ? null
      : typeof dwellRaw === "number" && Number.isFinite(dwellRaw)
        ? dwellRaw
        : null;

  if (
    !isValidReservationTimeRange(body.starts_at, body.ends_at) ||
    (dwellMinutes != null && (dwellMinutes < 15 || dwellMinutes > 1440))
  ) {
    return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
  }

  const guestLastName = normalizeReservationGuestLastName(body.guest_last_name);
  if (!guestLastName) {
    return NextResponse.json({ error: "last_name_required" }, { status: 400 });
  }

  const result = await updateDisplayReservation(
    admin,
    access.restaurantId,
    id,
    {
      guest_first_name: normalizeReservationGuestFirstName(body.guest_first_name),
      guest_last_name: guestLastName,
      guest_phone:
        typeof body.guest_phone === "string" ? body.guest_phone.trim() || null : null,
      guest_email:
        typeof body.guest_email === "string" ? body.guest_email.trim() || null : null,
      party_size: partySize,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      status_id: body.status_id,
      dining_table_id:
        typeof body.dining_table_id === "string" ? body.dining_table_id : null,
      dwell_minutes: dwellMinutes,
      notify_email: Boolean(body.notify_email),
      notify_whatsapp: Boolean(body.notify_whatsapp),
      terms_accepted: Boolean(body.terms_accepted),
      notes:
        typeof body.notes === "string" ? body.notes.trim() || null : null,
    },
  );

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "table_requires_confirmed"
          ? 400
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const reservation = await loadDisplayReservationRowById(access.restaurantId, id);

  return NextResponse.json({ ok: true, reservation });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await context.params;
  const result = await deleteDisplayReservation(admin, access.restaurantId, id);

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
