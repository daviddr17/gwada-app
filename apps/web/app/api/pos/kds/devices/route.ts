import {
  deletePosKdsDevice,
  listPosKdsDevices,
  upsertPosKdsDevice,
} from "@/lib/pos/pos-kds-server";
import { isPosOrderCourse, type PosOrderCourse } from "@gwada/pos-domain";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const devices = await listPosKdsDevices(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ devices });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    id?: string;
    name?: string;
    menuCategoryIds?: string[];
    courses?: string[];
    settings?: Record<string, unknown>;
    isActive?: boolean;
    delete?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  if (body.delete && body.id) {
    const ok = await deletePosKdsDevice(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
      body.id,
    );
    return ok ? posJson({ ok: true }) : posError("delete_failed", 500);
  }

  const name = body.name?.trim() ?? "";
  if (!name) return posError("invalid_name", 400);

  const courses = (body.courses ?? []).filter(isPosOrderCourse) as PosOrderCourse[];
  const device = await upsertPosKdsDevice({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    id: body.id,
    name,
    menuCategoryIds: body.menuCategoryIds ?? [],
    courses,
    settings: body.settings,
    isActive: body.isActive,
  });

  if (!device) return posError("save_failed", 500);
  return posJson({ device });
}
