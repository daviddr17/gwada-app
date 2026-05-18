"use client";

import { useEffect } from "react";
import {
  isExpectedSupabaseAuthNetworkFailure,
  shouldSuppressExpectedSupabaseConsoleArgs,
} from "@/lib/supabase/expected-network-failures";

/**
 * Unterdrückt erwartbare Supabase-Auth-Netzwerkfehler app-weit (Safari: TypeError „Load failed“),
 * damit die Konsole / das Next-Dev-Overlay nicht von harmlosen Offline-/Netzwerk-Fetches überflutet werden.
 */
export function SuppressExpectedSupabaseNetworkNoise() {
  useEffect(() => {
    const onRejection = (ev: PromiseRejectionEvent) => {
      if (isExpectedSupabaseAuthNetworkFailure(ev.reason)) {
        ev.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);

    const orig = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (shouldSuppressExpectedSupabaseConsoleArgs(args)) return;
      orig(...args);
    };

    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = orig;
    };
  }, []);

  return null;
}
