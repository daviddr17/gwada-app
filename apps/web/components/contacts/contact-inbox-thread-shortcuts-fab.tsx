"use client";

import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { CalendarPlus, Plus, Star, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import {
  appMobileFabButtonClassName,
  appMobileFabIconClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";

const MENU_SPRING = { type: "spring" as const, stiffness: 520, damping: 34 };

export type ContactInboxShortcutAction = {
  id: "reservation" | "review_invite";
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
};

export function contactInboxShortcutActions(params: {
  canCreateReservation: boolean;
  canCreateReviewInvite: boolean;
  onReservation: () => void;
  onReviewInvite: () => void;
}): ContactInboxShortcutAction[] {
  const items: ContactInboxShortcutAction[] = [];
  if (params.canCreateReservation) {
    items.push({
      id: "reservation",
      label: "Neue Reservierung",
      icon: CalendarPlus,
      onSelect: params.onReservation,
    });
  }
  if (params.canCreateReviewInvite) {
    items.push({
      id: "review_invite",
      label: "Bewertungseinladung",
      icon: Star,
      onSelect: params.onReviewInvite,
    });
  }
  return items;
}

function FabMenuItem({
  action,
  index,
  reduceMotion,
  onNavigate,
}: {
  action: ContactInboxShortcutAction;
  index: number;
  reduceMotion: boolean;
  onNavigate: () => void;
}) {
  const Icon = action.icon;
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
      <button
        type="button"
        onClick={() => {
          onNavigate();
          action.onSelect();
        }}
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
        <span className="min-w-0 whitespace-nowrap">{action.label}</span>
      </button>
    </m.div>
  );
}

/**
 * Plus-FAB im Chat-Overlay — gleiche Optik wie Dashboard-Shortcuts.
 * Absolute Positionierung relativ zum Overlay (nicht Body-Portal).
 */
export function ContactInboxThreadShortcutsFab({
  actions,
  className,
}: {
  actions: ContactInboxShortcutAction[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
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

  useEffect(() => {
    if (actions.length === 0) setOpen(false);
  }, [actions.length]);

  if (actions.length === 0) return null;

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        className={cn("pointer-events-none absolute inset-0", className)}
        data-contact-inbox-shortcuts-fab
      >
        <AnimatePresence>
          {open ? (
            <m.button
              type="button"
              key="chat-fab-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="pointer-events-auto absolute inset-0 z-[1] bg-background/40 backdrop-blur-[3px]"
              aria-label="Menü schließen"
              onClick={close}
            />
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-auto absolute end-4 bottom-3 z-[2] flex flex-col items-end gap-3">
          <AnimatePresence mode="popLayout">
            {open
              ? actions.map((action, index) => (
                  <FabMenuItem
                    key={action.id}
                    action={action}
                    index={actions.length - 1 - index}
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
              "relative shadow-lg",
              appMobileFabButtonClassName,
              brandActionButtonClassName,
            )}
            animate={{ rotate: open ? 45 : 0, scale: open ? 1.04 : 1 }}
            whileTap={{ scale: 0.94 }}
            transition={MENU_SPRING}
            onClick={() => setOpen((v) => !v)}
          >
            <Plus
              className={appMobileFabIconClassName}
              strokeWidth={2.25}
              aria-hidden
            />
          </m.button>
        </div>
      </div>
    </LazyMotion>
  );
}
