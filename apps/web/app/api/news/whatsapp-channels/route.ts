import { NextResponse } from "next/server";
import {
  createWhatsappNewsChannelForRestaurant,
  loadWhatsappNewsChannelCreateDefaults,
} from "@/lib/news/create-whatsapp-news-channel-server";
import { listWahaChannelsForRestaurant } from "@/lib/waha/waha-channels";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await listWahaChannelsForRestaurant(restaurantId, { role: "OWNER" });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, channels: [] });
  }

  return NextResponse.json({ channels: result.channels });
}

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    name?: string;
    description?: string | null;
    includeLogo?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await createWhatsappNewsChannelForRestaurant(auth.sb, {
    restaurantId,
    name: body.name ?? "",
    description: body.description,
    includeLogo: body.includeLogo,
  });

  if (!result.ok) {
    const status =
      result.error === "whatsapp_not_connected" ||
      result.error === "owner_channel_exists"
        ? 409
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    channel: {
      id: result.channel.id,
      name: result.channel.name,
      invite: result.channel.invite ?? null,
    },
    whatsappChannelIds: result.whatsappChannelIds,
  });
}
