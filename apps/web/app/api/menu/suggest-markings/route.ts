import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { suggestFoodMarkings } from "@/lib/menu/suggest-markings-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const restaurantId =
    typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";
  const name = typeof o.name === "string" ? o.name : "";
  const description =
    typeof o.description === "string" ? o.description : undefined;
  const kindRaw = typeof o.kind === "string" ? o.kind : "";
  const kind = kindRaw === "dish" ? "dish" : kindRaw === "ingredient" ? "ingredient" : null;

  if (!isUuidRestaurantId(restaurantId) || !kind) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const permissionPrefix = kind === "ingredient" ? "inventory" : "menu";
  const auth = await authorizeModuleCrud(restaurantId, permissionPrefix, "update");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await suggestFoodMarkings({
    restaurantId,
    kind,
    name,
    description,
  });

  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        codes: [],
        aiConfigured: result.aiConfigured,
      },
      { status: result.status },
    );
  }

  return Response.json({
    codes: result.codes,
    aiConfigured: true,
    provider: result.provider,
    model: result.model,
  });
}
