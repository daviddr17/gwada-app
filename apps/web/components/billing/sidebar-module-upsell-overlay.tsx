"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Lock, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  sidebarModuleUpsellContent,
  type SidebarModuleUpsellContent,
} from "@/lib/billing/sidebar-module-upsell";
import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type SidebarModuleUpsellOverlayProps = {
  moduleId: SidebarModuleId | null;
  onClose: () => void;
};

export function SidebarModuleUpsellOverlay({
  moduleId,
  onClose,
}: SidebarModuleUpsellOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!moduleId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moduleId, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const content = moduleId ? sidebarModuleUpsellContent(moduleId) : null;

  return createPortal(
    <AnimatePresence>
      {content ? (
        <UpsellSurface
          key={content.moduleId}
          content={content}
          reduceMotion={reduceMotion}
          onClose={onClose}
          onUpgrade={() => {
            if (content.ctaDisabled) return;
            onClose();
            router.push(APP_ROUTES.settings.billing);
          }}
        />
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function UpsellSurface({
  content,
  reduceMotion,
  onClose,
  onUpgrade,
}: {
  content: SidebarModuleUpsellContent;
  reduceMotion: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const Icon = content.icon;
  const duration = reduceMotion ? 0.01 : 0.34;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sidebar-module-upsell-title"
      aria-describedby="sidebar-module-upsell-desc"
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
      style={{ zIndex: APP_LAYER_Z_INDEX.stackedSurface + 10 }}
    >
      <motion.button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 border-0 bg-background/60 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: MOTION_EASE_OUT }}
        onClick={onClose}
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <motion.div
          className="absolute left-1/2 top-[18%] size-[min(90vw,28rem)] -translate-x-1/2 rounded-full opacity-45 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent) 0%, transparent 70%)",
          }}
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1.1, opacity: 0.45 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.9, ease: MOTION_EASE_OUT }}
        />
        {!reduceMotion
          ? [0, 0.2, 0.4].map((delay, index) => (
              <motion.span
                key={index}
                className="absolute left-1/2 top-[28%] size-28 -translate-x-1/2 rounded-full border"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
                initial={{ scale: 0.5, opacity: 0.5 }}
                animate={{ scale: 2.1 + index * 0.2, opacity: 0 }}
                transition={{
                  duration: 1.35,
                  delay,
                  ease: MOTION_EASE_OUT,
                }}
              />
            ))
          : null}
      </div>

      <motion.div
        className={cn(
          "relative flex w-full max-w-md flex-col overflow-hidden",
          "border-border/50 bg-background/92 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
          "rounded-t-[1.75rem] border border-b-0 sm:rounded-[1.75rem] sm:border-b",
        )}
        initial={{
          opacity: 0,
          y: reduceMotion ? 0 : 28,
          scale: reduceMotion ? 1 : 0.97,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: reduceMotion ? 0 : 16,
          scale: reduceMotion ? 1 : 0.98,
        }}
        transition={{ duration, ease: MOTION_EASE_OUT }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="relative">
            <motion.div
              className="flex size-16 items-center justify-center rounded-2xl bg-card/90 ring-1 ring-border/50"
              initial={{ scale: reduceMotion ? 1 : 0.7 }}
              animate={{ scale: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0.1 }
                  : { type: "spring", stiffness: 420, damping: 22 }
              }
            >
              <Icon className="size-7 text-foreground" aria-hidden />
            </motion.div>
            <motion.span
              className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-background ring-1 ring-border/60"
              initial={{
                opacity: 0,
                scale: reduceMotion ? 1 : 0.5,
                rotate: reduceMotion ? 0 : -20,
              }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                delay: reduceMotion ? 0 : 0.12,
                duration: reduceMotion ? 0.1 : 0.35,
                ease: MOTION_EASE_OUT,
              }}
            >
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
            </motion.span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onClose}
          >
            <X />
            <span className="sr-only">Schließen</span>
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4 sm:px-6 sm:pb-5">
          <div className="space-y-2">
            <motion.span
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.08, duration }}
            >
              <Sparkles className="size-3 text-[var(--accent)]" aria-hidden />
              Ab {content.unlockBadge}
            </motion.span>
            <motion.h2
              id="sidebar-module-upsell-title"
              className="text-xl font-semibold tracking-tight text-foreground"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration }}
            >
              {content.title}
            </motion.h2>
            <motion.p
              id="sidebar-module-upsell-desc"
              className="text-sm leading-relaxed text-muted-foreground"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.16, duration }}
            >
              {content.description}
            </motion.p>
          </div>

          {content.bullets.length > 0 ? (
            <ul className="space-y-2">
              {content.bullets.map((bullet, index) => (
                <motion.li
                  key={bullet}
                  className="flex items-start gap-2.5 text-sm text-foreground/90"
                  initial={{ opacity: 0, x: reduceMotion ? 0 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.2 + index * 0.06,
                    duration,
                    ease: MOTION_EASE_OUT,
                  }}
                >
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        "color-mix(in srgb, var(--accent) 16%, transparent)",
                      color: "var(--accent)",
                    }}
                  >
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span>{bullet}</span>
                </motion.li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/40 px-5 py-4 sm:flex-row-reverse sm:px-6">
          <Button
            type="button"
            size="lg"
            className={cn("w-full sm:flex-1", brandActionButtonRoundedClassName)}
            disabled={content.ctaDisabled}
            onClick={onUpgrade}
          >
            {content.ctaLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full rounded-xl sm:flex-1"
            onClick={onClose}
          >
            Später
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
