import { NextResponse } from "next/server";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { isReviewPlatform } from "@/lib/constants/review-platforms";
import {
  fetchReviewAutoReplyRules,
  upsertReviewAutoReplyRules,
} from "@/lib/reviews/review-settings-db";
import {
  defaultReviewAutoReplyRules,
  type ReviewAutoReplyRule,
} from "@/lib/reviews/review-settings-types";
import { authorizeReviewsRestaurant } from "@/lib/reviews/route-auth";

export const dynamic = "force-dynamic";

function normalizeRules(input: unknown): ReviewAutoReplyRule[] | null {
  if (!Array.isArray(input)) return null;
  const defaults = defaultReviewAutoReplyRules();
  const byKey = new Map(defaults.map((rule) => [`${rule.platform}:${rule.rating}`, rule]));

  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    const platform = o.platform;
    const rating = Number(o.rating);
    if (typeof platform !== "string" || !isReviewPlatform(platform)) continue;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    byKey.set(`${platform}:${rating}`, {
      platform,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      enabled: Boolean(o.enabled),
      replyTemplate:
        typeof o.replyTemplate === "string" ? o.replyTemplate : "",
    });
  }

  return [...byKey.values()];
}

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const rules = await fetchReviewAutoReplyRules(auth.sb, restaurantId);
  return NextResponse.json({ rules });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    rules?: unknown;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeReviewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const rules = normalizeRules(body.rules);
  if (!rules) {
    return NextResponse.json({ error: "invalid_rules" }, { status: 400 });
  }

  const result = await upsertReviewAutoReplyRules(auth.sb, restaurantId, rules);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
