import { NextResponse } from "next/server";
import {
  EVENTS_NATIVE_PLATFORMS,
  isEventsPlatform,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import {
  defaultEventsEmbedPlatforms,
  normalizeEventsEmbedPlatforms,
  type EventsEmbedPlatforms,
} from "@/lib/events/events-embed-platforms";
import { revalidatePublicEventsEmbedForRestaurant } from "@/lib/events/revalidate-public-events-embed";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

type EventsSettingsRow = {
  default_embed_view: "grid" | "list";
  embed_max_items: number;
  embed_platforms: EventsEmbedPlatforms;
  embed_show_all_filter: boolean;
};

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_events_settings")
    .select(
      "default_embed_view, embed_max_items, embed_platforms, embed_show_all_filter",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: EventsSettingsRow = {
    default_embed_view: data?.default_embed_view === "grid" ? "grid" : "list",
    embed_max_items: Number(data?.embed_max_items ?? 24),
    embed_platforms: normalizeEventsEmbedPlatforms(data?.embed_platforms),
    embed_show_all_filter: data?.embed_show_all_filter !== false,
  };

  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    defaultEmbedView?: "grid" | "list";
    embedMaxItems?: number;
    embedPlatforms?: Partial<Record<EventsPlatform, boolean>>;
    embedShowAllFilter?: boolean;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const embedMaxItems = body.embedMaxItems ?? 24;
  if (!Number.isFinite(embedMaxItems) || embedMaxItems < 1 || embedMaxItems > 100) {
    return NextResponse.json({ error: "invalid_embed_max_items" }, { status: 400 });
  }

  const upsertRow: {
    restaurant_id: string;
    default_embed_view: "grid" | "list";
    embed_max_items: number;
    embed_platforms?: EventsEmbedPlatforms;
    embed_show_all_filter: boolean;
  } = {
    restaurant_id: restaurantId,
    default_embed_view: body.defaultEmbedView === "grid" ? "grid" : "list",
    embed_max_items: embedMaxItems,
    embed_show_all_filter: body.embedShowAllFilter !== false,
  };

  if (body.embedPlatforms) {
    upsertRow.embed_platforms = normalizeEventsEmbedPlatforms({
      ...defaultEventsEmbedPlatforms(),
      ...Object.fromEntries(
        Object.entries(body.embedPlatforms).filter(
          ([key, value]) =>
            (EVENTS_NATIVE_PLATFORMS as readonly string[]).includes(key) &&
            typeof value === "boolean",
        ),
      ),
    });
  }

  const { error } = await auth.sb.from("restaurant_events_settings").upsert(upsertRow, {
    onConflict: "restaurant_id",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await revalidatePublicEventsEmbedForRestaurant(auth.sb, restaurantId);
  return NextResponse.json({ ok: true });
}
