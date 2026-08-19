import { NextResponse } from "next/server";
import { parseEventMenuWriteFields } from "@/lib/events/event-menu";
import {
  createEventMenu,
  listEventMenusForStaff,
} from "@/lib/events/event-menus-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const listed = await listEventMenusForStaff(auth.sb, restaurantId);
  if (listed.error) {
    return NextResponse.json({ error: listed.error }, { status: 500 });
  }
  return NextResponse.json({ menus: listed.menus });
}

export async function POST(req: Request) {
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

  const result = await createEventMenu(auth.sb, restaurantId, parsed.input);
  if (!result.menu) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ menu: result.menu });
}
