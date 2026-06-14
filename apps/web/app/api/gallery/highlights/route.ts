import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("gwada_gallery_highlights")
    .select("id, title, cover_storage_path, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ highlights: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    title?: string;
    itemIds?: string[];
    coverStoragePath?: string | null;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
  const itemIds = body?.itemIds ?? [];

  if (!title || itemIds.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.update",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const highlightId = randomUUID();
  const { error: insertError } = await auth.sb.from("gwada_gallery_highlights").insert({
    id: highlightId,
    restaurant_id: restaurantId,
    title,
    cover_storage_path: body?.coverStoragePath?.trim() || null,
    sort_order: 0,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const links = itemIds.map((itemId, index) => ({
    highlight_id: highlightId,
    item_id: itemId,
    sort_order: index,
  }));

  const { error: linkError } = await auth.sb
    .from("gwada_gallery_highlight_items")
    .insert(links);

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ highlightId });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const highlightId = url.searchParams.get("highlightId")?.trim() ?? "";

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.delete",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.sb
    .from("gwada_gallery_highlights")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", highlightId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
