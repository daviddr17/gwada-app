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

    const ping = () => {
      void touchProfileLastSeen(sb);
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        runWhenIdle(ping, 2500);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
