import * as SecureStore from "expo-secure-store";
import { createMobileSupabaseClient, type GwadaSupabaseClient } from "@gwada/supabase";
import { getStaffSupabaseAnonKey, getStaffSupabaseUrl } from "@/src/lib/env";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: GwadaSupabaseClient | null = null;

export function getStaffSupabase(): GwadaSupabaseClient {
  if (client) return client;

  client = createMobileSupabaseClient(getStaffSupabaseUrl(), getStaffSupabaseAnonKey(), {
    authStorage: secureStoreAdapter,
  });
  return client;
}

/** After `.env` / app.config change during dev — call before retrying login. */
export function resetStaffSupabaseClient(): void {
  client = null;
}
