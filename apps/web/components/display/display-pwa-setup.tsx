"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DISPLAY_PWA_SCOPE,
  DISPLAY_PWA_SW_PATH,
  displayPwaIconPath,
  displayPwaManifestPath,
  normalizeDisplayPwaRestaurantSlug,
} from "@/lib/display/display-pwa-config";
import { PWA_APP_LABEL_DISPLAY } from "@/lib/pwa/pwa-app-labels";
import { isStandalonePwaClient } from "@/lib/pwa/is-standalone-pwa-client";
import { syncAppleTouchIcon } from "@/lib/pwa/sync-apple-touch-icon";
import { syncAppleWebAppTitle } from "@/lib/pwa/sync-apple-web-app-title";

function displaySlugFromPathname(pathname: string): string | null {
  const match = /^\/display\/([^/]+)\/?$/.exec(pathname);
  return normalizeDisplayPwaRestaurantSlug(match?.[1]);
}

/** Registriert den Display-Service-Worker (nur unter /display). */
export function DisplayPwaSetup() {
  const pathname = usePathname();

  useEffect(() => {
    syncAppleWebAppTitle(PWA_APP_LABEL_DISPLAY);
    if (isStandalonePwaClient()) {
      syncAppleTouchIcon(displayPwaIconPath(180));
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register(DISPLAY_PWA_SW_PATH, { scope: DISPLAY_PWA_SCOPE })
      .catch(() => {
        /* Offline/Private Mode — Install bleibt ggf. über Browser-Menü möglich. */
      });
  }, []);

  useEffect(() => {
    const slug = displaySlugFromPathname(pathname ?? "");
    const href = displayPwaManifestPath(slug);
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }, [pathname]);

  return null;
}
