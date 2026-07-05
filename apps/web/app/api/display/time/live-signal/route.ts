import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayTimeLiveRevision } from "@/lib/display/display-time-live-server";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "time");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const signal = await loadDisplayTimeLiveRevision(access.restaurantId);
  return NextResponse.json(signal);
}
