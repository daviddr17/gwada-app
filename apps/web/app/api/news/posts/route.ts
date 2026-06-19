import { NextResponse } from "next/server";
import {
  isNewsPlatform,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import { isNewsStoriesPlatform } from "@/lib/news/news-stories-cache-constants";
import { createAndPublishNewsPost } from "@/lib/news/news-publish-server";
import { parseNewsMedia } from "@/lib/news/news-media";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    postId?: string;
    title?: string | null;
    body?: string;
    scheduledAt?: string | null;
    platforms?: string[];
    storyPlatforms?: string[];
    media?: unknown;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const text = body.body?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "body_required" }, { status: 400 });
  }

  const platforms = (body.platforms ?? ["gwada"])
    .filter((p): p is NewsPlatform => isNewsPlatform(p));

  const storyPlatforms = (body.storyPlatforms ?? [])
    .filter((p): p is NewsPlatform => isNewsPlatform(p))
    .filter(isNewsStoriesPlatform);

  const result = await createAndPublishNewsPost(auth.sb, {
    restaurantId,
    userId: auth.userId,
    postId: body.postId?.trim() || undefined,
    title: body.title?.trim() || null,
    body: text,
    media: parseNewsMedia(body.media),
    scheduledAt: body.scheduledAt ?? null,
    platforms: platforms.length ? platforms : ["gwada"],
    storyPlatforms,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ postId: result.postId });
}
