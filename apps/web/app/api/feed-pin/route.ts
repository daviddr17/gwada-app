import { NextResponse } from "next/server";
import { isFeedPinModule } from "@/lib/feed-pin/feed-pin-types";
import { setFeedItemPinned } from "@/lib/feed-pin/feed-pin-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

async function authorizeFeedPin(
  module: string,
  restaurantId: string,
) {
  if (!isFeedPinModule(module)) {
    return { ok: false as const, status: 400, error: "invalid_module" };
  }

  switch (module) {
    case "news":
      return authorizeNewsRestaurant(restaurantId, { requireManage: true });
    case "events":
      return authorizeEventsRestaurant(restaurantId, { requireManage: true });
    case "gallery":
      return authorizeGalleryRestaurant(restaurantId, { permission: "gallery.update" });
    case "reviews":
      return authorizeReviewsRestaurant(restaurantId);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    module?: string;
    platform?: string;
    itemId?: string;
    pinned?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const module = body.module?.trim() ?? "";
  const platform = body.platform?.trim() ?? "";
  const itemId = body.itemId?.trim() ?? "";
  const pinned = Boolean(body.pinned);

  if (!platform || !itemId) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const auth = await authorizeFeedPin(module, restaurantId);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "error" in auth ? auth.error : "forbidden" },
      { status: auth.status },
    );
  }

  const result = await setFeedItemPinned(auth.sb, {
    restaurantId,
    module: module as Parameters<typeof setFeedItemPinned>[1]["module"],
    pinned,
    platform,
    itemId,
  });

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, isPinned: result.isPinned });
}
