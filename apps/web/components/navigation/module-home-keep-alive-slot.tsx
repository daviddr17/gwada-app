"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useModuleHomeSlot } from "@/lib/contexts/module-home-keep-alive-context";
import { getAppScrollRoot } from "@/lib/layout/app-scroll-root";
import {
  isModuleHomePath,
  type ModuleHomeId,
} from "@/lib/navigation/module-home-keep-alive";
import { cn } from "@/lib/utils";

export type ModuleHomeKeepAliveRenderProps = {
  /** Interaktiv / echte Route (nicht Soft-Nav-Preview). */
  active: boolean;
  /** Titel + Subnav registrieren — auch während Soft-Nav-Preview/Pending. */
  showChrome: boolean;
};

/**
 * Hält ein Modul-Home warm unter der App-Shell.
 * Soft-Nav weg: verstecken. Live/Glocke bleiben app-weit.
 * Scroll-Position pro Home merken und beim Zurückkehren wiederherstellen.
 */
export function ModuleHomeKeepAliveSlot({
  id,
  className,
  children,
}: {
  id: ModuleHomeId;
  /** z. B. Nachrichten: `lg:h-full lg:overflow-hidden` — Scrollport füllen. */
  className?: string;
  children: (slot: ModuleHomeKeepAliveRenderProps) => ReactNode;
}) {
  const pathname = usePathname();
  const { warm, visible, active } = useModuleHomeSlot(id);
  const onHome = isModuleHomePath(pathname, id);
  const savedScrollTopRef = useRef(0);
  const wasVisibleRef = useRef(visible);
  // false — erster aktiver Mount soll restore (0) statt fremde Scroll-Pos behalten.
  const wasActiveRef = useRef(false);
  // Nur der sichtbare Slot darf Chrome setzen — sonst bleibt die alte
  // Überschrift/Chips über dem Ziel-Preview (oder umgekehrt).
  const showChrome = visible;

  useLayoutEffect(() => {
    const root = getAppScrollRoot();
    if (!root) return;

    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (wasVisible && !visible) {
      savedScrollTopRef.current = root.scrollTop;
    }
  }, [visible]);

  useLayoutEffect(() => {
    const root = getAppScrollRoot();
    if (!root) return;

    const wasActive = wasActiveRef.current;
    wasActiveRef.current = active;

    // Pending-Preview → echte Route, oder erster Besuch / Rückkehr.
    if (!wasActive && active && onHome) {
      root.scrollTop = savedScrollTopRef.current;
    }
  }, [active, onHome]);

  if (!warm && !onHome) return null;

  // Pending-Preview darf sichtbar sein, aber nie klickbar bevor `active`
  // (sonst pathname-relative router.push auf fremde Module).
  const interactive = active;

  return (
    <div
      data-module-home-keep-alive={id}
      className={cn(
        visible
          ? active
            ? "relative min-h-full"
            : "absolute inset-0 z-10 min-h-full bg-background"
          : "hidden",
        !interactive && "pointer-events-none",
        className,
      )}
      aria-hidden={!interactive}
      {...(!interactive ? ({ inert: "" } as Record<string, string>) : {})}
    >
      {children({ active, showChrome })}
    </div>
  );
}
