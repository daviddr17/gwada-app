import "server-only";

import { randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Stellt sicher, dass das Restaurant ein LAN-Secret hat; liefert es zurück. */
export async function ensurePosLanSharedSecret(
  restaurantId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("restaurants")
    .select("pos_lan_shared_secret")
    .eq("id", restaurantId)
    .maybeSingle();

  const existing = (data?.pos_lan_shared_secret as string | null)?.trim();
  if (existing && existing.length >= 32) return existing;

  const secret = randomBytes(32).toString("hex");
  const { error } = await admin
    .from("restaurants")
    .update({ pos_lan_shared_secret: secret })
    .eq("id", restaurantId);

  if (error) {
    console.warn("[pos] lan secret", error.message);
    return null;
  }
  return secret;
}
