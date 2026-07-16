import {
  listPosCategoryRoutes,
  upsertPosCategoryRoute,
} from "@/lib/pos/pos-category-routes-server";
import {
  isPosRouteDestination,
  type PosRouteDestination,
} from "@gwada/pos-domain";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const routes = await listPosCategoryRoutes(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ routes });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    menuCategoryId?: string;
    destination?: string;
    kdsDeviceIds?: string[];
    printerIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const menuCategoryId = body.menuCategoryId?.trim() ?? "";
  if (!menuCategoryId) return posError("invalid_category", 400);
  if (!isPosRouteDestination(body.destination)) {
    return posError("invalid_destination", 400);
  }

  const route = await upsertPosCategoryRoute({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    menuCategoryId,
    destination: body.destination as PosRouteDestination,
    kdsDeviceIds: body.kdsDeviceIds ?? [],
    printerIds: body.printerIds ?? [],
  });

  if (!route) return posError("save_failed", 500);
  return posJson({ route });
}
