"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  RouteSweepOverlay,
  type RouteSweepMeta,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";
import {
  WORKSPACE_ZONE_SWEEP_META,
  appZoneFromPath,
  type AppWorkspaceZone,
} from "@/lib/navigation/workspace-zone-meta";

/** Kurzer Vollbild-Übergang bei Zonenwechsel (Superadmin ↔ App). Modul-Wechsel: Soft-Nav ohne Overlay. */
export function WorkspaceZoneTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const zone = appZoneFromPath(pathname);
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const prevZoneRef = useRef<AppWorkspaceZone>(zone);
  const [overlayMeta, setOverlayMeta] = useState<RouteSweepMeta | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevZoneRef.current;
    if (prev === zone) return;
    prevZoneRef.current = zone;

    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
    }

    setOverlayMeta(WORKSPACE_ZONE_SWEEP_META[zone]);
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
