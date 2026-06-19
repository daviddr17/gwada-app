import { NextResponse } from "next/server";
import {
  isEventsPlatform,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { createAndPublishEvent } from "@/lib/events/events-publish-server";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    eventId?: string;
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string | null;
    ticketUrl?: string | null;
    location?: string | null;
    coverStoragePath?: string | null;
    coverMimeType?: string | null;
    scheduledAt?: string | null;
    platforms?: string[];
    postToInstagram?: boolean;
    postToWhatsapp?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const title = body.title?.trim() ?? "";
  const startAt = body.startAt?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
    return NextResponse.json({ error: "start_at_required" }, { status: 400 });
  }

  const endAt = body.endAt?.trim() || null;
  if (endAt && Number.isNaN(new Date(endAt).getTime())) {
    return NextResponse.json({ error: "invalid_end_at" }, { status: 400 });
  }

  const platforms = (body.platforms ?? ["gwada"]).filter((p): p is EventsPlatform =>
    isEventsPlatform(p),
  );

  const postToInstagram = Boolean(body.postToInstagram);
  const postToWhatsapp = Boolean(body.postToWhatsapp);

  if (postToInstagram && !body.coverStoragePath?.trim()) {
    return NextResponse.json({ error: "instagram_requires_cover" }, { status: 400 });
  }

  const result = await createAndPublishEvent(auth.sb, {
    restaurantId,
    userId: auth.userId,
    eventId: body.eventId?.trim() || undefined,
    title,
    description: body.description?.trim() ?? "",
    startAt,
    endAt,
    ticketUrl: body.ticketUrl?.trim() || null,
    location: body.location?.trim() || null,
    coverStoragePath: body.coverStoragePath?.trim() || null,
    coverMimeType: body.coverMimeType?.trim() || null,
    scheduledAt: body.scheduledAt ?? null,
    platforms: platforms.length ? platforms : ["gwada"],
    postToInstagram,
    postToWhatsapp,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ eventId: result.eventId });
}
