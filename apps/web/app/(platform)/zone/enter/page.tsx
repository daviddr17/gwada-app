"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  RouteSweepOverlay,
  sweepDurationMs,
} from "@/components/layout/route-sweep-overlay";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import {
  WORKSPACE_ZONE_SWEEP_META,
  appZoneFromPath,
} from "@/lib/navigation/workspace-zone-meta";

function ZoneEnterRedirect() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const meta = WORKSPACE_ZONE_SWEEP_META[appZoneFromPath(next)];
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const ms = sweepDurationMs("workspace", reducedMotionRef.current);
    const timer = window.setTimeout(() => {
      window.location.assign(next);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [next]);

  return (
    <RouteSweepOverlay meta={meta} variant="workspace" className="z-[130]" />
  );
}

export default function ZoneEnterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Weiterleitung…
        </div>
      }
    >
      <ZoneEnterRedirect />
    </Suspense>
  );
}
