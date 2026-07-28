import { after } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayDeviceFromCookies } from "@/lib/display/display-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isLocalDayKey } from "@/lib/staff/shift-schedule-range";
import { isPlatformWeatherAvailableAdmin } from "@/lib/supabase/platform-weather-secrets-db";
import { buildVisualCrossingLocation } from "@/lib/weather/visual-crossing-location";
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key";
import { parseShiftPlanWeatherByDate } from "@/lib/weather/shift-plan-day-weather-data";
import { displayWeatherFromTimeline } from "@/lib/weather/weather-summary";
import type { VisualCrossingTimelineResponse } from "@/lib/weather/visual-crossing-types";
import {
  fetchVisualCrossingTimeline,
  readWeatherTimelineCache,
  weatherTimelineCacheKey,
  writeWeatherTimelineCache,
} from "@/lib/weather/weather-timeline-cache-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  const dayParam = new URL(req.url).searchParams.get("day")?.trim() ?? "";
  const dayForecast = Boolean(dayParam && isLocalDayKey(dayParam));

  const from = dayForecast ? dayParam : null;
  const to = dayForecast ? dayParam : null;
  const timelinePath = dayForecast
    ? `timeline/${pathLoc}/${dayParam}/${dayParam}`
    : `timeline/${pathLoc}/today`;
  const cacheKey = weatherTimelineCacheKey({ location, from, to });
  const cached = await readWeatherTimelineCache(cacheKey);

  const respondTimeline = (data: VisualCrossingTimelineResponse) => {
    if (dayForecast) {
      const forecast = parseShiftPlanWeatherByDate(data).get(dayParam) ?? null;
      return Response.json({
        available: true as const,
        restaurant_id: restaurant.id as string,
        day: dayParam,
        forecast,
      });
    }

    const payload = displayWeatherFromTimeline(data);
    return Response.json({
      available: true as const,
      restaurant_id: restaurant.id as string,
      ...payload,
    });
  };

  if (cached && !cached.stale) {
    return respondTimeline(cached.data);
  }

  if (cached?.stale) {
    after(() => {
      void fetchVisualCrossingTimeline({
        apiKey,
        pathLoc,
        from,
        to,
        timelinePath,
      }).then(async (upstream) => {
        if (!upstream.ok) return;
        await writeWeatherTimelineCache({
          cacheKey,
          location,
          from,
          to,
          data: upstream.data,
        });
      });
    });
    return respondTimeline(cached.data);
  }

  const upstream = await fetchVisualCrossingTimeline({
    apiKey,
    pathLoc,
    from,
    to,
    timelinePath,
  });
  if (!upstream.ok) {
    return Response.json({ available: false as const }, { status: 502 });
  }

  await writeWeatherTimelineCache({
    cacheKey,
    location,
    from,
    to,
    data: upstream.data,
  });

  return respondTimeline(upstream.data);
}
