"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { DashboardHomeScreen } from "@/components/dashboard/dashboard-home-screen";
import {
  useDashboardHomeKeepAlive,
} from "@/lib/contexts/dashboard-home-keep-alive-context";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { cn } from "@/lib/utils";

/**
 * Hält Dashboard-Home warm unter der App-Shell.
 * Soft-Nav zu anderen Modulen: verstecken (kein Unmount).
 * Live/Glocke/Realtime bleiben app-weit — hier nur UI-Persistenz.
 */
export function DashboardHomeKeepAlive() {
  const pathname = usePathname();
  const { warm, visible, active } = useDashboardHomeKeepAlive();
  const onHome = isDashboardHomePath(pathname);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const savedScrollTopRef = useRef(0);
  const wasVisibleRef = useRef(visible);

  useLayoutEffect(() => {
    const root = document.querySelector(
      "[data-app-scroll-root]",
    ) as HTMLElement | null;
    scrollRootRef.current = root;
  }, []);

  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (!root) return;

    if (wasVisible && !visible) {
      savedScrollTopRef.current = root.scrollTop;
      return;
    }

    if (!wasVisible && visible && onHome) {
      root.scrollTop = savedScrollTopRef.current;
    }
  }, [visible, onHome]);

  if (!warm && !onHome) return null;

  return (
    <div
      data-dashboard-home-keep-alive
      className={cn(
        visible
          ? onHome
            ? "relative"
            : "absolute inset-0 z-10 min-h-full bg-background"
          : "hidden",
      )}
      aria-hidden={!visible}
      {...(!visible ? ({ inert: "" } as Record<string, string>) : {})}
    >
      <DashboardHomeScreen active={active} />
    </div>
  );
}
