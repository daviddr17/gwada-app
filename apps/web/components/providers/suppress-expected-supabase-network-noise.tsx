"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  isExpectedSupabaseAuthNetworkFailure,
  isTransientNetworkToastMessage,
  shouldSuppressExpectedSupabaseConsoleArgs,
} from "@/lib/supabase/expected-network-failures";

type ToastErrorFn = typeof toast.error;

/**
 * Unterdrückt erwartbare Netzwerkfehler app-weit:
 * - unhandledrejection / console (Supabase Auth, Safari „Load failed“)
 * - Sonner `toast.error(…)` mit denselben Transient-Texten
 *   (sonst erscheinen sie „random“ aus Keep-alive-Fetches)
 */
export function SuppressExpectedSupabaseNetworkNoise() {
  useEffect(() => {
    const onRejection = (ev: PromiseRejectionEvent) => {
      if (isExpectedSupabaseAuthNetworkFailure(ev.reason)) {
        ev.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);

    const origConsole = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (shouldSuppressExpectedSupabaseConsoleArgs(args)) return;
      origConsole(...args);
    };

    const origToastError = toast.error.bind(toast) as ToastErrorFn;
    toast.error = ((message: unknown, data?: unknown) => {
      if (isTransientNetworkToastMessage(message)) return "";
      if (
        data &&
        typeof data === "object" &&
        "description" in data &&
        isTransientNetworkToastMessage(
          (data as { description?: unknown }).description,
        )
      ) {
        return "";
      }
      return origToastError(
        message as Parameters<ToastErrorFn>[0],
        data as Parameters<ToastErrorFn>[1],
      );
    }) as ToastErrorFn;

    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = origConsole;
      toast.error = origToastError;
    };
  }, []);

  return null;
}
