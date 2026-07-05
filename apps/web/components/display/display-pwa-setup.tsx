"use client";

import { useEffect } from "react";
import {
  DISPLAY_PWA_SCOPE,
  DISPLAY_PWA_SW_PATH,
} from "@/lib/display/display-pwa-config";

/** Registriert den Display-Service-Worker (nur unter /display). */
export function DisplayPwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register(DISPLAY_PWA_SW_PATH, { scope: DISPLAY_PWA_SCOPE })
      .catch(() => {
        /* Offline/Private Mode — Install bleibt ggf. über Browser-Menü möglich. */
      });
  }, []);

  return null;
}
