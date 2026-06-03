"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformOAuthAvailability } from "@/lib/types/platform-oauth-availability";

const EMPTY: PlatformOAuthAvailability = {
  googleReady: false,
  googleEnabled: false,
  appleReady: false,
  appleEnabled: false,
};

/** Login/Registrierung: Buttons nur wenn Superadmin aktiv + Zugangsdaten vollständig. */
export function oauthProviderShownInLogin(
  flags: PlatformOAuthAvailability,
  provider: "google" | "apple",
): boolean {
  if (provider === "google") {
    return flags.googleEnabled && flags.googleReady;
  }
  return flags.appleEnabled && flags.appleReady;
}

export function anyOAuthProviderShownInLogin(
  flags: PlatformOAuthAvailability,
): boolean {
  return (
    oauthProviderShownInLogin(flags, "google") ||
    oauthProviderShownInLogin(flags, "apple")
  );
}

export function usePublicOAuthAvailability() {
  const [flags, setFlags] = useState<PlatformOAuthAvailability>(EMPTY);
  const [resolved, setResolved] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/public/oauth-flags", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as PlatformOAuthAvailability;
      setFlags({
        googleReady: data.googleReady === true,
        googleEnabled: data.googleEnabled === true,
        appleReady: data.appleReady === true,
        appleEnabled: data.appleEnabled === true,
      });
    } catch {
      setFlags(EMPTY);
    } finally {
      setResolved(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return {
    flags,
    resolved,
    reload,
    showGoogle: oauthProviderShownInLogin(flags, "google"),
    showApple: oauthProviderShownInLogin(flags, "apple"),
    showOAuthSection: anyOAuthProviderShownInLogin(flags),
  };
}
