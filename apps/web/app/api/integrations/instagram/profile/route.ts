import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import {
  fetchInstagramBusinessProfile,
  updateInstagramBusinessProfile,
} from "@/lib/integrations/instagram-profile-server";
import type { IntegrationPlatformProfile } from "@/lib/integrations/platform-profile-types";

export const dynamic = "force-dynamic";

function parseProfileBody(raw: unknown): IntegrationPlatformProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === "string" ? o.name : "",
    description: typeof o.description === "string" ? o.description : "",
    phone: typeof o.phone === "string" ? o.phone : "",
    website: typeof o.website === "string" ? o.website : "",
    address: typeof o.address === "string" ? o.address : "",
  };
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeInstagramRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await fetchInstagramBusinessProfile(auth.ctx.restaurantId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true, profile: result.profile });
}

export async function PATCH(req: Request) {
  let body: { restaurantId?: string; profile?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await authorizeInstagramRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const profile = parseProfileBody(body.profile);
  if (!profile) {
    return Response.json({ error: "invalid_profile" }, { status: 400 });
  }

  const result = await updateInstagramBusinessProfile(
    auth.ctx.restaurantId,
    profile,
  );
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
