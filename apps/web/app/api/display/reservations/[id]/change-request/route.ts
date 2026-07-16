import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import {
  approveDisplayReservationChangeRequest,
  declineDisplayReservationChangeRequest,
} from "@/lib/display/display-reservation-change-request-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CHANGE_REQUEST_ERRORS: Record<string, string> = {
  not_found: "Reservierung nicht gefunden.",
  no_change_request: "Keine offene Änderungsanfrage.",
  pending_change_missing: "Änderungsdaten fehlen.",
};

export async function POST(
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

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "decline") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result =
    body.action === "approve"
      ? await approveDisplayReservationChangeRequest(
          admin,
          access.restaurantId,
          access.staffId,
          id,
        )
      : await declineDisplayReservationChangeRequest(
          admin,
          access.restaurantId,
          access.staffId,
          id,
        );

  if (!result.ok) {
    const message = CHANGE_REQUEST_ERRORS[result.error] ?? result.error;
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error, message }, { status });
  }

  return NextResponse.json({ ok: true });
}
