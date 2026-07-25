"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useModuleHomeSlot } from "@/lib/contexts/module-home-keep-alive-context";
import {
  isModuleHomePath,
  type ModuleHomeId,
} from "@/lib/navigation/module-home-keep-alive";
import { cn } from "@/lib/utils";

/**
 * Hält ein Modul-Home warm unter der App-Shell.
 * Soft-Nav weg: verstecken. Live/Glocke bleiben app-weit.
 */
export function ModuleHomeKeepAliveSlot({
  id,
  children,
}: {
  id: ModuleHomeId;
  children: (active: boolean) => ReactNode;
}) {
  const pathname = usePathname();
  const { warm, visible, active } = useModuleHomeSlot(id);
  const onHome = isModuleHomePath(pathname, id);
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

  // Pending-Preview darf sichtbar sein, aber nie klickbar bevor `active`
  // (sonst pathname-relative router.push auf fremde Module).
  const interactive = active;

  return (
    <div
      data-module-home-keep-alive={id}
      className={cn(
        visible
          ? onHome
            ? "relative"
            : "absolute inset-0 z-10 min-h-full bg-background"
          : "hidden",
        !interactive && "pointer-events-none",
      )}
      aria-hidden={!interactive}
      {...(!interactive ? ({ inert: "" } as Record<string, string>) : {})}
    >
      {children(active)}
    </div>
  );
}
