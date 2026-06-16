"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const THREAD_OVERLAY_MS = 380;
/** iOS-ähnliches Sheet-Easing */
const THREAD_OVERLAY_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

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
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPresented(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setPresented(false);
    const timer = window.setTimeout(() => setMounted(false), THREAD_OVERLAY_MS);
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-0 z-[200] flex flex-col bg-background",
        className,
      )}
      style={{
        transform: presented ? "translate3d(0, 0, 0)" : "translate3d(0, 100%, 0)",
        transition: `transform ${THREAD_OVERLAY_MS}ms ${THREAD_OVERLAY_EASING}`,
        willChange: "transform",
      }}
    >
      <header className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-backdrop-filter:bg-background/85">
        {header}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {footer ? (
        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md supports-backdrop-filter:bg-background/85">
          {footer}
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}
