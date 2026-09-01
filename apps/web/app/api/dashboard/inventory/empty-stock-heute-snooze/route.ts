import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  fetchEmptyStockHeuteSnoozedIngredientIds,
  snoozeEmptyStockHeuteIngredient,
} from "@/lib/inventory/empty-stock-heute-snooze-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId")?.trim();
  if (!restaurantId) {
    return Response.json({ error: "missing_restaurant_id" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const ids = await fetchEmptyStockHeuteSnoozedIngredientIds(sb, auth.restaurantId);
  return Response.json({ ingredientIds: [...ids] });
}

export async function POST(req: Request) {
  let body: { restaurantId?: string; ingredientId?: string };
  try {
    body = (await req.json()) as { restaurantId?: string; ingredientId?: string };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim();
  const ingredientId = body.ingredientId?.trim();
  if (!restaurantId || !ingredientId) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const result = await snoozeEmptyStockHeuteIngredient(sb, {
    restaurantId: auth.restaurantId,
    ingredientId,
    profileId: auth.userId,
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
