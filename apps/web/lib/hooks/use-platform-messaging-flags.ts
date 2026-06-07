"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";

export type PlatformMessagingFlagsState = PlatformMessagingFlags & {
  loading: boolean;
};

export function usePlatformMessagingFlags(
  initial?: PlatformMessagingFlags | null,
): PlatformMessagingFlagsState {
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    initial?.whatsappEnabled ?? false,
  );
  const [emailEnabled, setEmailEnabled] = useState(initial?.emailEnabled ?? false);
  const [facebookEnabled, setFacebookEnabled] = useState(
    initial?.facebookEnabled ?? false,
  );
  const [instagramEnabled, setInstagramEnabled] = useState(
    initial?.instagramEnabled ?? false,
  );
  const [googleBusinessEnabled, setGoogleBusinessEnabled] = useState(
    initial?.googleBusinessEnabled ?? false,
  );
  const [loading, setLoading] = useState(initial == null);

  const applyFlags = useCallback((flags: PlatformMessagingFlags) => {
    setWhatsappEnabled(flags.whatsappEnabled);
    setEmailEnabled(flags.emailEnabled);
    setFacebookEnabled(flags.facebookEnabled);
    setInstagramEnabled(flags.instagramEnabled);
    setGoogleBusinessEnabled(flags.googleBusinessEnabled);
  }, []);

  const load = useCallback(async () => {
    if (initial == null) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/platform/messaging-flags", {
        cache: "no-store",
      });
      if (!res.ok) {
        applyFlags({
          whatsappEnabled: false,
          emailEnabled: false,
          facebookEnabled: false,
          instagramEnabled: false,
          googleBusinessEnabled: false,
        });
        setLoading(false);
        return;
      }
      const data = (await res.json()) as PlatformMessagingFlags;
      applyFlags({
        whatsappEnabled: data.whatsappEnabled === true,
        emailEnabled: data.emailEnabled === true,
        facebookEnabled: data.facebookEnabled === true,
        instagramEnabled: data.instagramEnabled === true,
        googleBusinessEnabled: data.googleBusinessEnabled === true,
      });
    } catch {
      applyFlags({
        whatsappEnabled: false,
        emailEnabled: false,
        facebookEnabled: false,
        instagramEnabled: false,
        googleBusinessEnabled: false,
      });
    }
    setLoading(false);
  }, [applyFlags, initial]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return {
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    instagramEnabled,
    googleBusinessEnabled,
    loading,
  };
}
