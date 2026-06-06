"use client";

import { m, useReducedMotion } from "framer-motion";
import { IOS_DOCK_HIGHLIGHT_TRANSITION } from "@/lib/public-profile/profile-dock-motion";
import { profileDockActiveBgClassName } from "@/lib/public-profile/profile-dock-styles";
import { cn } from "@/lib/utils";

export function SlidingTabHighlight({
  highlight,
  className,
}: {
  highlight: { left: number; width: number };
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (highlight.width <= 0) return null;

  if (reduceMotion) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 bottom-0 z-0 shadow-sm transition-[left,width] duration-300 ease-out",
          profileDockActiveBgClassName,
          className,
        )}
        style={{ left: highlight.left, width: highlight.width }}
      />
    );
  }

  return (
    <m.div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-0 bottom-0 z-0 shadow-sm",
        profileDockActiveBgClassName,
        className,
      )}
      initial={false}
      animate={{ left: highlight.left, width: highlight.width }}
      transition={IOS_DOCK_HIGHLIGHT_TRANSITION}
    />
  );
}
