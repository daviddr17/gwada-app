import { NextResponse } from "next/server";
import { getEventsConnector } from "@/lib/events/connectors/registry";
import { updateGwadaEvent } from "@/lib/events/events-update-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";
import { revalidatePublicEventsEmbedForRestaurant } from "@/lib/events/revalidate-public-events-embed";
import { syncRestaurantEventsPlatformAfterPublish } from "@/lib/events/events-feed-sync-server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ itemId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { itemId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string | null;
    ticketUrl?: string | null;
    location?: string | null;
    coverStoragePath?: string | null;
    coverMimeType?: string | null;
    removeCover?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await updateGwadaEvent(auth.sb, {
    restaurantId,
    eventId: itemId,
    userId: auth.userId,
    title: body.title,
    description: body.description,
    startAt: body.startAt,
    endAt: body.endAt,
    ticketUrl: body.ticketUrl,
    location: body.location,
    coverStoragePath: body.coverStoragePath,
    coverMimeType: body.coverMimeType,
    removeCover: body.removeCover,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "title_required" ||
            result.error === "invalid_start_at" ||
            result.error === "invalid_end_at" ||
            result.error === "end_before_start"
          ? 400
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  await revalidatePublicEventsEmbedForRestaurant(auth.sb, restaurantId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await ctx.params;
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const platformParam = url.searchParams.get("platform")?.trim();
  const externalId = url.searchParams.get("externalId")?.trim();

  if (platformParam && platformParam !== "gwada" && externalId) {
    const connector = getEventsConnector(platformParam as Parameters<typeof getEventsConnector>[0]);
    if (connector.deleteEvent) {
      const result = await connector.deleteEvent(restaurantId, auth.sb, externalId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      void syncRestaurantEventsPlatformAfterPublish(restaurantId, connector.key);
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await auth.sb
    .from("gwada_events")
    .delete()
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
