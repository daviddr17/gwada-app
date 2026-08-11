"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PermissionUnlockPayload } from "@/lib/profile/permission-unlock-types";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  DISPLAY_CELEBRATION_EXIT_MS,
  DISPLAY_CELEBRATION_EXIT_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

const RING_DELAYS = [0, 0.16, 0.32] as const;

function mergeUnlockLabels(unlocks: PermissionUnlockPayload[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const unlock of unlocks) {
    for (const label of unlock.permissionLabels) {
      if (!label || seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

export function DashboardPermissionUnlockCelebration() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const reduceMotion = useReducedMotion() ?? false;
  const [unlocks, setUnlocks] = useState<PermissionUnlockPayload[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/profile/permission-unlocks?restaurantId=${encodeURIComponent(restaurantId)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { unlocks?: PermissionUnlockPayload[] };
        };
        const next = json.data?.unlocks ?? [];
        if (cancelled || next.length === 0) return;
        setUnlocks(next);
        setOpen(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const labels = useMemo(() => mergeUnlockLabels(unlocks), [unlocks]);
  const exitMs = reduceMotion
    ? DISPLAY_CELEBRATION_EXIT_REDUCED_MS
    : DISPLAY_CELEBRATION_EXIT_MS;

  const dismiss = useCallback(async () => {
    if (!restaurantId || dismissing || unlocks.length === 0) {
      setOpen(false);
      return;
    }
    setDismissing(true);
    try {
      await fetch("/api/profile/permission-unlocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          unlockIds: unlocks.map((u) => u.id),
        }),
      });
    } catch {
      /* ignore */
    } finally {
      setDismissing(false);
      setOpen(false);
      setUnlocks([]);
    }
  }, [dismissing, restaurantId, unlocks]);

  const accent = "var(--accent)";
  const previewLabels = labels.slice(0, 5);
  const moreCount = Math.max(0, labels.length - previewLabels.length);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: exitMs / 1000, ease: MOTION_EASE_OUT }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="permission-unlock-title"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.35 }}
            aria-label="Schließen"
            onClick={() => void dismiss()}
          />

          <motion.div
            className="pointer-events-none absolute size-[min(90vw,28rem)] rounded-full opacity-40 blur-3xl"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} 55%, transparent) 0%, transparent 70%)`,
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 0.45 }}
            transition={{
              duration: reduceMotion ? 0.15 : 1.1,
              ease: MOTION_EASE_OUT,
            }}
          />

          {!reduceMotion
            ? RING_DELAYS.map((delay, index) => (
                <motion.span
                  key={index}
                  className="pointer-events-none absolute size-36 rounded-full border"
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
                  }}
                  initial={{ scale: 0.55, opacity: 0.55 }}
                  animate={{ scale: 2.2 + index * 0.25, opacity: 0 }}
                  transition={{
                    duration: 1.6,
                    delay,
                    ease: MOTION_EASE_OUT,
                  }}
                />
              ))
            : null}

          <motion.div
            className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border/50 bg-card/95 p-6 text-center shadow-xl backdrop-blur-md"
            initial={{
              opacity: 0,
              y: reduceMotion ? 0 : 16,
              scale: reduceMotion ? 1 : 0.92,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 340, damping: 28, mass: 0.85 }
            }
          >
            <div className="relative flex size-20 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Unlock className="size-9" aria-hidden />
              <Sparkles
                className="absolute -right-1 -top-1 size-5 text-amber-500"
                aria-hidden
              />
            </div>

            <div className="space-y-2">
              <p
                id="permission-unlock-title"
                className="text-xl font-semibold tracking-tight"
              >
                Neue Rechte freigeschaltet
              </p>
              <p className="text-sm text-muted-foreground">
                Du darfst jetzt mehr im Dashboard — viel Spaß damit.
              </p>
            </div>

            {previewLabels.length > 0 ? (
              <ul className="flex w-full flex-wrap justify-center gap-1.5">
                {previewLabels.map((label) => (
                  <li
                    key={label}
                    className={cn(
                      "rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1",
                      "text-xs font-medium text-foreground",
                    )}
                  >
                    {label}
                  </li>
                ))}
                {moreCount > 0 ? (
                  <li className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    +{moreCount} weitere
                  </li>
                ) : null}
              </ul>
            ) : null}

            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              disabled={dismissing}
              onClick={() => void dismiss()}
            >
              Los geht&apos;s
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
