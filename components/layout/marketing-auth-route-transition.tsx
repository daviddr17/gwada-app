"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Home, LogIn } from "lucide-react";
import {
  RouteSweepOverlay,
  type RouteSweepMeta,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";

const MARKETING_ROUTES = new Set(["/", "/login"]);

const MARKETING_META: Record<string, RouteSweepMeta> = {
  "/login": {
    id: "marketing-login",
    label: "Anmelden",
    subtitle: "Dein Restaurant-Bereich",
    Icon: LogIn,
    iconClassName: "bg-accent/15 text-accent-foreground",
  },
  "/": {
    id: "marketing-home",
    label: "Startseite",
    subtitle: "Zurück zur Übersicht",
    Icon: Home,
    iconClassName: "bg-muted/80 text-foreground",
  },
};

function normalizeMarketingPath(pathname: string): string | null {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return MARKETING_ROUTES.has(path) ? path : null;
}

/** Sweep beim Wechsel zwischen Startseite und Anmeldung. */
export function MarketingAuthRouteTransition() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const prevPathRef = useRef(pathname);
  const [overlayMeta, setOverlayMeta] = useState<RouteSweepMeta | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = normalizeMarketingPath(prevPathRef.current);
    const next = normalizeMarketingPath(pathname);
    prevPathRef.current = pathname;

    if (!prev || !next || prev === next) return;

    const meta = MARKETING_META[next];
    if (!meta) return;

    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
    }

    setOverlayMeta(meta);
    const totalMs = sweepDurationMs("marketing", reducedMotionRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setOverlayMeta(null);
      clearTimerRef.current = null;
    }, totalMs);
  }, [pathname]);

  useEffect(() => {
    if (!overlayMeta) return;
    const failsafe = window.setTimeout(() => setOverlayMeta(null), 2500);
    return () => window.clearTimeout(failsafe);
  }, [overlayMeta]);

  useEffect(
    () => () => {
      if (clearTimerRef.current != null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  return <RouteSweepOverlay meta={overlayMeta} variant="marketing" />;
}
