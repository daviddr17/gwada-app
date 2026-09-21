import { NextResponse } from "next/server";
import {
  isEventMenuId,
  parseEventMenuWriteFields,
} from "@/lib/events/event-menu";
import { deleteEventMenu, updateEventMenu } from "@/lib/events/event-menus-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ menuId: string }> },
) {
  const { menuId } = await params;
  if (!isEventMenuId(menuId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const restaurantId =
    typeof body.restaurantId === "string" ? body.restaurantId.trim() : "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = parseEventMenuWriteFields(body);
  if (parsed.error !== null) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await updateEventMenu(auth.sb, restaurantId, menuId, parsed.input);
  if (!result.menu) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ menu: result.menu });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ menuId: string }> },
) {
  const { menuId } = await params;
  if (!isEventMenuId(menuId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await deleteEventMenu(auth.sb, restaurantId, menuId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
