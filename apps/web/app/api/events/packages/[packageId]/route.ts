import { NextResponse } from "next/server";
import {
  deleteEventPackage,
  updateEventPackage,
} from "@/lib/events/event-packages-server";
import {
  isEventPackageId,
  parseEventPackageWriteFields,
} from "@/lib/events/event-package";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params;
  if (!isEventPackageId(packageId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

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

  const result = await updateEventPackage(
    auth.sb,
    restaurantId,
    packageId,
    parsed.input,
  );
  if (!result.package) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ package: result.package });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params;
  if (!isEventPackageId(packageId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await deleteEventPackage(auth.sb, restaurantId, packageId);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
