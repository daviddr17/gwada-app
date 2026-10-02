"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { websiteAnalyticsTarget } from "@/lib/analytics/classify-analytics-path";

const recent = new Map<string, number>();

function shouldSend(key: string): boolean {
  const now = Date.now();
  const prev = recent.get(key) ?? 0;
  if (now - prev < 1200) return false;
  recent.set(key, now);
  return true;
}

/** Öffentliche Seiten. Die angemeldete App hat einen eigenen Beacon. */
export function WebsiteAnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !websiteAnalyticsTarget(pathname)) return;
    if (!shouldSend(`page:${pathname}`)) return;
    const referrer =
      typeof document !== "undefined" && document.referrer.length > 0 && document.referrer.length < 500
        ? document.referrer
        : undefined;
    void fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ kind: "page_view", path: pathname, referrer }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
