"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";

const OPEN_MS = 280;
const CLOSE_MS = 220;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  const [presented, setPresented] = useState(false);

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
    const unmountMs = prefersReducedMotion() ? 0 : CLOSE_MS;
    const timer = window.setTimeout(() => setMounted(false), unmountMs);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
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
  const transitionMs = presented ? OPEN_MS : CLOSE_MS;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className={cn(
        "fixed inset-x-0 top-0 flex flex-col overscroll-none bg-background touch-manipulation md:hidden",
        "bottom-[var(--app-mobile-bottom-nav-offset)]",
        "pt-[env(safe-area-inset-top,0px)]",
        className,
      )}
      style={{
        zIndex: APP_LAYER_Z_INDEX.stackedSurface,
        transform: presented ? undefined : "translate3d(0, 100%, 0)",
        transition: motionReduced
          ? "none"
          : `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: motionReduced || presented ? undefined : "transform",
      }}
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
          // Luft über Sticky-Footer; PWA-Safe zusätzlich, damit Schließen nicht clippt.
          "pb-[max(0.75rem,var(--app-mobile-bottom-safe,0.5rem))]",
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
    </div>,
    document.body,
  );
}
