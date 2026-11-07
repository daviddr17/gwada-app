import {
  normalizeMollieTerminalId,
} from "@/lib/ordering/guest-kiosk-device-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const { data, error } = await authResult.auth.supabase
    .from("restaurant_guest_kiosk_devices")
    .select(
      "id, restaurant_id, name, mollie_terminal_id, is_active, created_at, updated_at",
    )
    .eq("restaurant_id", authResult.auth.restaurantId)
    .order("created_at", { ascending: true });

  if (error) return posError(error.message, 500);

  const ids = (data ?? []).map((r) => r.id as string);
  const installationsByDevice = new Map<
    string,
    {
      id: string;
      installation_id: string;
      last_seen_at: string;
      user_agent: string | null;
      created_at: string;
    }[]
  >();

  if (ids.length > 0) {
    const { data: instRows } = await authResult.auth.supabase
      .from("restaurant_guest_kiosk_installations")
      .select(
        "id, device_id, installation_id, last_seen_at, user_agent, created_at",
      )
      .in("device_id", ids)
      .order("last_seen_at", { ascending: false });
    for (const row of instRows ?? []) {
      const deviceId = row.device_id as string;
      const list = installationsByDevice.get(deviceId) ?? [];
      list.push({
        id: row.id as string,
        installation_id: row.installation_id as string,
        last_seen_at: row.last_seen_at as string,
        user_agent: (row.user_agent as string | null) ?? null,
        created_at: row.created_at as string,
      });
      installationsByDevice.set(deviceId, list);
    }
  }

  return posJson({
    devices: (data ?? []).map((row) => {
      const installations = installationsByDevice.get(row.id as string) ?? [];
      return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        mollieTerminalId: row.mollie_terminal_id,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isPaired: installations.length > 0,
        installationCount: installations.length,
        installations,
        lastSeenAt: installations[0]?.last_seen_at ?? null,
      };
    }),
  });
}

export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    name?: string;
    mollieTerminalId?: string | null;
    isActive?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const name = body.name?.trim() ?? "";
  if (!name || name.length > 80) {
    return posError("invalid_name", 400);
  }

  const terminal = normalizeMollieTerminalId(body.mollieTerminalId);
  if (body.mollieTerminalId?.trim() && !terminal) {
    return posError("invalid_terminal", 400);
  }

  const { data, error } = await authResult.auth.supabase
    .from("restaurant_guest_kiosk_devices")
    .insert({
      restaurant_id: authResult.auth.restaurantId,
      name,
      mollie_terminal_id: terminal,
      is_active: body.isActive ?? true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return posError(error?.message ?? "create_failed", 500);
  }

  return posJson({ id: data.id as string });
}
