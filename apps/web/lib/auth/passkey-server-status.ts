import "server-only";

import { getSupabaseAnonKey, isPublicPasskeyEnabled } from "@/lib/public-env";
import { getSupabaseUpstreamUrl } from "@/lib/supabase/resolve-url";

const MIN_GOTRUE_PASSKEY_VERSION = { major: 2, minor: 188, patch: 0 };

function parseGoTrueVersion(raw: string | undefined | null): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(raw?.trim() ?? "");
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function versionAtLeast(
  version: { major: number; minor: number; patch: number },
  min: typeof MIN_GOTRUE_PASSKEY_VERSION,
): boolean {
  if (version.major !== min.major) return version.major > min.major;
  if (version.minor !== min.minor) return version.minor > min.minor;
  return version.patch >= min.patch;
}

export type PasskeyServerStatus = {
  available: boolean;
  reason?: string;
  gotrueVersion?: string | null;
};

export async function fetchPasskeyServerStatus(): Promise<PasskeyServerStatus> {
  if (!isPublicPasskeyEnabled()) {
    return { available: false, reason: "app_flag_disabled" };
  }

  const upstream = getSupabaseUpstreamUrl();
  const anonKey = getSupabaseAnonKey();
  if (!upstream || !anonKey) {
    return { available: false, reason: "misconfigured" };
  }

  let gotrueVersion: string | null = null;
  const authHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  try {
    const healthRes = await fetch(`${upstream}/auth/v1/health`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (healthRes.ok) {
      const health = (await healthRes.json()) as { version?: string };
      gotrueVersion = health.version?.trim() ?? null;
    }
  } catch {
    return { available: false, reason: "health_unreachable", gotrueVersion };
  }

  const parsed = parseGoTrueVersion(gotrueVersion);
  if (!parsed || !versionAtLeast(parsed, MIN_GOTRUE_PASSKEY_VERSION)) {
    return {
      available: false,
      reason: "gotrue_too_old",
      gotrueVersion,
    };
  }

  try {
    const optionsRes = await fetch(
      `${upstream}/auth/v1/passkeys/authentication/options`,
      {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      },
    );
    if (optionsRes.status === 404) {
      return {
        available: false,
        reason: "passkeys_route_missing",
        gotrueVersion,
      };
    }
  } catch {
    return { available: false, reason: "passkeys_probe_failed", gotrueVersion };
  }

  return { available: true, gotrueVersion };
}
