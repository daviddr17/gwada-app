"use client";

import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  defaultDashboardShortcutPrefs,
  resolveDashboardFabShortcuts,
  type DashboardShortcutDefinition,
} from "@/lib/constants/dashboard-shortcuts";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

const MENU_SPRING = { type: "spring" as const, stiffness: 520, damping: 34 };

function FabMenuItem({
  shortcut,
  index,
  reduceMotion,
  onNavigate,
}: {
  shortcut: DashboardShortcutDefinition;
  index: number;
  reduceMotion: boolean;
  onNavigate: () => void;
}) {
  const Icon = shortcut.icon;
  return (
    <m.div
      layout
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 18, scale: 0.86, filter: "blur(6px)" }
      }
      animate={
        reduceMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 12, scale: 0.9, filter: "blur(3px)" }
      }
      transition={{
        ...MENU_SPRING,
        delay: reduceMotion ? 0 : index * 0.05,
      }}
      className="pointer-events-auto origin-bottom-right"
    >
      <Link
        href={shortcut.href}
        prefetch
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border/45 bg-card/95 py-2.5 ps-3 pe-4 text-sm font-medium text-foreground shadow-card backdrop-blur-md transition-[transform,box-shadow] hover:shadow-md active:scale-[0.98]",
          "dark:bg-card/90",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            brandActionButtonClassName,
            "shadow-none",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 whitespace-nowrap">{shortcut.label}</span>
      </Link>
    </m.div>
  );
}

function DashboardFabLayer({
  items,
  reduceMotion,
}: {
  items: DashboardShortcutDefinition[];
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <m.button
            type="button"
            key="fab-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="pointer-events-auto fixed inset-0 z-[118] bg-background/40 backdrop-blur-[3px]"
            aria-label="Menü schließen"
            onClick={close}
          />
        ) : null}
      </AnimatePresence>

      <div
        className="pointer-events-auto fixed end-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[120] flex flex-col items-end gap-3 sm:end-6"
        data-dashboard-fab
        style={{
          WebkitTransform: "translate3d(0,0,0)",
          transform: "translate3d(0,0,0)",
        }}
      >
        <AnimatePresence mode="popLayout">
          {open
            ? items.map((shortcut, index) => (
                <FabMenuItem
                  key={shortcut.id}
                  shortcut={shortcut}
                  index={items.length - 1 - index}
                  reduceMotion={reduceMotion}
                  onNavigate={close}
                />
              ))
            : null}
        </AnimatePresence>

        <m.button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? "Schnellaktionen schließen" : "Schnellaktionen"}
          className={cn(
            "relative flex size-14 items-center justify-center rounded-full shadow-lg",
            brandActionButtonClassName,
          )}
          animate={{ rotate: open ? 45 : 0, scale: open ? 1.04 : 1 }}
          whileTap={{ scale: 0.94 }}
          transition={MENU_SPRING}
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="size-6" strokeWidth={2.25} aria-hidden />
        </m.button>
      </div>
    </>
  );
}

export function DashboardFab() {
  const reduceMotion = useReducedMotion() ?? false;
  const { shortcuts, isReady } = useDashboardEffectiveWidgetPrefs();
  const [mounted, setMounted] = useState(false);

  const items = useMemo(() => {
    const prefs = isReady ? shortcuts : defaultDashboardShortcutPrefs();
    return resolveDashboardFabShortcuts(prefs);
  }, [isReady, shortcuts]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) return null;

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <DashboardFabLayer items={items} reduceMotion={reduceMotion} />
    </LazyMotion>,
    document.body,
  );
}
