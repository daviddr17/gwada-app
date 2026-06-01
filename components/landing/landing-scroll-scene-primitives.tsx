"use client";

import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function scrollSceneLoop(active: boolean, t: Transition): Transition {
  return active ? { ...t, repeat: Infinity } : { duration: 0.4 };
}

export function SceneStage({
  active,
  children,
  className,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("relative size-full min-h-[300px]", className)}
      style={{ perspective: "1600px" }}
    >
      <motion.div
        className="relative size-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={
          active
            ? { rotateX: [5, 0, -3, 0], rotateY: [-8, 2, 8, 0], z: 0 }
            : { rotateX: 10, rotateY: -10, z: -20 }
        }
        transition={scrollSceneLoop(active, { duration: 9, ease: "easeInOut" })}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function GlowOrb({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      animate={
        active
          ? { scale: [1, 1.2, 1], opacity: [0.45, 0.75, 0.45] }
          : { scale: 1, opacity: 0.35 }
      }
      transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
    />
  );
}

export function GlassPanel({
  active,
  children,
  className,
  depth = 0,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  depth?: number;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-2xl border border-border/50 bg-card/85 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)] backdrop-blur-md",
        "ring-1 ring-white/10 dark:ring-white/5",
        className,
      )}
      style={{ transformStyle: "preserve-3d", translate: `0 0 ${depth}px` }}
      animate={
        active
          ? { y: [0, -8, 0], rotateZ: [0, 0.5, 0] }
          : { y: 6, rotateZ: 1 }
      }
      transition={scrollSceneLoop(active, { duration: 4, ease: "easeInOut" })}
    >
      {children}
    </motion.div>
  );
}
