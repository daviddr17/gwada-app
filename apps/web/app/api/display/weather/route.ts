import { after } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayDeviceFromCookies } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPlatformWeatherAvailableAdmin } from "@/lib/supabase/platform-weather-secrets-db";
import { buildVisualCrossingLocation } from "@/lib/weather/visual-crossing-location";
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key";
import { displayWeatherFromTimeline } from "@/lib/weather/weather-summary";
import {
  fetchVisualCrossingTimeline,
  readWeatherTimelineCache,
  weatherTimelineCacheKey,
  writeWeatherTimelineCache,
} from "@/lib/weather/weather-timeline-cache-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const device = await assertDisplayDeviceFromCookies(cookieStore);
  if (!device.ok) {
    return Response.json({ available: false as const }, { status: device.status });
  }

  const platformAvailable = await isPlatformWeatherAvailableAdmin();
  if (!platformAvailable) {
    return Response.json({ available: false as const });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ available: false as const }, { status: 503 });
  }

  const { data: restaurant, error } = await admin
    .from("restaurants")
    .select("id, city, country")
    .eq("id", device.display.restaurant_id)
    .maybeSingle();

  if (error || !restaurant) {
    return Response.json({ available: false as const }, { status: 404 });
  }

  const apiKey = await getVisualCrossingApiKeyAdmin();
  if (!apiKey) {
    return Response.json({ available: false as const }, { status: 503 });
  }

  const location = buildVisualCrossingLocation({
    city: String(restaurant.city ?? ""),
    country: String(restaurant.country ?? ""),
  });
  const pathLoc = encodeURIComponent(location);
  const timelinePath = `timeline/${pathLoc}/today`;
  const cacheKey = weatherTimelineCacheKey({ location, from: null, to: null });
  const cached = await readWeatherTimelineCache(cacheKey);

  if (cached && !cached.stale) {
    const payload = displayWeatherFromTimeline(cached.data);
    return Response.json({
      available: true as const,
      restaurant_id: restaurant.id as string,
      ...payload,
    });
  }

  if (cached?.stale) {
    after(() => {
      void fetchVisualCrossingTimeline({
        apiKey,
        pathLoc,
        from: null,
        to: null,
        timelinePath,
      }).then(async (upstream) => {
        if (!upstream.ok) return;
        await writeWeatherTimelineCache({
          cacheKey,
          location,
          from: null,
          to: null,
          data: upstream.data,
        });
      });
    });
    const payload = displayWeatherFromTimeline(cached.data);
    return Response.json({
      available: true as const,
      restaurant_id: restaurant.id as string,
      ...payload,
    });
  }

  const upstream = await fetchVisualCrossingTimeline({
    apiKey,
    pathLoc,
    from: null,
    to: null,
    timelinePath,
  });
  if (!upstream.ok) {
    return Response.json({ available: false as const }, { status: 502 });
  }

  await writeWeatherTimelineCache({
    cacheKey,
    location,
    from: null,
    to: null,
    data: upstream.data,
  });

  const payload = displayWeatherFromTimeline(upstream.data);

  return Response.json({
    available: true as const,
    restaurant_id: restaurant.id as string,
    ...payload,
  });
}
