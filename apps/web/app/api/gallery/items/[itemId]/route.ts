import { NextResponse } from "next/server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import { getGalleryConnector } from "@/lib/gallery/connectors/registry";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { syncRestaurantGalleryPlatform } from "@/lib/gallery/gallery-feed-sync-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isGalleryPlatform } from "@/lib/constants/gallery-platforms";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    title?: string | null;
    caption?: string | null;
    category?: string | null;
  } | null;
  const restaurantId = body?.restaurantId?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.update",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.sb
    .from("gwada_gallery_items")
    .update({
      title: body?.title?.trim() || null,
      caption: body?.caption?.trim() || null,
      category: body?.category?.trim() || null,
      updated_by: auth.userId,
    })
    .eq("restaurant_id", restaurantId)
    .eq("id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const platform = url.searchParams.get("platform")?.trim() ?? "gwada";
  const externalId = url.searchParams.get("externalId")?.trim() ?? itemId;

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.delete",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (platform === "gwada") {
    const { data: row } = await auth.sb
      .from("gwada_gallery_items")
      .select("storage_path")
      .eq("restaurant_id", restaurantId)
      .eq("id", itemId)
      .maybeSingle();

    const { error } = await auth.sb
      .from("gwada_gallery_items")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const admin = createSupabaseAdminClient();
    if (admin && row?.storage_path) {
      await admin.storage.from("gallery-media").remove([row.storage_path as string]);
    }
    return NextResponse.json({ ok: true });
  }

  if (!isGalleryPlatform(platform) || platform === "gwada") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const connector = getGalleryConnector(platform);
  if (!connector.deleteItem) {
    return NextResponse.json({ error: "not_deletable" }, { status: 400 });
  }

  const result = await connector.deleteItem(restaurantId, auth.sb, externalId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await syncRestaurantGalleryPlatform(admin, restaurantId, platform);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, context: RouteContext) {
  const { itemId } = await context.params;
  void itemId;
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    platform?: string;
    storagePath?: string;
    mimeType?: string;
    mediaUrl?: string;
    title?: string | null;
    caption?: string | null;
    category?: string | null;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const platformRaw = body?.platform?.trim() ?? "gwada";
  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.create",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isGalleryPlatform(platformRaw) || platformRaw === "gwada") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  let mediaUrl = body?.mediaUrl?.trim() ?? "";
  if (!mediaUrl && body?.storagePath) {
    mediaUrl = (await resolveGalleryMediaSignedUrl(body.storagePath)) ?? "";
  }
  if (!mediaUrl) {
    return NextResponse.json({ error: "media_required" }, { status: 400 });
  }

  const connector = getGalleryConnector(platformRaw);
  if (!connector.uploadItem) {
    return NextResponse.json({ error: "upload_not_supported" }, { status: 400 });
  }

  const result = await connector.uploadItem(restaurantId, auth.sb, {
    title: body?.title ?? null,
    caption: body?.caption ?? null,
    category: body?.category ?? null,
    mediaUrl,
    mimeType: body?.mimeType?.trim() ?? "image/jpeg",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await syncRestaurantGalleryPlatform(admin, restaurantId, platformRaw);
  }

  return NextResponse.json(result);
}
