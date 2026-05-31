"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { LayoutDashboard, Shield } from "lucide-react";
import {
  RouteSweepOverlay,
  type RouteSweepMeta,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";

type WorkspaceZone = "superadmin" | "app";

function zoneFromPathname(pathname: string): WorkspaceZone {
  return pathname.startsWith("/superadmin") ? "superadmin" : "app";
}

const ZONE_META: Record<WorkspaceZone, RouteSweepMeta> = {
  superadmin: {
    id: "zone-superadmin",
    label: "Superadmin",
    subtitle: "Plattform & Mandanten",
    Icon: Shield,
    iconClassName: "bg-violet-500/15 text-violet-700 dark:text-violet-200",
    accentClassName:
      "from-violet-600/88 via-indigo-500/55 to-transparent",
  },
  app: {
    id: "zone-app",
    label: "Dashboard",
    subtitle: "Restaurant-Bereich",
    Icon: LayoutDashboard,
    iconClassName: "bg-accent/15 text-accent-foreground",
    accentClassName:
      "from-[color-mix(in_oklch,var(--accent)_82%,transparent)] via-[color-mix(in_oklch,var(--accent)_38%,transparent)] to-transparent",
  },
};

/** Kurzer Vollbild-Übergang beim Wechsel zwischen Superadmin und App. */
export function WorkspaceZoneTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const zone = zoneFromPathname(pathname);
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const prevZoneRef = useRef(zone);
  const [overlayMeta, setOverlayMeta] = useState<RouteSweepMeta | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevZoneRef.current;
    if (prev === zone) return;
    prevZoneRef.current = zone;

    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
    }

    setOverlayMeta(ZONE_META[zone]);
    clearTimerRef.current = window.setTimeout(() => {
      setOverlayMeta(null);
      clearTimerRef.current = null;
    }, sweepDurationMs("workspace", reducedMotionRef.current));
  }, [zone]);

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

  return (
    <>
      {children}
      <RouteSweepOverlay meta={overlayMeta} variant="workspace" />
    </>
  );
}
