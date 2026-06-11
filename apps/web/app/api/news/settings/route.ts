import { after, NextResponse } from "next/server";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { isNewsPlatform } from "@/lib/constants/news-platforms";
import {
  defaultEmbedPlatforms,
  normalizeEmbedPlatforms,
  type NewsEmbedPlatforms,
} from "@/lib/news/news-embed-platforms";
import { syncRestaurantNewsPlatformAfterPublish } from "@/lib/news/news-feed-sync-server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

type NewsSettingsRow = {
  whatsapp_channel_ids: string[];
  default_embed_view: "grid" | "list";
  embed_max_items: number;
  embed_platforms: NewsEmbedPlatforms;
};

function normalizeChannelIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_news_settings")
    .select(
      "whatsapp_channel_ids, whatsapp_channel_id, default_embed_view, embed_max_items, embed_platforms",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fromArray = normalizeChannelIds(data?.whatsapp_channel_ids);
  const legacy = (data?.whatsapp_channel_id as string | null)?.trim();

  const settings: NewsSettingsRow = {
    whatsapp_channel_ids:
      fromArray.length > 0 ? fromArray : legacy ? [legacy] : [],
    default_embed_view:
      data?.default_embed_view === "list" ? "list" : "grid",
    embed_max_items: Number(data?.embed_max_items ?? 24),
    embed_platforms: normalizeEmbedPlatforms(data?.embed_platforms),
  };

  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    whatsappChannelIds?: string[];
    defaultEmbedView?: "grid" | "list";
    embedMaxItems?: number;
    embedPlatforms?: Partial<Record<NewsPlatform, boolean>>;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const embedMaxItems = body.embedMaxItems ?? 24;
  if (!Number.isFinite(embedMaxItems) || embedMaxItems < 1 || embedMaxItems > 100) {
    return NextResponse.json({ error: "invalid_embed_max_items" }, { status: 400 });
  }

  const defaultEmbedView = body.defaultEmbedView === "list" ? "list" : "grid";
  const whatsappChannelIds = normalizeChannelIds(body.whatsappChannelIds);
  const primaryChannelId = whatsappChannelIds[0] ?? null;

  const upsertRow: {
    restaurant_id: string;
    whatsapp_channel_ids: string[];
    whatsapp_channel_id: string | null;
    default_embed_view: "grid" | "list";
    embed_max_items: number;
    embed_platforms?: NewsEmbedPlatforms;
  } = {
    restaurant_id: restaurantId,
    whatsapp_channel_ids: whatsappChannelIds,
    whatsapp_channel_id: primaryChannelId,
    default_embed_view: defaultEmbedView,
    embed_max_items: embedMaxItems,
  };

  if (body.embedPlatforms) {
    upsertRow.embed_platforms = normalizeEmbedPlatforms({
      ...defaultEmbedPlatforms(),
      ...Object.fromEntries(
        Object.entries(body.embedPlatforms).filter(
          ([key, value]) => isNewsPlatform(key) && typeof value === "boolean",
        ),
      ),
    });
  }

  const { error } = await auth.sb.from("restaurant_news_settings").upsert(upsertRow, {
    onConflict: "restaurant_id",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(() => {
    void syncRestaurantNewsPlatformAfterPublish(restaurantId, "whatsapp_channel");
  });

  return NextResponse.json({ ok: true });
}
