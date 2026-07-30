import {
  listMenuSideConfigs,
  upsertMenuItemSideConfig,
} from "@/lib/pos/pos-menu-side-config-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const items = await listMenuSideConfigs(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ items });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    menuItemId?: string;
    sidePriceCents?: number | null;
    required?: boolean;
    maxSides?: number;
    includedCount?: number;
    clearConfig?: boolean;
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

  const menuItemId = body.menuItemId?.trim() ?? "";
  if (!menuItemId) return posError("invalid_request", 400);

  const item = await upsertMenuItemSideConfig({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    menuItemId,
    sidePriceCents:
      body.sidePriceCents === undefined
        ? null
        : body.sidePriceCents == null
          ? null
          : Math.round(Number(body.sidePriceCents)),
    required: Boolean(body.required),
    maxSides: Number(body.maxSides ?? 1),
    includedCount: Number(body.includedCount ?? 0),
    clearConfig: Boolean(body.clearConfig),
  });
  if (!item) return posError("save_failed", 500);
  return posJson({ item });
}
