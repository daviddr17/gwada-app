import {
  parseSocialBrandKitFromClientBody,
} from "@/lib/social/social-brand-kit";
import {
  fetchSocialBrandKitFromDb,
  upsertSocialBrandKitInDb,
} from "@/lib/social/social-brand-kit-db";
import { authorizeSocialBrandKitRestaurant } from "@/lib/social/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeSocialBrandKitRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const kit = await fetchSocialBrandKitFromDb(auth.sb, restaurantId);
  return Response.json({ kit });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    kit?: unknown;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeSocialBrandKitRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const kit = parseSocialBrandKitFromClientBody(restaurantId, body.kit ?? body);
  if (!kit) {
    return Response.json({ error: "invalid_kit" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await upsertSocialBrandKitInDb(admin, kit);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, kit });
}
