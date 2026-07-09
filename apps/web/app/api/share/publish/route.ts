import { NextResponse } from "next/server";
import {
  isShareChannelKey,
  isShareSourceType,
} from "@/lib/constants/share-channels";
import { getShareChannelPublicInfo } from "@/lib/share/share-channels-server";
import { publishShareToChannels } from "@/lib/share/share-publish-server";
import { authorizeShareRestaurant } from "@/lib/share/route-auth";
import type { ShareChannelKey } from "@/lib/constants/share-channels";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const restaurantId =
    typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";
  const sourceTypeRaw =
    typeof o.sourceType === "string" ? o.sourceType.trim() : "";
  const title =
    typeof o.title === "string" ? o.title.trim() || null : null;
  const textBody = typeof o.body === "string" ? o.body.trim() : "";
  const link =
    typeof o.link === "string" ? o.link.trim() || null : null;

  if (!isShareSourceType(sourceTypeRaw)) {
    return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
  }

  const auth = await authorizeShareRestaurant(restaurantId, sourceTypeRaw);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rawChannels = Array.isArray(o.channels) ? o.channels : [];
  const channels: ShareChannelKey[] = [];
  for (const item of rawChannels) {
    if (typeof item === "string" && isShareChannelKey(item)) {
      channels.push(item);
    }
  }
  if (channels.length === 0) {
    return NextResponse.json({ error: "no_channels_selected" }, { status: 400 });
  }

  const imageUrls: string[] = [];
  if (Array.isArray(o.imageUrls)) {
    for (const item of o.imageUrls) {
      if (typeof item === "string" && item.trim()) {
        imageUrls.push(item.trim());
      }
    }
  }

  const available = await getShareChannelPublicInfo(restaurantId);
  const availableConnected = new Set(
    available.filter((c) => c.connected).map((c) => c.key),
  );
  for (const key of channels) {
    if (!availableConnected.has(key)) {
      return NextResponse.json(
        { error: "channel_not_connected", channel: key },
        { status: 400 },
      );
    }
  }

  const result = await publishShareToChannels({
    restaurantId,
    sb: auth.sb,
    title,
    body: textBody,
    imageUrls,
    link,
    channels,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const failed = Object.entries(result.results).filter(
    ([, r]) => r && !r.ok,
  );
  const succeeded = Object.entries(result.results).filter(
    ([, r]) => r?.ok,
  );

  return NextResponse.json({
    ok: true,
    publishedCount: succeeded.length,
    failedCount: failed.length,
    results: result.results,
  });
}
