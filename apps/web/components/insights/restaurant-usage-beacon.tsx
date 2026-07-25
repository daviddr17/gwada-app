"use client";

import { useEffect, useRef } from "react";
import type { RestaurantUsageSource } from "@/lib/insights/restaurant-usage-constants";

const SESSION_KEY = "gwada_usage_sid";

function getOrCreateSessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Einmaliger Beacon (sessionStorage-Session, 1×/Tag server-seitig).
 * SendBeacon bevorzugt — überlebt Navigation; fallback fetch keepalive.
 */
export function reportRestaurantUsageBeacon(params: {
  slug: string;
  source: Exclude<RestaurantUsageSource, "api">;
  dimension: string;
}): void {
  if (typeof window === "undefined") return;
  const slug = params.slug.trim().toLowerCase();
  if (!slug) return;
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;

  const payload = JSON.stringify({
    slug,
    source: params.source,
    dimension: params.dimension,
    sessionId,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/public/usage", blob);
      return;
    }
  } catch {
    /* fallback */
  }

  void fetch("/api/public/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    cache: "no-store",
  }).catch(() => {
    /* ignore */
  });
}

export function RestaurantUsageBeacon({
  slug,
  source,
  dimension,
}: {
  slug: string;
  source: Exclude<RestaurantUsageSource, "api">;
  dimension: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      if (sent.current) return;
      sent.current = true;
      reportRestaurantUsageBeacon({ slug, source, dimension });
    };

    /** Nach Load + Idle — nicht mit LCP/Hero-Bildern konkurrieren. */
    const schedule = () => {
      const win = window as Window & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (win.requestIdleCallback) {
        idleId = win.requestIdleCallback(fire, { timeout: 5000 });
        return;
      }
      timeoutId = globalThis.setTimeout(fire, 2000);
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      window.removeEventListener("load", schedule);
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timeoutId != null) globalThis.clearTimeout(timeoutId);
    };
  }, [slug, source, dimension]);

  return null;
}
