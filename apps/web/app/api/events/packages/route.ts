import { NextResponse } from "next/server";
import { createEventPackage, listEventPackagesForStaff } from "@/lib/events/event-packages-server";
import { parseEventPackageWriteFields } from "@/lib/events/event-package";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const listed = await listEventPackagesForStaff(auth.sb, restaurantId);
  if (listed.error) {
    return NextResponse.json({ error: listed.error }, { status: 500 });
  }
  return NextResponse.json({ packages: listed.packages });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId =
    typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = parseEventPackageWriteFields(body);
  if (parsed.error !== null) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createEventPackage(auth.sb, restaurantId, parsed.input);
  if (!result.package) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ package: result.package });
}
