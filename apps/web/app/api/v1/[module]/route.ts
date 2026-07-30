import {
  handleRestaurantApiV1Get,
  handleRestaurantApiV1ReservationCreate,
} from "@/lib/api/restaurant-api-v1-handler";
import {
  handleRestaurantApiPreflight,
  buildRestaurantApiCorsHeaders,
} from "@/lib/api/restaurant-api-auth-server";
import { restaurantApiModuleByPath } from "@/lib/api/restaurant-api-modules";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ module: string }> },
) {
  const { module: rawModule } = await ctx.params;
  const meta = restaurantApiModuleByPath(rawModule);
  if (!meta) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return handleRestaurantApiV1Get(request, meta.id);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ module: string }> },
) {
  const { module: rawModule } = await ctx.params;
  const meta = restaurantApiModuleByPath(rawModule);
  if (!meta) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (meta.id === "reservation") {
    return handleRestaurantApiV1ReservationCreate(request);
  }
  return Response.json({ error: "method_not_allowed" }, { status: 405 });
}

export async function OPTIONS(request: Request) {
  const preflight = handleRestaurantApiPreflight(request);
  if (preflight) return preflight;
  return new Response(null, {
    status: 204,
    headers: buildRestaurantApiCorsHeaders(request, []),
  });
}
