import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { updateDisplayReservationTable } from "@/lib/display/display-reservation-mutations-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  let body: { dining_table_id?: string | null };
  try {
    body = (await request.json()) as { dining_table_id?: string | null };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const tableId =
    body.dining_table_id === null || body.dining_table_id === undefined
      ? null
      : String(body.dining_table_id).trim() || null;

  const result = await updateDisplayReservationTable(
    admin,
    access.restaurantId,
    id,
    tableId,
  );

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "table_requires_confirmed"
          ? 409
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
