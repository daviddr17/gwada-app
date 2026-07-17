import {
  deletePosKdsStatus,
  ensureDefaultPosKdsStatuses,
  normalizeKdsStatusColor,
  reorderPosKdsStatuses,
  upsertPosKdsStatus,
} from "@/lib/pos/pos-kds-statuses-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const statuses = await ensureDefaultPosKdsStatuses(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );
  return posJson({ statuses });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    id?: string;
    name?: string;
    color?: string;
    printOnEnter?: boolean;
    printerIds?: string[];
    isActive?: boolean;
    sortOrder?: number;
    orderedIds?: string[];
    delete?: boolean;
    reorder?: boolean;
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

  if (body.reorder && Array.isArray(body.orderedIds)) {
    const ok = await reorderPosKdsStatuses({
      supabase: authResult.auth.supabase,
      restaurantId: authResult.auth.restaurantId,
      orderedIds: body.orderedIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    });
    return ok ? posJson({ ok: true }) : posError("reorder_failed", 500);
  }

  if (body.delete && body.id) {
    const ok = await deletePosKdsStatus(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
      body.id,
    );
    return ok ? posJson({ ok: true }) : posError("delete_failed", 500);
  }

  const name = body.name?.trim() ?? "";
  if (!name) return posError("invalid_name", 400);
  const color = normalizeKdsStatusColor(body.color ?? "");
  if (!color) return posError("invalid_color", 400);

  const status = await upsertPosKdsStatus({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    id: body.id,
    name,
    color,
    printOnEnter: body.printOnEnter,
    printerIds: body.printerIds,
    isActive: body.isActive,
    sortOrder: body.sortOrder,
  });

  if (!status) return posError("save_failed", 500);
  return posJson({ status });
}
