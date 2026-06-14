import { NextResponse } from "next/server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import { RESTAURANT_WORKSPACE_QUOTA_BYTES } from "@/lib/constants/workspace-storage";
import type { WorkspaceStorageBreakdown } from "@/lib/constants/workspace-storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb.rpc("restaurant_workspace_storage_breakdown", {
    p_restaurant_id: restaurantId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const raw = (data ?? {}) as Record<string, number>;
  const breakdown: WorkspaceStorageBreakdown = {
    documentsBytes: Number(raw.documentsBytes ?? 0),
    galleryBytes: Number(raw.galleryBytes ?? 0),
    newsBytes: Number(raw.newsBytes ?? 0),
    accountingBytes: Number(raw.accountingBytes ?? 0),
    totalBytes: Number(raw.totalBytes ?? 0),
    quotaBytes: Number(raw.quotaBytes ?? RESTAURANT_WORKSPACE_QUOTA_BYTES),
  };

  return NextResponse.json(breakdown);
}
