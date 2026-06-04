"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  PROFILE_TAB_TRANSITION,
  profileTabPanelVariants,
  profileTabReducedVariants,
} from "@/lib/public-profile/profile-tab-transition";
import { cn } from "@/lib/utils";

type ProfileTabPanelProps = {
  panelKey: string;
  active: boolean;
  direction: number;
  children: ReactNode;
  className?: string;
};

/** Apple-typischer Crossfade + leichter Slide — Inhalt bleibt gemountet, Layout nur vom aktiven Panel. */
export function ProfileTabPanel({
  panelKey,
  active,
  direction,
  children,
  className,
}: ProfileTabPanelProps) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion ? profileTabReducedVariants : profileTabPanelVariants;

  return (
    <div
      data-tab-panel={panelKey}
      data-tab-active={active ? "true" : "false"}
      className={cn(
        "w-full",
        active
          ? "relative z-10"
          : "pointer-events-none absolute inset-x-0 top-0 z-0",
      )}
      aria-hidden={!active}
    >
      <LazyMotion features={domAnimation}>
        <m.div
          custom={direction}
          variants={variants}
          initial={false}
          animate={active ? "active" : "idle"}
          transition={PROFILE_TAB_TRANSITION}
          className={cn("origin-top will-change-[transform,opacity]", className)}
          style={
            reduceMotion
              ? undefined
              : { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }
          }
        >
          {children}
        </m.div>
      </LazyMotion>
    </div>
  );
}

type ProfileTabStackProps = {
  activeKey: string;
  direction: number;
  className?: string;
  children: ReactNode;
};

/**
 * Höhe folgt immer dem aktiven Tab — kein Leerraum nach langen Modulen.
 * Inaktive Panels sind aus dem Layout-Flow (h-0 + overflow-hidden).
 */
export function ProfileTabStack({
  activeKey,
  direction,
  className,
  children,
}: ProfileTabStackProps) {
  const reduceMotion = useReducedMotion();
  const stackRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const root = stackRef.current;
    if (!root) return;

    const measure = () => {
      const activeEl = root.querySelector<HTMLElement>(
        `[data-tab-panel="${activeKey}"][data-tab-active="true"]`,
      );
      if (!activeEl) return;
      setHeight(activeEl.offsetHeight);
    };

    measure();

    const activeEl = root.querySelector<HTMLElement>(
      `[data-tab-panel="${activeKey}"][data-tab-active="true"]`,
    );
    if (!activeEl) return;

    const ro = new ResizeObserver(measure);
    ro.observe(activeEl);

    return () => ro.disconnect();
  }, [activeKey, children]);

  return (
    <m.div
      ref={stackRef}
      className={cn("relative overflow-hidden", className)}
      data-active-tab={activeKey}
      data-tab-direction={direction}
      animate={{ height: height ?? "auto" }}
      transition={
        reduceMotion
          ? { duration: 0.01 }
          : { ...PROFILE_TAB_TRANSITION, duration: 0.42 }
      }
    >
      {children}
    </m.div>
  );
}
