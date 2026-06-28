import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  businessCardDesignForPersistence,
  parseBusinessCardDesign,
} from "@/lib/restaurant/business-card-design";
import {
  fetchBusinessCardDesignFromDb,
  upsertBusinessCardDesignInDb,
} from "@/lib/supabase/restaurant-business-card-design-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const design = await fetchBusinessCardDesignFromDb(sb, auth.restaurantId);

  return Response.json({ design });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    design?: unknown;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const parsed = parseBusinessCardDesign(body.design);
  if (!parsed) {
    return Response.json({ error: "invalid_design" }, { status: 400 });
  }

  const design = businessCardDesignForPersistence(parsed);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await upsertBusinessCardDesignInDb(
    admin,
    auth.restaurantId,
    design,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, design });
}
