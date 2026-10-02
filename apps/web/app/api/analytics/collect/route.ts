import { NextResponse } from "next/server";
import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";
import {
  analyticsCollectIsBot,
  applyAnalyticsCookies,
  recordModuleView,
  recordPlatformLogin,
  recordWebsitePageView,
  resolveUsageRestaurantId,
} from "@/lib/analytics/platform-analytics-write";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function empty(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (analyticsCollectIsBot(request)) return empty();

  // IP nur als flüchtiger Rate-Limit-Schlüssel, nie in der Statistik.
  const ip = getRequestClientIp(request);
  const limit = checkInMemoryRateLimit(`analytics-collect:${ip}`, 90, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    path?: unknown;
    referrer?: unknown;
    restaurantId?: unknown;
    loginMethod?: unknown;
  } | null;
  if (!body || (body.kind !== "page_view" && body.kind !== "module_view" && body.kind !== "login")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return empty();

  if (body.kind === "page_view") {
    const path = typeof body.path === "string" ? body.path.slice(0, 300) : "";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;
    const ids = await recordWebsitePageView({ admin, request, path, referrer });
    const response = empty();
    if (ids) applyAnalyticsCookies(response, ids);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty();

  if (body.kind === "login") {
    const method = typeof body.loginMethod === "string" ? body.loginMethod : "unknown";
    await recordPlatformLogin({ admin, profileId: user.id, method });
    return empty();
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 300) : "";
  const restaurantRaw = typeof body.restaurantId === "string" ? body.restaurantId : null;
  const restaurantId = await resolveUsageRestaurantId(admin, user.id, restaurantRaw);
  await recordModuleView({ admin, profileId: user.id, path, restaurantId });
  return empty();
}
