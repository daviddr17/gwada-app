import * as SecureStore from "expo-secure-store";
import { resetStaffSupabaseClient } from "@/src/lib/supabase";

const STORAGE_KEY = "gwada_staff_lan_host";

let runtimeLanHost: string | null = null;
let initialized = false;

/** IPv4 oder kurzer Hostname (kein Schema/Pfad). */
export function parseLanHostInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("://")) {
      const url = new URL(trimmed);
      const host = url.hostname.trim();
      return host || null;
    }
    const withoutPath = trimmed.split("/")[0]!.trim();
    const host = withoutPath.split(":")[0]!.trim();
    if (!host) return null;
    if (/^[a-zA-Z0-9.-]+$/.test(host)) return host;
    return null;
  } catch {
    return null;
  }
}

export function getRuntimeLanHost(): string | null {
  return runtimeLanHost;
}

export function isStaffLanHostReady(): boolean {
  return initialized;
}

export async function initStaffLanHost(): Promise<void> {
  if (initialized) return;
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    runtimeLanHost = stored ? parseLanHostInput(stored) : null;
  } catch {
    runtimeLanHost = null;
  }
  initialized = true;
}

export async function setStaffLanHost(raw: string): Promise<string> {
  const host = parseLanHostInput(raw);
  if (!host) {
    throw new Error("Ungültige Adresse — z. B. 192.168.178.94");
  }
  await SecureStore.setItemAsync(STORAGE_KEY, host);
  runtimeLanHost = host;
  resetStaffSupabaseClient();
  return host;
}

export async function clearStaffLanHost(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  runtimeLanHost = null;
  resetStaffSupabaseClient();
}

export function lanUrlsFromHost(host: string): {
  supabaseUrl: string;
  gwadaApiUrl: string;
} {
  const base = host.replace(/\/$/, "");
  return {
    supabaseUrl: `http://${base}:54321`,
    gwadaApiUrl: `http://${base}:3000`,
  };
}
