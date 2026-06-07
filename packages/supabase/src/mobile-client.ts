import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type GwadaSupabaseClient = SupabaseClient<Database>;

export type MobileSupabaseClientOptions = {
  /** e.g. Expo SecureStore adapter — required on device; omit only in tests. */
  authStorage?: NonNullable<
    SupabaseClientOptions<Database>["auth"]
  >["storage"];
};

/**
 * Supabase client for React Native / Expo (Staff & Guest apps).
 * Uses direct URL + anon key — no Next.js `/sb` proxy.
 */
export function createMobileSupabaseClient(
  url: string,
  anonKey: string,
  options: MobileSupabaseClientOptions = {},
): GwadaSupabaseClient {
  if (!url.trim()) throw new Error("Missing Supabase URL");
  if (!anonKey.trim()) throw new Error("Missing Supabase anon key");

  return createClient<Database>(url.trim().replace(/\/$/, ""), anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      ...(options.authStorage ? { storage: options.authStorage } : {}),
    },
  });
}
