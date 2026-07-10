"use client";

import { useEffect, useState } from "react";
import { browserSupportsPasskeys } from "@/lib/auth/passkey-auth";
import { isPublicPasskeyEnabled } from "@/lib/public-env";

/** Login: Passkey-Button nur wenn Server + Browser bereit. */
export function usePasskeyLoginAvailability() {
  const [browserReady, setBrowserReady] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const appFlagReady = isPublicPasskeyEnabled();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!browserSupportsPasskeys()) {
        if (!cancelled) setBrowserReady(false);
        return;
      }
      try {
        const platform =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!cancelled) setBrowserReady(platform);
      } catch {
        if (!cancelled) setBrowserReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!appFlagReady) {
      setServerReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/passkey-status", {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setServerReady(false);
          return;
        }
        const body = (await res.json()) as { available?: boolean };
        if (!cancelled) setServerReady(body.available === true);
      } catch {
        if (!cancelled) setServerReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appFlagReady]);

  return {
    showPasskey: appFlagReady && browserReady && serverReady,
    serverReady: appFlagReady && serverReady,
    browserReady,
  };
}
