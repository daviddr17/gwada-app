import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { fetchStaffModuleSettingsServer } from "@/lib/staff/staff-module-settings-server";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveLinkedStaffId(
  admin: SupabaseClient,
  restaurantId: string,
  profileId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

export async function assertProfileDisplayPinSelfService(params: {
  restaurantId: string;
  userId: string;
}): Promise<
  | { ok: true; staffId: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const settings = await fetchStaffModuleSettingsServer(params.restaurantId);
  if (!settings.profileAllowDisplayPinSelfService) {
    return { ok: false, error: "self_service_disabled", status: 403 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const staffId = await resolveLinkedStaffId(
    admin,
    params.restaurantId,
    params.userId,
  );
  if (!staffId) {
    return { ok: false, error: "no_staff_profile", status: 404 };
  }

  return { ok: true, staffId };
}

export async function verifyUserAccountPassword(params: {
  email: string;
  password: string;
  origin?: string | null;
}): Promise<{ ok: true } | { ok: false; error: "invalid_password" }> {
  const anonKey = getSupabaseAnonKey();
  const url = resolveSupabaseUrl(params.origin ?? null);
  if (!anonKey || !url) {
    return { ok: false, error: "invalid_password" };
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  if (error) {
    return { ok: false, error: "invalid_password" };
  }

  return { ok: true };
}

export async function readProfileDisplayPinStatus(params: {
  restaurantId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      hasPin: boolean;
      setAt: string | null;
      selfServiceEnabled: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const settings = await fetchStaffModuleSettingsServer(params.restaurantId);
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const staffId = await resolveLinkedStaffId(
    admin,
    params.restaurantId,
    params.userId,
  );
  if (!staffId) {
    return {
      ok: true,
      hasPin: false,
      setAt: null,
      selfServiceEnabled: settings.profileAllowDisplayPinSelfService,
    };
  }

  const { data: staff } = await admin
    .from("restaurant_staff")
    .select("display_pin_set_at")
    .eq("id", staffId)
    .maybeSingle();

  return {
    ok: true,
    hasPin: Boolean(staff?.display_pin_set_at),
    setAt: (staff?.display_pin_set_at as string | null) ?? null,
    selfServiceEnabled: settings.profileAllowDisplayPinSelfService,
  };
}

export async function setProfileDisplayPinSelfService(params: {
  restaurantId: string;
  userId: string;
  userEmail: string | null;
  password: string;
  pin: string | null;
  origin?: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  if (!params.userEmail?.trim()) {
    return { ok: false, error: "password_auth_required", status: 400 };
  }

  const access = await assertProfileDisplayPinSelfService({
    restaurantId: params.restaurantId,
    userId: params.userId,
  });
  if (!access.ok) {
    return access;
  }

  const passwordCheck = await verifyUserAccountPassword({
    email: params.userEmail.trim(),
    password: params.password,
    origin: params.origin,
  });
  if (!passwordCheck.ok) {
    return { ok: false, error: "invalid_password", status: 401 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  if (params.pin === null || params.pin === "") {
    const { error } = await admin.rpc("clear_restaurant_staff_display_pin", {
      p_staff_id: access.staffId,
    });
    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    return { ok: true };
  }

  const pin = params.pin.trim();
  if (!/^[0-9]{4}$/.test(pin)) {
    return { ok: false, error: "pin_format", status: 400 };
  }

  const { error } = await admin.rpc("set_restaurant_staff_display_pin", {
    p_staff_id: access.staffId,
    p_pin: pin,
  });

  if (error) {
    const msg = error.message.includes("bereits")
      ? "pin_duplicate"
      : error.message;
    return { ok: false, error: msg, status: 400 };
  }

  return { ok: true };
}
