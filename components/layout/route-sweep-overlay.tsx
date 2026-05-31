"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTH_SWEEP_MS,
  MARKETING_SWEEP_MS,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
  ROUTE_SWEEP_MS,
  ROUTE_SWEEP_REDUCED_MS,
} from "@/lib/ui/motion-presets";

export type RouteSweepVariant = "workspace" | "auth" | "marketing";

export type RouteSweepMeta = {
  id: string;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  iconClassName?: string;
  accentClassName?: string;
};

const VARIANT_MS: Record<RouteSweepVariant, number> = {
  workspace: ROUTE_SWEEP_MS,
  auth: AUTH_SWEEP_MS,
  marketing: MARKETING_SWEEP_MS,
};

function SweepBands({
  reducedMotion,
  accentClassName,
}: {
  reducedMotion: boolean;
  accentClassName: string;
}) {
  if (reducedMotion) {
    return (
      <motion.div
        className="absolute inset-0 bg-background/85 backdrop-blur-[1px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
      />
    );
  }

  return (
    <>
      <motion.div
        className="absolute inset-0 bg-background/35 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: MOTION_EASE_OUT }}
      />
      <motion.div
        className={cn(
          "pointer-events-none absolute inset-y-[-8%] w-[72%] bg-gradient-to-r will-change-transform",
          accentClassName,
        )}
        initial={{ x: "-115%", opacity: 0.72 }}
        animate={{ x: "118%", opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.52, ease: MOTION_EASE_IN_OUT }}
      />
      <motion.div
        className={cn(
          "pointer-events-none absolute inset-y-[-4%] w-[48%] bg-gradient-to-r opacity-70 will-change-transform",
          accentClassName,
        )}
        initial={{ x: "-125%", opacity: 0.45 }}
        animate={{ x: "130%", opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.46,
          delay: 0.04,
          ease: MOTION_EASE_IN_OUT,
        }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--foreground)_7%,transparent)_0%,transparent_65%)]"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, delay: 0.05, ease: MOTION_EASE_OUT }}
      />
    </>
  );
}

function SweepLabel({
  meta,
  reducedMotion,
}: {
  meta: RouteSweepMeta;
  reducedMotion: boolean;
}) {
  const Icon = meta.Icon;

  return (
    <motion.div
      className="relative z-10 flex flex-col items-center gap-3 px-6 text-center"
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 12, scale: 0.96, filter: "blur(8px)" }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
      }
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: -6, scale: 1.02, filter: "blur(4px)" }
      }
      transition={{
        duration: reducedMotion ? 0.1 : 0.28,
        ease: MOTION_EASE_OUT,
      }}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl border border-border/50 bg-card/90 shadow-lg backdrop-blur-sm",
          meta.iconClassName,
        )}
      >
        <Icon className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {meta.label}
        </p>
        <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
      </div>
    </motion.div>
  );
}

type RouteSweepOverlayProps = {
  meta: RouteSweepMeta | null;
  variant?: RouteSweepVariant;
  className?: string;
};

/** Vollbild-Sweep mit Label — Dashboard↔Superadmin, Auth, Marketing. */
export function RouteSweepOverlay({
  meta,
  variant = "workspace",
  className,
}: RouteSweepOverlayProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const accentClassName =
    meta?.accentClassName ??
    "from-[color-mix(in_oklch,var(--accent)_82%,transparent)] via-[color-mix(in_oklch,var(--accent)_38%,transparent)] to-transparent";

  return (
    <AnimatePresence mode="wait">
      {meta ? (
        <motion.div
          key={meta.id}
          className={cn(
            "pointer-events-none fixed inset-0 z-[200] flex items-center justify-center overflow-hidden",
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0.08 : 0.18,
            ease: MOTION_EASE_OUT,
          }}
          aria-hidden
          data-sweep-variant={variant}
          data-sweep-ms={reducedMotion ? ROUTE_SWEEP_REDUCED_MS : VARIANT_MS[variant]}
        >
          <SweepBands
            reducedMotion={reducedMotion}
            accentClassName={accentClassName}
          />
          <SweepLabel meta={meta} reducedMotion={reducedMotion} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function sweepDurationMs(
  variant: RouteSweepVariant,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return ROUTE_SWEEP_REDUCED_MS;
  return VARIANT_MS[variant];
}
