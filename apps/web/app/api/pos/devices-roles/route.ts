import {
  createPosDeviceEnrollment,
  deactivatePosDevice,
  listPosCapabilities,
  listPosDevices,
  listPosRoles,
  setPosRoleCapabilities,
} from "@/lib/pos/pos-capabilities-devices-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const [capabilities, roles, devices] = await Promise.all([
    listPosCapabilities(authResult.auth.supabase),
    listPosRoles(authResult.auth.supabase, authResult.auth.restaurantId),
    listPosDevices(authResult.auth.supabase, authResult.auth.restaurantId),
  ]);

  return posJson({ capabilities, roles, devices });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    action?: string;
    roleId?: string;
    capabilityKeys?: string[];
    name?: string;
    kind?: "hub" | "handheld";
    deviceId?: string;
    ttlHours?: number;
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

  const action = body.action?.trim() ?? "";

  if (action === "set_role_capabilities") {
    if (!body.roleId || !Array.isArray(body.capabilityKeys)) {
      return posError("invalid_request", 400);
    }
    const ok = await setPosRoleCapabilities({
      supabase: authResult.auth.supabase,
      restaurantId: authResult.auth.restaurantId,
      roleId: body.roleId,
      capabilityKeys: body.capabilityKeys,
    });
    return ok ? posJson({ ok: true }) : posError("save_failed", 500);
  }

  if (action === "create_enrollment") {
    const name = body.name?.trim() ?? "";
    const kind = body.kind === "hub" ? "hub" : "handheld";
    if (!name) return posError("invalid_name", 400);
    const created = await createPosDeviceEnrollment({
      supabase: authResult.auth.supabase,
      restaurantId: authResult.auth.restaurantId,
      name,
      kind,
      ttlHours: body.ttlHours,
    });
    if (!created) return posError("save_failed", 500);
    return posJson(created);
  }

  if (action === "deactivate_device") {
    if (!body.deviceId) return posError("invalid_request", 400);
    const ok = await deactivatePosDevice(
      authResult.auth.supabase,
      authResult.auth.restaurantId,
      body.deviceId,
    );
    return ok ? posJson({ ok: true }) : posError("delete_failed", 500);
  }

  return posError("unknown_action", 400);
}
