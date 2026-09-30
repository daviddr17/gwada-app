import { restaurantAssistantToPublic } from "@/lib/integrations/restaurant-assistant-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteRestaurantAssistantKeyAdmin,
  fetchRestaurantAssistantKeyAdmin,
  saveRestaurantAssistantKeyAdmin,
} from "@/lib/supabase/restaurant-assistant-key-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

async function assertCanManage(restaurantId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: restaurantId,
    p_permission: "integrations.assistant",
  });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const auth = await assertCanManage(restaurantId);
  if (!auth.ok) return Response.json({ error: "forbidden" }, { status: auth.status });

  const row = await fetchRestaurantAssistantKeyAdmin(restaurantId);
  return Response.json(restaurantAssistantToPublic(row));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    provider?: string;
    apiKey?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const auth = await assertCanManage(restaurantId);
  if (!auth.ok) return Response.json({ error: "forbidden" }, { status: auth.status });

  const saved = await saveRestaurantAssistantKeyAdmin({
    restaurantId,
    provider: body.provider,
    apiKey: body.apiKey,
  });
  if (saved.error) {
    return Response.json({ error: saved.error }, { status: 400 });
  }
  return Response.json({
    provider: saved.provider,
    apiKeyConfigured: saved.configured,
  });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const auth = await assertCanManage(restaurantId);
  if (!auth.ok) return Response.json({ error: "forbidden" }, { status: auth.status });
  const removed = await deleteRestaurantAssistantKeyAdmin(restaurantId);
  if (removed.error) return Response.json({ error: removed.error }, { status: 500 });
  return Response.json({ provider: "openai", apiKeyConfigured: false });
}
