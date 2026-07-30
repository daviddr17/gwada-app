import {
  createPosReservation,
  loadPosReservationsDay,
} from "@/lib/pos/pos-reservations-server";
import { verifyPosDeviceToken } from "@/lib/pos/pos-capabilities-devices-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function resolvePosReadAuth(request: Request, restaurantId: string) {
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (authResult.ok) {
    return {
      ok: true as const,
      restaurantId: authResult.auth.restaurantId,
    };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      error: authResult.error,
      status: authResult.status,
    };
  }
  const deviceId = request.headers.get("x-pos-device-id")?.trim() ?? "";
  const deviceToken = request.headers.get("x-pos-device-token")?.trim() ?? "";
  const deviceAuth = await verifyPosDeviceToken({
    admin,
    deviceId,
    deviceToken,
    restaurantId,
  });
  if (!deviceAuth.ok) {
    return {
      ok: false as const,
      error: authResult.error,
      status: authResult.status,
    };
  }
  return { ok: true as const, restaurantId: deviceAuth.restaurantId };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const day = url.searchParams.get("day")?.trim() || null;

  const auth = await resolvePosReadAuth(request, restaurantId);
  if (!auth.ok) return posError(auth.error, auth.status);

  const data = await loadPosReservationsDay(auth.restaurantId, day);
  if ("error" in data) return posError(data.error, 500);
  return posJson(data);
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    guestFirstName?: string | null;
    guestLastName?: string;
    guestPhone?: string | null;
    guestEmail?: string | null;
    partySize?: number;
    startsAt?: string;
    endsAt?: string;
    statusId?: string | null;
    diningTableId?: string | null;
    dwellMinutes?: number | null;
    notes?: string | null;
    notifyEmail?: boolean;
    notifyWhatsapp?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return posError("invalid_request", 400);
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return posError("invalid_id", 400);
  }

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const result = await createPosReservation({
    restaurantId: authResult.auth.restaurantId,
    profileId: authResult.auth.userId,
    guestFirstName: body.guestFirstName,
    guestLastName: body.guestLastName ?? "",
    guestPhone: body.guestPhone,
    guestEmail: body.guestEmail,
    partySize: Number(body.partySize ?? 0),
    startsAt: body.startsAt?.trim() ?? "",
    endsAt: body.endsAt?.trim() ?? "",
    statusId: body.statusId,
    diningTableId: body.diningTableId,
    dwellMinutes: body.dwellMinutes,
    notes: body.notes,
    notifyEmail: body.notifyEmail,
    notifyWhatsapp: body.notifyWhatsapp,
  });

  if (!result.ok) return posError(result.error, result.status);
  return posJson(result);
}
