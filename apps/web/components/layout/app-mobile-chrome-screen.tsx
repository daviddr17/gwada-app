"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { cn } from "@/lib/utils";

/**
 * Apple Sheet (UIKit / Safari):
 * gleiche Kurve für Present + Dismiss — Abbremsen am Ende.
 * Sheet liegt z-mäßig unter der Sticky-Bottom-Nav und fährt darunter durch;
 * die Verlangsamung passiert hinter dem Dock → kein sichtbarer Snap.
 */
const SHEET_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 520;
const CLOSE_MS = 480;
const BACKDROP_OPEN_MS = 380;
const BACKDROP_CLOSE_MS = 320;

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

function cancelAnimations(el: HTMLElement | null) {
  if (!el) return;
  for (const anim of el.getAnimations()) anim.cancel();
}

type AppMobileChromeScreenProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/**
 * Mobile-Overlay Menü/Suche/Meldungen — vollflächig hinter der Bottom-Nav.
 * Schließen: X in der Nav / Escape.
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
  const unlockScrollRef = useRef<(() => void) | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const generationRef = useRef(0);
  openRef.current = open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    /** Wechsel Menü↔Suche↔Meldungen: sofort ersetzen, kein Doppel-Slide. */
    const frame = requestAnimationFrame(() => {
      const anotherOpening = document.querySelector(
        '[data-app-mobile-chrome-overlay][data-open="true"]',
      );
      if (anotherOpening) setMounted(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

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

  /**
   * Open/Close per WAAPI (nicht CSS-Klasse toggle):
   * - keine transitionend-Race mit Unmount
   * - Present/Dismiss mit gleicher Apple-Kurve
   * - Abbremsen hinter der Sticky-Nav (z darunter), nicht am Clip-Rand
   */
  useLayoutEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;

    const gen = ++generationRef.current;
    const reduce = prefersReducedMotion();

    cancelAnimations(panel);
    cancelAnimations(backdrop);

    if (open) {
      if (reduce) {
        panel.style.transform = "translate3d(0, 0, 0)";
        backdrop.style.opacity = "1";
        return;
      }
      panel.style.transform = "translate3d(0, 100%, 0)";
      backdrop.style.opacity = "0";
      const panelAnim = panel.animate(
        [
          { transform: "translate3d(0, 100%, 0)" },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: OPEN_MS,
          easing: SHEET_EASING,
          fill: "forwards",
        },
      );
      const backdropAnim = backdrop.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: BACKDROP_OPEN_MS,
          easing: SHEET_EASING,
          fill: "forwards",
        },
      );
      void panelAnim.finished.then(() => {
        if (generationRef.current !== gen) return;
        panel.style.transform = "translate3d(0, 0, 0)";
        panelAnim.cancel();
      });
      void backdropAnim.finished.then(() => {
        if (generationRef.current !== gen) return;
        backdrop.style.opacity = "1";
        backdropAnim.cancel();
      });
      return () => {
        panelAnim.cancel();
        backdropAnim.cancel();
      };
    }

    /** Close */
    if (reduce) {
      setMounted(false);
      return;
    }

    /** Anderes Overlay öffnet — dieses hier sofort weg. */
    const anotherOpening = document.querySelector(
      '[data-app-mobile-chrome-overlay][data-open="true"]',
    );
    if (anotherOpening && anotherOpening !== shellRef.current) {
      setMounted(false);
      return;
    }

    panel.style.transform = "translate3d(0, 0, 0)";
    backdrop.style.opacity = "1";

    const panelAnim = panel.animate(
      [
        { transform: "translate3d(0, 0, 0)" },
        { transform: "translate3d(0, 100%, 0)" },
      ],
      {
        duration: CLOSE_MS,
        easing: SHEET_EASING,
        fill: "forwards",
      },
    );
    const backdropAnim = backdrop.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: BACKDROP_CLOSE_MS,
        easing: SHEET_EASING,
        fill: "forwards",
      },
    );

    void panelAnim.finished
      .catch(() => undefined)
      .then(() => {
        if (generationRef.current !== gen) return;
        if (openRef.current) return;
        /**
         * Compositor-Frame abwarten, dann unmounten —
         * sonst flackert der letzte gerenderte Frame.
         */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (generationRef.current !== gen) return;
            if (!openRef.current) setMounted(false);
          });
        });
      });

    return () => {
      panelAnim.cancel();
      backdropAnim.cancel();
    };
  }, [mounted, open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={shellRef}
      data-app-mobile-chrome-overlay
      data-open={open ? "true" : "false"}
      className="fixed inset-0 touch-manipulation md:hidden"
      style={{ zIndex: APP_LAYER_Z_INDEX.mobileChromeOverlay }}
      aria-hidden={!open}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-background/25"
        style={{ opacity: 0 }}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className={cn(
          "absolute inset-0 flex flex-col overscroll-none bg-background pt-[env(safe-area-inset-top,0px)]",
          "pb-[var(--app-mobile-bottom-nav-offset)]",
          "[backface-visibility:hidden] transform-gpu",
          className,
        )}
        style={{ transform: "translate3d(0, 100%, 0)" }}
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
      </div>
    </div>,
    document.body,
  );
}
