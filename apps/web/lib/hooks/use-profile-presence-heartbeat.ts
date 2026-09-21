"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { touchProfileLastSeen } from "@/lib/supabase/profile-presence-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const HEARTBEAT_MS = 60_000;

/** Hält `profiles.last_seen_at` für Online-Anzeige im Superadmin aktuell. */
export function useProfilePresenceHeartbeat(): void {
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    let intervalId: number | null = null;

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      void touchProfileLastSeen(sb);
    };

    const stopInterval = () => {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const startInterval = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(ping, HEARTBEAT_MS);
    };

    if (document.visibilityState === "visible") {
      ping();
      startInterval();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runWhenIdle(ping, 2_500);
        startInterval();
        return;
      }
      stopInterval();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
