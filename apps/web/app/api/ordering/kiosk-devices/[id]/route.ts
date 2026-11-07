import {
  deleteGuestKioskInstallations,
  normalizeMollieTerminalId,
} from "@/lib/ordering/guest-kiosk-device-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function assertDeviceManage(deviceId: string) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "unauthorized", status: 401 };
  }

  const { data: device } = await sb
    .from("restaurant_guest_kiosk_devices")
    .select("id, restaurant_id, name, mollie_terminal_id, is_active")
    .eq("id", deviceId)
    .maybeSingle();

  if (!device) {
    return { ok: false as const, error: "not_found", status: 404 };
  }

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: device.restaurant_id,
    p_permission: "pos.kasse.manage",
  });
  if (!allowed) {
    return { ok: false as const, error: "forbidden", status: 403 };
  }

  return { ok: true as const, sb, device };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await assertDeviceManage(id);
  if (!auth.ok) return posError(auth.error, auth.status);

  let body: {
    name?: string;
    mollieTerminalId?: string | null;
    isActive?: boolean;
    unpair?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return posError("invalid_request", 400);
  }

  if (body.unpair) {
    await deleteGuestKioskInstallations(id);
    return posJson({ ok: true, unpaired: true });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) return posError("invalid_name", 400);
    patch.name = name;
  }
  if (body.mollieTerminalId !== undefined) {
    const terminal = normalizeMollieTerminalId(body.mollieTerminalId);
    if (body.mollieTerminalId?.trim() && !terminal) {
      return posError("invalid_terminal", 400);
    }
    patch.mollie_terminal_id = terminal;
  }
  if (typeof body.isActive === "boolean") {
    patch.is_active = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return posJson({ ok: true });
  }

  const { error } = await auth.sb
    .from("restaurant_guest_kiosk_devices")
    .update(patch)
    .eq("id", id);

  if (error) return posError(error.message, 500);
  return posJson({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await assertDeviceManage(id);
  if (!auth.ok) return posError(auth.error, auth.status);

  await deleteGuestKioskInstallations(id);
  const { error } = await auth.sb
    .from("restaurant_guest_kiosk_devices")
    .delete()
    .eq("id", id);

  if (error) return posError(error.message, 500);
  return posJson({ ok: true });
}
