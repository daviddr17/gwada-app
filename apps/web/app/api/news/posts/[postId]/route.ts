import { NextResponse } from "next/server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ postId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { postId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    title?: string | null;
    body?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const text = body.body?.trim();
  if (text !== undefined && !text) {
    return NextResponse.json({ error: "body_required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_by: auth.userId,
  };
  if (body.title !== undefined) updates.title = body.title?.trim() || null;
  if (text !== undefined) updates.body = text;

  const { data, error } = await auth.sb
    .from("gwada_news_posts")
    .update(updates)
    .eq("id", postId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const { postId } = await ctx.params;
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("gwada_news_posts")
    .update({
      status: "archived",
      updated_by: auth.userId,
    })
    .eq("id", postId)
    .eq("restaurant_id", restaurantId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
