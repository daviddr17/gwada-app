import { enforcePublicApiWriteRateLimit } from "@/lib/api/public-api-rate-limit";
import {
  enforceUsageBeaconRateLimit,
  recordUsageBeaconEvent,
} from "@/lib/insights/restaurant-usage-server";
import {
  isEmbedUsageDimension,
  isRestaurantUsageSource,
  PROFILE_USAGE_VIEW_DIMENSION,
  profileModuleUsageDimension,
} from "@/lib/insights/restaurant-usage-constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { isReservedRestaurantSlug } from "@/lib/restaurant/reserved-restaurant-slugs";

export const dynamic = "force-dynamic";

type BeaconBody = {
  slug?: string;
  source?: string;
  dimension?: string;
  sessionId?: string;
};

async function resolveRestaurantIdBySlug(
  slug: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function normalizeDimension(
  source: string,
  dimension: string,
): string | null {
  if (source === "embed") {
    return isEmbedUsageDimension(dimension) ? dimension : null;
  }
  if (source === "profile") {
    if (dimension === PROFILE_USAGE_VIEW_DIMENSION) return dimension;
    if (dimension.startsWith("module:")) {
      const moduleId = dimension.slice("module:".length);
      if (/^[a-z0-9_-]{1,32}$/.test(moduleId)) {
        return profileModuleUsageDimension(moduleId);
      }
    }
    return null;
  }
  // API nur serverseitig — Public-Beacon blockieren
  return null;
}

export async function POST(req: Request) {
  const rate =
    enforceUsageBeaconRateLimit(req) ??
    enforcePublicApiWriteRateLimit(req, "usage-beacon");
  if (rate) return rate;

  let body: BeaconBody;
  try {
    body = (await req.json()) as BeaconBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = normalizeRestaurantSlugInput(body.slug ?? "");
  if (!slug || isReservedRestaurantSlug(slug)) {
    return Response.json({ error: "invalid_slug" }, { status: 400 });
  }

  const sourceRaw = (body.source ?? "").trim();
  if (!isRestaurantUsageSource(sourceRaw) || sourceRaw === "api") {
    return Response.json({ error: "invalid_source" }, { status: 400 });
  }

  const dimension = normalizeDimension(
    sourceRaw,
    (body.dimension ?? "").trim().toLowerCase(),
  );
  if (!dimension) {
    return Response.json({ error: "invalid_dimension" }, { status: 400 });
  }

  const sessionId = (body.sessionId ?? "").trim();
  if (!sessionId) {
    return Response.json({ error: "invalid_session" }, { status: 400 });
  }

  const restaurantId = await resolveRestaurantIdBySlug(slug);
  if (!restaurantId) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const result = await recordUsageBeaconEvent({
    request: req,
    restaurantId,
    source: sourceRaw,
    dimension,
    sessionId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json(
    { ok: true, counted: result.counted },
    { headers: { "Cache-Control": "no-store" } },
  );
}
