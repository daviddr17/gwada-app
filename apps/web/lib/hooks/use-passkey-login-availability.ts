"use client";

import { useEffect, useState } from "react";
import { browserSupportsPasskeys } from "@/lib/auth/passkey-auth";
import { isPublicPasskeyEnabled } from "@/lib/public-env";

/** Login: Passkey-Button nur wenn Server + Browser bereit. */
export function usePasskeyLoginAvailability() {
  const [browserReady, setBrowserReady] = useState(false);
  const serverReady = isPublicPasskeyEnabled();

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

  return {
    showPasskey: serverReady && browserReady,
    serverReady,
    browserReady,
  };
}
