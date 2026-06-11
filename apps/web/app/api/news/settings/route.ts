import { NextResponse } from "next/server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

type NewsSettingsRow = {
  whatsapp_channel_id: string | null;
  default_embed_view: "grid" | "list";
  embed_max_items: number;
};

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_news_settings")
    .select("whatsapp_channel_id, default_embed_view, embed_max_items")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: NewsSettingsRow = {
    whatsapp_channel_id: (data?.whatsapp_channel_id as string | null) ?? null,
    default_embed_view:
      data?.default_embed_view === "list" ? "list" : "grid",
    embed_max_items: Number(data?.embed_max_items ?? 24),
  };

  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    whatsappChannelId?: string | null;
    defaultEmbedView?: "grid" | "list";
    embedMaxItems?: number;
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
  const whatsappChannelId = body.whatsappChannelId?.trim() || null;

  const { error } = await auth.sb.from("restaurant_news_settings").upsert(
    {
      restaurant_id: restaurantId,
      whatsapp_channel_id: whatsappChannelId,
      default_embed_view: defaultEmbedView,
      embed_max_items: embedMaxItems,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
