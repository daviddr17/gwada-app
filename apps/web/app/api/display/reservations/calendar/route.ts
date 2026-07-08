import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayReservationsMonthDayStats } from "@/lib/display/display-reservations-server";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "reservations");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const month = new URL(request.url).searchParams.get("month");
  const data = await loadDisplayReservationsMonthDayStats(
    access.restaurantId,
    month,
  );
  if ("error" in data) {
    const status = data.error === "invalid_month" ? 400 : 500;
    return NextResponse.json({ error: data.error }, { status });
  }

  return NextResponse.json(data);
}
