import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { applyDisplayAutoTableAssignments } from "@/lib/display/display-reservation-mutations-server";
import { loadDisplayReservationsDay } from "@/lib/display/display-reservations-server";
import { computeAutoTableAssignments } from "@/lib/reservations/auto-table-assignment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const day = await loadDisplayReservationsDay(access.restaurantId);
  if ("error" in day) {
    return NextResponse.json({ error: day.error }, { status: 500 });
  }

  const autoRows = day.reservations.map((r) => ({
    id: r.id,
    party_size: r.party_size,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    dining_table_id: r.dining_table_id,
    reservation_statuses: r.status ? { code: r.status.code } : null,
  }));

  const assignments = computeAutoTableAssignments(autoRows, day.tables);
  if (assignments.size === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const result = await applyDisplayAutoTableAssignments(
    admin,
    access.restaurantId,
    assignments,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: result.updated });
}
