"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { appMobileBottomSafePbMdClassName } from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";
import {
  APP_LAYER_Z_INDEX,
  appLayerFullscreenOverlayZClassName,
  appLayerStackedSurfaceZClassName,
} from "@/lib/ui/app-layer-z-index";

/** Öffnen: weicher Landeanflug — nicht zu lang. */
const THREAD_OVERLAY_OPEN_MS = 300;
/** Schließen: etwas schneller — fühlt sich reaktiver an. */
const THREAD_OVERLAY_CLOSE_MS = 260;
/** Für Unmount / URL-Sync nach Zurück (Schließen-Dauer). */
export const CONTACT_INBOX_THREAD_OVERLAY_MS = THREAD_OVERLAY_CLOSE_MS;

const THREAD_OVERLAY_OPEN_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const THREAD_OVERLAY_CLOSE_EASING = "cubic-bezier(0.4, 0, 0.82, 0.38)";

/** Vollbild-Chat-Overlay — Sheets darüber nutzen `stackedSurface`. */
export const CONTACT_INBOX_THREAD_OVERLAY_Z_INDEX =
  APP_LAYER_Z_INDEX.fullscreenOverlay;
export const CONTACT_INBOX_STACKED_SHEET_Z_INDEX =
  APP_LAYER_Z_INDEX.stackedSurface;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ContactInboxThreadOverlayProps = {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/**
 * Vollbild-Chat wie WhatsApp: sanft von unten, sticky Kopf- und Fußleiste,
 * scrollbarer Verlauf dazwischen. Verdeckt App-Chrome und Listeninhalt.
 */
export function ContactInboxThreadOverlay({
  open,
  onClose,
  header,
  footer,
  children,
  className,
  "aria-label": ariaLabel = "Chat",
}: ContactInboxThreadOverlayProps) {
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
    const unmountMs = prefersReducedMotion()
      ? 0
      : THREAD_OVERLAY_CLOSE_MS;
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
  const transitionMs = presented
    ? THREAD_OVERLAY_OPEN_MS
    : THREAD_OVERLAY_CLOSE_MS;
  const transitionEasing = presented
    ? THREAD_OVERLAY_OPEN_EASING
    : THREAD_OVERLAY_CLOSE_EASING;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-0 flex flex-col bg-background",
        appLayerFullscreenOverlayZClassName,
        className,
      )}
      style={{
        transform: presented
          ? "translate3d(0, 0, 0)"
          : "translate3d(0, 100%, 0)",
        transition: motionReduced
          ? "none"
          : `transform ${transitionMs}ms ${transitionEasing}`,
        willChange: motionReduced ? undefined : "transform",
        backfaceVisibility: "hidden",
      }}
    >
      <header className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-backdrop-filter:bg-background/85">
        {header}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {footer ? (
        <footer className={cn("sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/85", appMobileBottomSafePbMdClassName)}>
          {footer}
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}
