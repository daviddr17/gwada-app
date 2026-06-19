import { NextResponse } from "next/server";
import {
  readGalleryHighlightMembership,
  syncGalleryItemHighlightMembership,
} from "@/lib/gallery/gallery-highlight-membership-server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const itemId = url.searchParams.get("itemId")?.trim() ?? "";

  if (!itemId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeGalleryRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const highlights = await readGalleryHighlightMembership(
    auth.sb,
    restaurantId,
    itemId,
  );

  return NextResponse.json({ highlights });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    itemId?: string;
    highlightIds?: string[];
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const itemId = body?.itemId?.trim() ?? "";
  const highlightIds = body?.highlightIds ?? [];

  if (!itemId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.update",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await syncGalleryItemHighlightMembership(
    auth.sb,
    restaurantId,
    itemId,
    highlightIds,
  );

  if (!result.ok) {
    const status = result.error === "invalid_item_id" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  const highlights = await readGalleryHighlightMembership(
    auth.sb,
    restaurantId,
    itemId,
  );

  return NextResponse.json({ ok: true, highlights });
}
