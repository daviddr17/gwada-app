import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashDisplayToken } from "@/lib/display/display-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function upsertDisplayInstallation(params: {
  displayId: string;
  installationId: string;
  deviceToken: string;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const installationId = params.installationId.trim();
  if (installationId.length < 8 || installationId.length > 128) {
    return { ok: false, error: "invalid_installation_id" };
  }

  const deviceHash = hashDisplayToken(params.deviceToken);
  const now = new Date().toISOString();

  const { error: instError } = await admin
    .from("restaurant_display_installations")
    .upsert(
      {
        display_id: params.displayId,
        installation_id: installationId,
        device_secret_hash: deviceHash,
        user_agent: params.userAgent?.slice(0, 500) ?? null,
        last_seen_at: now,
      },
      { onConflict: "display_id,installation_id" },
    );

  if (instError) return { ok: false, error: instError.message };

  const { error: displayError } = await admin
    .from("restaurant_displays")
    .update({ device_secret_hash: deviceHash })
    .eq("id", params.displayId);

  if (displayError) return { ok: false, error: displayError.message };

  return { ok: true };
}

export async function deleteDisplayInstallations(
  displayId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_display_installations")
    .delete()
    .eq("display_id", displayId);
  await admin
    .from("restaurant_displays")
    .update({ device_secret_hash: null })
    .eq("id", displayId);
}

export async function touchDisplayInstallation(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  displayId: string,
  installationId: string,
): Promise<void> {
  await admin
    .from("restaurant_display_installations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("display_id", displayId)
    .eq("installation_id", installationId);
}

export async function findDisplayIdForDeviceToken(
  admin: SupabaseClient,
  displayId: string,
  token: string,
): Promise<boolean> {
  const hash = hashDisplayToken(token);

  const { data: inst } = await admin
    .from("restaurant_display_installations")
    .select("id")
    .eq("display_id", displayId)
    .eq("device_secret_hash", hash)
    .maybeSingle();

  if (inst) return true;

  const { data: display } = await admin
    .from("restaurant_displays")
    .select("device_secret_hash")
    .eq("id", displayId)
    .maybeSingle();

  return (display?.device_secret_hash as string | null) === hash;
}

export async function findDisplayIdForInstallationCredentials(params: {
  displayId: string;
  installationId: string;
  token: string;
}): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const hash = hashDisplayToken(params.token);
  const { data } = await admin
    .from("restaurant_display_installations")
    .select("id")
    .eq("display_id", params.displayId)
    .eq("installation_id", params.installationId.trim())
    .eq("device_secret_hash", hash)
    .maybeSingle();

  return Boolean(data);
}

export async function displayHasInstallations(displayId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { count } = await admin
    .from("restaurant_display_installations")
    .select("id", { count: "exact", head: true })
    .eq("display_id", displayId);
  return (count ?? 0) > 0;
}
