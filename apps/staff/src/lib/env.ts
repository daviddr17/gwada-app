import Constants from "expo-constants";
import { staffEnv } from "@/src/lib/staff-env.generated";

type StaffExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  gwadaApiUrl?: string;
};

function staffExtra(): StaffExtra {
  return (Constants.expoConfig?.extra ?? {}) as StaffExtra;
}

export function getStaffSupabaseUrl(): string {
  const fromGenerated = staffEnv.supabaseUrl.trim();
  const fromExtra = staffExtra().supabaseUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return fromGenerated || fromExtra || fromEnv || "http://127.0.0.1:54321";
}

export function getStaffSupabaseAnonKey(): string {
  const fromGenerated = staffEnv.supabaseAnonKey.trim();
  const fromExtra = staffExtra().supabaseAnonKey?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = fromGenerated || fromExtra || fromEnv || "";
  if (!key) {
    throw new Error(
      "Missing Supabase anon key — set EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/staff/.env, then restart Metro (-c)",
    );
  }
  return key;
}

export function getGwadaApiBaseUrl(): string {
  const fromGenerated = staffEnv.gwadaApiUrl.trim();
  const fromExtra = staffExtra().gwadaApiUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_GWADA_API_URL?.trim();
  const raw = fromGenerated || fromExtra || fromEnv;
  if (!raw) {
    throw new Error(
      "Missing EXPO_PUBLIC_GWADA_API_URL — set to http://127.0.0.1:3000 for simulator",
    );
  }
  return raw.replace(/\/$/, "");
}

/** Dev-only: verify anon key is wired (prefix only). */
export function getStaffSupabaseAnonKeyHint(): string {
  const key = getStaffSupabaseAnonKey();
  return `${key.slice(0, 18)}…`;
}
