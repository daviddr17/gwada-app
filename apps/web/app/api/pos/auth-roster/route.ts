import { NextResponse } from "next/server";
import { buildPosAuthRoster } from "@/lib/pos/pos-auth-roster-server";
import { assertPosDeviceFromRequest } from "@/lib/pos/pos-device-auth-server";

/** Gekoppeltes Gerät lädt PIN-Roster für Offline-Login (ohne Session). */
export async function GET(request: Request) {
  const deviceResult = await assertPosDeviceFromRequest(request);
  if (!deviceResult.ok) {
    return NextResponse.json(
      { error: deviceResult.error },
      { status: deviceResult.status },
    );
  }

  const roster = await buildPosAuthRoster(deviceResult.device);
  return NextResponse.json({
    ok: true,
    restaurant_id: deviceResult.device.restaurant_id,
    fetched_at: roster.fetchedAt,
    staff: roster.staff,
  });
}
