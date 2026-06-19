import { NextResponse } from "next/server";
import { loadWhatsappNewsChannelCreateDefaults } from "@/lib/news/create-whatsapp-news-channel-server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const defaults = await loadWhatsappNewsChannelCreateDefaults(admin, restaurantId);
  if ("error" in defaults) {
    return NextResponse.json({ error: defaults.error }, { status: 400 });
  }

  return NextResponse.json(defaults);
}
