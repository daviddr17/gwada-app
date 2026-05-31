"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { RouteSweepOverlay, sweepDurationMs } from "@/components/layout/route-sweep-overlay";
import { AUTH_ENTER_APP_META } from "@/lib/navigation/auth-enter-transition";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";

function AuthEnterRedirect() {
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));
  const reducedMotion = useReducedMotion() ?? false;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const ms = sweepDurationMs("marketing", reducedMotionRef.current);
    const timer = window.setTimeout(() => {
      window.location.assign(next);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [next]);

  return (
    <RouteSweepOverlay meta={AUTH_ENTER_APP_META} variant="marketing" className="z-[130]" />
  );
}

export default function AuthEnterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
          Weiterleitung…
        </div>
      }
    >
      <AuthEnterRedirect />
    </Suspense>
  );
}
