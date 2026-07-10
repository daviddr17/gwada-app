import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    itemId?: string;
    title?: string | null;
    caption?: string | null;
    category?: string | null;
    storagePath?: string;
    thumbStoragePath?: string | null;
    blurDataUrl?: string | null;
    mimeType?: string;
    sizeBytes?: number;
    width?: number | null;
    height?: number | null;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const itemId = body?.itemId?.trim() ?? randomUUID();
  const storagePath = body?.storagePath?.trim() ?? "";
  const mimeType = body?.mimeType?.trim() ?? "";
  const sizeBytes = Number(body?.sizeBytes ?? 0);

  if (!storagePath || !mimeType || sizeBytes <= 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.create",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("gwada_gallery_items")
    .insert({
      id: itemId,
      restaurant_id: restaurantId,
      title: body?.title?.trim() || null,
      caption: body?.caption?.trim() || null,
      category: body?.category?.trim() || null,
      storage_path: storagePath,
      thumb_storage_path: body?.thumbStoragePath?.trim() || null,
      blur_data_url: body?.blurDataUrl?.trim() || null,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      width: body?.width ?? null,
      height: body?.height ?? null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("id")
    .single();

  if (error) {
    const status = error.message.includes("storage_quota_exceeded") ? 413 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ itemId: data.id });
}
