import { staffPosPermissionKeys } from "@/lib/pos/pos-device-auth-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { closeWaiterCashBag } from "@/lib/pos/waiter-cash-bag-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CloseBody = {
  bagId?: string;
  closingCountCents?: number;
  managerPin?: string;
};

async function resolveManagerOverride(
  restaurantId: string,
  managerPin: string | undefined,
): Promise<
  | { ok: true; verified: false }
  | { ok: true; verified: true; profileId: string }
  | { ok: false; error: string; status: number }
> {
  const pin = managerPin?.trim() ?? "";
  if (!pin) {
    return { ok: true, verified: false };
  }

  if (!/^[0-9]{4}$/.test(pin)) {
    return { ok: false, error: "invalid_manager_pin", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 500 };
  }

  const { data: resolved } = await admin.rpc(
    "resolve_restaurant_staff_by_display_pin",
    {
      p_restaurant_id: restaurantId,
      p_pin: pin,
    },
  );
  const staffId = (resolved as string | null) ?? null;
  if (!staffId) {
    return { ok: false, error: "invalid_manager_pin", status: 403 };
  }

  const keys = await staffPosPermissionKeys(staffId);
  if (!keys.has("pos.kasse.manage")) {
    return { ok: false, error: "manager_pin_forbidden", status: 403 };
  }

  const { data: staff } = await admin
    .from("restaurant_staff")
    .select("profile_id")
    .eq("id", staffId)
    .maybeSingle();

  const profileId = (staff?.profile_id as string | null)?.trim() ?? "";
  if (!profileId) {
    return { ok: false, error: "manager_profile_missing", status: 403 };
  }

  return { ok: true, verified: true, profileId };
}

export async function POST(request: Request) {
  const restaurantId = new URL(request.url).searchParams.get("restaurantId");

  const auth = await authorizePosRestaurant(request, restaurantId);
  if (!auth.ok) {
    return posError(auth.error, auth.status);
  }

  if (!auth.auth.userId) {
    return posError("cashier_required", 403);
  }

  let body: CloseBody;
  try {
    body = (await request.json()) as CloseBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const bagId = body.bagId?.trim() ?? "";
  if (!bagId) {
    return posError("invalid_bag_id", 400);
  }

  if (body.closingCountCents == null || !Number.isFinite(body.closingCountCents)) {
    return posError("invalid_closing_count_cents", 400);
  }

  const manager = await resolveManagerOverride(
    auth.auth.restaurantId,
    body.managerPin,
  );
  if (!manager.ok) {
    return posError(manager.error, manager.status);
  }

  const result = await closeWaiterCashBag({
    restaurantId: auth.auth.restaurantId,
    bagId,
    closingCountCents: body.closingCountCents,
    closedByProfileId: auth.auth.userId,
    managerOverrideProfileId: manager.verified ? manager.profileId : null,
    managerPinVerified: manager.verified,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson(result);
}
