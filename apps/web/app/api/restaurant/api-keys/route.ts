import { NextResponse } from "next/server";
import {
  createRestaurantApiKey,
  listRestaurantApiKeys,
  normalizeAllowedOrigins,
} from "@/lib/api/restaurant-api-keys-server";
import { normalizeRestaurantApiModuleIds } from "@/lib/api/restaurant-api-modules";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";

export async function GET(request: Request) {
  const restaurantId = new URL(request.url).searchParams.get("restaurantId")?.trim();
  if (!restaurantId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "settings.api");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const keys = await listRestaurantApiKeys(restaurantId);
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    name?: string;
    enabledModules?: unknown;
    allowedOrigins?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim();
  if (!restaurantId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "settings.api");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const enabledModules = normalizeRestaurantApiModuleIds(body.enabledModules);
  const allowedOrigins = normalizeAllowedOrigins(body.allowedOrigins);

  const result = await createRestaurantApiKey({
    restaurantId,
    name: body.name ?? "",
    enabledModules,
    allowedOrigins,
    createdByProfileId: auth.userId,
  });

  if (!result.ok) {
    const status =
      result.error === "invalid_name" || result.error === "modules_required"
        ? 400
        : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    secret: result.secret,
    key: result.key,
  });
}
