"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FullscreenOverlayFloatingPortalContext } from "@/lib/contexts/fullscreen-overlay-floating-portal";
import { cn } from "@/lib/utils";
import { APP_LAYER_Z_INDEX, appLayerFloatingInFullscreenOverlayZClassName } from "@/lib/ui/app-layer-z-index";

const APP_FULLSCREEN_OVERLAY_OPEN_MS = 300;
const APP_FULLSCREEN_OVERLAY_CLOSE_MS = 260;

export const APP_FULLSCREEN_OVERLAY_Z_INDEX = APP_LAYER_Z_INDEX.fullscreenOverlay;

/**
 * Scroll-Bereich in Vollbild-Overlays (Formulare, Listen) — nur vertikal.
 * Tabellen-Vollbild: `moduleTableFullscreenBodyScrollClassName` (beide Achsen).
 */
export const appFullscreenOverlayScrollClassName =
  "min-h-0 min-w-0 flex-1 basis-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain [-webkit-overflow-scrolling:touch]";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type AppFullscreenOverlayProps = {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Vollbild-Overlay mit sticky Kopf-/Fußleiste — z. B. Vertragserstellung. */
export function AppFullscreenOverlay({
  open,
  onClose,
  header,
  footer,
  children,
  className,
  "aria-label": ariaLabel = "Vollbild",
}: AppFullscreenOverlayProps) {
  const [mounted, setMounted] = useState(open);
  const [presented, setPresented] = useState(false);
  const [floatingPortalHost, setFloatingPortalHost] =
    useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (prefersReducedMotion()) {
        setPresented(true);
        return;
      }
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresented(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setPresented(false);
    const unmountMs = prefersReducedMotion() ? 0 : APP_FULLSCREEN_OVERLAY_CLOSE_MS;
    const timer = window.setTimeout(() => setMounted(false), unmountMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const motionReduced = prefersReducedMotion();
  const transitionMs = presented
    ? APP_FULLSCREEN_OVERLAY_OPEN_MS
    : APP_FULLSCREEN_OVERLAY_CLOSE_MS;

  return createPortal(
    <FullscreenOverlayFloatingPortalContext.Provider value={floatingPortalHost}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "fixed inset-0 flex flex-col overscroll-none bg-background touch-manipulation",
          className,
        )}
        style={{
          zIndex: APP_FULLSCREEN_OVERLAY_Z_INDEX,
          transform: presented ? undefined : "translate3d(0, 100%, 0)",
          transition: motionReduced
            ? "none"
            : presented
              ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: motionReduced || presented ? undefined : "transform",
        }}
      >
        <header className="sticky top-0 z-20 shrink-0 border-b border-border/50 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-backdrop-filter:bg-background/85">
          {header}
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        {footer ? (
          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md supports-backdrop-filter:bg-background/85">
            {footer}
          </footer>
        ) : null}

        <div
          ref={setFloatingPortalHost}
          className={cn(
            "pointer-events-none fixed inset-0",
            appLayerFloatingInFullscreenOverlayZClassName,
          )}
          aria-hidden
        />
      </div>
    </FullscreenOverlayFloatingPortalContext.Provider>,
    document.body,
  );
}
