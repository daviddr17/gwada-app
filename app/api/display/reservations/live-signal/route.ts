import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayReservationsLiveSignal } from "@/lib/display/display-reservations-server";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const signal = await loadDisplayReservationsLiveSignal(access.restaurantId);
  return NextResponse.json(signal);
}
