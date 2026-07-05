import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayInventoryLiveRevision } from "@/lib/display/display-inventory-server";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "inventory");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const signal = await loadDisplayInventoryLiveRevision(access.restaurantId);
  return NextResponse.json(signal);
}
