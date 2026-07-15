"use client";

import { useEffect } from "react";
import {
  DASHBOARD_PWA_MANIFEST_PATH,
  DASHBOARD_PWA_SCOPE,
  DASHBOARD_PWA_SW_PATH,
  dashboardPwaIconPath,
} from "@/lib/dashboard/dashboard-pwa-config";
import { PWA_APP_LABEL_DASHBOARD } from "@/lib/pwa/pwa-app-labels";
import { isStandalonePwaClient } from "@/lib/pwa/is-standalone-pwa-client";
import { installDisplayModeAttributeSync } from "@/lib/pwa/sync-display-mode-attribute";
import { syncAppleTouchIcon } from "@/lib/pwa/sync-apple-touch-icon";
import { syncAppleWebAppTitle } from "@/lib/pwa/sync-apple-web-app-title";

/** Registriert den Dashboard-Service-Worker (App-Zone). */
export function DashboardPwaSetup() {
  useEffect(() => {
    return installDisplayModeAttributeSync();
  }, []);

  useEffect(() => {
    syncAppleWebAppTitle(PWA_APP_LABEL_DASHBOARD);
    if (isStandalonePwaClient()) {
      syncAppleTouchIcon(dashboardPwaIconPath(180));
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register(DASHBOARD_PWA_SW_PATH, { scope: DASHBOARD_PWA_SCOPE })
      .catch(() => {
        /* Offline/Private Mode — Install bleibt ggf. über Browser-Menü möglich. */
      });
  }, []);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== DASHBOARD_PWA_MANIFEST_PATH) {
      link.setAttribute("href", DASHBOARD_PWA_MANIFEST_PATH);
    }
  }, []);

  return null;
}
