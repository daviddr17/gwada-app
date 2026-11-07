import { generateGuestKioskPairingCode } from "@/lib/ordering/guest-kiosk-device-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return posError("unauthorized", 401);

  const { data: device } = await sb
    .from("restaurant_guest_kiosk_devices")
    .select("id, restaurant_id, name")
    .eq("id", id)
    .maybeSingle();

  if (!device) return posError("not_found", 404);

  const { data: allowed } = await sb.rpc("auth_has_restaurant_permission", {
    p_restaurant_id: device.restaurant_id,
    p_permission: "pos.kasse.manage",
  });
  if (!allowed) return posError("forbidden", 403);

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("slug")
    .eq("id", device.restaurant_id)
    .maybeSingle();

  const admin = createSupabaseAdminClient();
  if (!admin) return posError("server_misconfigured", 503);

  await admin
    .from("restaurant_guest_kiosk_pairing_codes")
    .delete()
    .eq("device_id", id);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let code = generateGuestKioskPairingCode();
  let insertError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin
      .from("restaurant_guest_kiosk_pairing_codes")
      .insert({
        device_id: id,
        code,
        expires_at: expiresAt,
      });
    if (!error) {
      insertError = null;
      break;
    }
    if (error.code === "23505") {
      code = generateGuestKioskPairingCode();
      continue;
    }
    insertError = error.message;
    break;
  }

  if (insertError) return posError(insertError, 500);

  const slug = (restaurant?.slug as string | undefined) ?? "";
  const pairPath = slug
    ? `/kiosk/${encodeURIComponent(slug)}?pair=${code}`
    : `/kiosk/pair?code=${code}`;

  return posJson({
    code,
    expires_at: expiresAt,
    device_name: device.name,
    pair_url: pairPath,
  });
}
