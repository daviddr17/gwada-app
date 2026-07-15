"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";

const OPEN_MS = 320;
const CLOSE_MS = 280;
const PANEL_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lockAppScroll(): () => void {
  const root = document.querySelector("[data-app-scroll-root]");
  if (root instanceof HTMLElement) {
    const scrollTop = root.scrollTop;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
      root.scrollTop = scrollTop;
    };
  }
  const prevBody = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = prevBody;
  };
}

type AppMobileChromeScreenProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional Aktion rechts neben dem Titel. */
  headerAction?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/**
 * Einheitliches Mobile-Overlay für Menü/Suche/Benachrichtigungen:
 * Vollfläche bis zur Bottom-Nav; Schließen in der Daumenzone unten.
 */
export function AppMobileChromeScreen({
  open,
  onClose,
  title,
  children,
  headerAction,
  className,
  "aria-label": ariaLabel,
}: AppMobileChromeScreenProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const unlockScrollRef = useRef<(() => void) | null>(null);
  const motionReduced = prefersReducedMotion();

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (motionReduced) setVisible(true);
      return;
    }
    setVisible(false);
    if (motionReduced) {
      setMounted(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      const anotherOpening = document.querySelector(
        '[data-app-mobile-chrome-overlay][data-open="true"]',
      );
      if (anotherOpening) setMounted(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, motionReduced]);

  useLayoutEffect(() => {
    if (!mounted || !open || motionReduced) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [mounted, open, motionReduced]);

  useEffect(() => {
    if (!mounted) return;
    unlockScrollRef.current = lockAppScroll();
    return () => {
      unlockScrollRef.current?.();
      unlockScrollRef.current = null;
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

  const handlePanelTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform") return;
    if (!visible && mounted) setMounted(false);
  };

  if (!mounted || typeof document === "undefined") return null;

  const transitionMs = visible ? OPEN_MS : CLOSE_MS;
  const panelTransform = visible
    ? "translate3d(0, 0, 0)"
    : "translate3d(0, 100%, 0)";

  return createPortal(
    <div
      data-app-mobile-chrome-overlay
      data-open={open ? "true" : "false"}
      className="fixed inset-x-0 top-0 touch-manipulation md:hidden"
      style={{
        zIndex: APP_LAYER_Z_INDEX.stackedSurface,
        bottom: "var(--app-mobile-bottom-nav-offset)",
      }}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "absolute inset-0 bg-background/30 transition-opacity",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          transitionDuration: motionReduced ? "0ms" : `${transitionMs}ms`,
          transitionTimingFunction: PANEL_EASING,
        }}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className={cn(
          "absolute inset-0 flex flex-col overscroll-none bg-background pt-[env(safe-area-inset-top,0px)]",
          "[backface-visibility:hidden] will-change-transform",
          className,
        )}
        style={{
          transform: panelTransform,
          transition: motionReduced
            ? "none"
            : `transform ${transitionMs}ms ${PANEL_EASING}`,
        }}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
            {title}
          </h2>
          {headerAction}
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        <footer
          className={cn(
            "shrink-0 border-t border-border/50 bg-background/95 px-3 pt-2.5 backdrop-blur-md supports-backdrop-filter:bg-background/85",
            "pb-[max(0.75rem,var(--app-mobile-bottom-safe,0px))]",
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-xl border-border/60 text-base font-medium"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
            Schließen
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
