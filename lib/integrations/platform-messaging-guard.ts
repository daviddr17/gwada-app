import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertPlatformWhatsappEnabled(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flags = await fetchPlatformMessagingFlags(sb);
  if (!flags.whatsappEnabled) {
    return { ok: false, error: "whatsapp_disabled" };
  }
  return { ok: true };
}

export async function assertPlatformEmailEnabled(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flags = await fetchPlatformMessagingFlags(sb);
  if (!flags.emailEnabled) {
    return { ok: false, error: "email_disabled" };
  }
  return { ok: true };
}

export async function assertPlatformFacebookEnabled(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flags = await fetchPlatformMessagingFlags(sb);
  if (!flags.facebookEnabled) {
    return { ok: false, error: "facebook_disabled" };
  }
  return { ok: true };
}

export async function assertPlatformInstagramEnabled(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flags = await fetchPlatformMessagingFlags(sb);
  if (!flags.instagramEnabled) {
    return { ok: false, error: "instagram_disabled" };
  }
  return { ok: true };
}

export async function assertPlatformGoogleBusinessEnabled(
  sb: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const flags = await fetchPlatformMessagingFlags(sb);
  if (!flags.googleBusinessEnabled) {
    return { ok: false, error: "google_business_disabled" };
  }
  return { ok: true };
}
