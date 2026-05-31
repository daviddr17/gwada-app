import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { checkDisplayReservationWhatsappNumber } from "@/lib/display/display-reservation-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(
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
  const result = await checkDisplayReservationWhatsappNumber(
    admin,
    access.restaurantId,
    id,
  );

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "no_phone"
          ? 400
          : 503;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    exists: result.exists,
    chatId: result.chatId,
  });
}
