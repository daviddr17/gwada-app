import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("gwada_news_story_rings")
    .select("id, title, cover_storage_path, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rings: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
    title?: string;
    postIds?: string[];
    coverStoragePath?: string | null;
  } | null;

  const restaurantId = body?.restaurantId?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
  const postIds = [...new Set(body?.postIds ?? [])].filter(Boolean);

  if (!title || postIds.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: validPosts, error: postsError } = await auth.sb
    .from("gwada_news_posts")
    .select("id, media")
    .eq("restaurant_id", restaurantId)
    .eq("status", "published")
    .in("id", postIds);

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }
  if ((validPosts ?? []).length !== postIds.length) {
    return NextResponse.json({ error: "invalid_post_ids" }, { status: 400 });
  }

  const postsWithMedia = (validPosts ?? []).filter((post) => {
    const media = post.media;
    return Array.isArray(media) && media.length > 0;
  });
  if (postsWithMedia.length !== postIds.length) {
    return NextResponse.json({ error: "posts_require_media" }, { status: 400 });
  }

  const { count: ringCount } = await auth.sb
    .from("gwada_news_story_rings")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  const coverFromBody = body?.coverStoragePath?.trim();
  const firstMedia = (postsWithMedia[0]?.media as Array<{ storagePath?: string }> | undefined)?.[0];
  const coverFromFirst = firstMedia?.storagePath?.trim() ?? null;
  const coverStoragePath = coverFromBody || coverFromFirst || null;

  const ringId = randomUUID();
  const { error: insertError } = await auth.sb.from("gwada_news_story_rings").insert({
    id: ringId,
    restaurant_id: restaurantId,
    title,
    cover_storage_path: coverStoragePath,
    sort_order: ringCount ?? 0,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const links = postIds.map((postId, index) => ({
    ring_id: ringId,
    post_id: postId,
    sort_order: index,
  }));

  const { error: linkError } = await auth.sb
    .from("gwada_news_story_ring_items")
    .insert(links);

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ ringId });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const ringId = url.searchParams.get("ringId")?.trim() ?? "";

  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await auth.sb
    .from("gwada_news_story_rings")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", ringId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
