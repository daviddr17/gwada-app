import { NextResponse } from "next/server";
import {
  defaultReviewEmbedSettingsRow,
  parseReviewEmbedViewMode,
} from "@/lib/reviews/review-embed-settings-db";
import { revalidatePublicReviewsEmbedForRestaurant } from "@/lib/reviews/revalidate-public-reviews-embed";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const { data, error } = await auth.sb
    .from("restaurant_review_settings")
    .select("default_embed_view")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const defaultEmbedView = data
    ? parseReviewEmbedViewMode(data.default_embed_view as string | null)
    : defaultReviewEmbedSettingsRow().defaultEmbedView;

  return NextResponse.json({ defaultEmbedView });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    defaultEmbedView?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const defaultEmbedView = parseReviewEmbedViewMode(body.defaultEmbedView);
  const { error } = await auth.sb.from("restaurant_review_settings").upsert(
    {
      restaurant_id: restaurantId,
      default_embed_view: defaultEmbedView,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await revalidatePublicReviewsEmbedForRestaurant(auth.sb, restaurantId);

  return NextResponse.json({ ok: true, defaultEmbedView });
}
