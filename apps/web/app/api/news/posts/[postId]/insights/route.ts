import { NextResponse } from "next/server";
import { loadNewsPostChannelInsights } from "@/lib/news/news-post-channel-insights";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ postId: string }> };

/** Reichweite/Engagement je Kanal für einen Gwada-News-Post. */
export async function GET(req: Request, ctx: RouteCtx) {
  const { postId } = await ctx.params;
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const channels = await loadNewsPostChannelInsights(
    auth.sb,
    restaurantId,
    postId,
  );

  return NextResponse.json(
    { channels },
    { headers: { "Cache-Control": "no-store" } },
  );
}
