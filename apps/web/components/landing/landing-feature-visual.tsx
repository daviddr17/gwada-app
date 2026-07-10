"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { LandingFeatureVisualKey } from "@/components/landing/landing-feature-items";
import {
  GlassPanel,
  GlowOrb,
  SceneStage,
  scrollSceneLoop,
} from "@/components/landing/landing-scroll-scene-primitives";
import {
  AccountingVisual,
  ChecklistsVisual,
  DocumentsVisual,
  EventsVisual,
  GalleryVisual,
  InventoryVisual,
  MessagesVisual,
  NewsVisual,
  ReviewsVisual,
  StaffVisual,
} from "@/components/landing/landing-sidebar-module-visuals";
import { cn } from "@/lib/utils";

type SceneProps = { icon: LucideIcon; active: boolean };

type Props = {
  visual: LandingFeatureVisualKey;
  icon: LucideIcon;
  active: boolean;
  className?: string;
};

function HeroMonolith({
  icon: Icon,
  active,
  className,
}: {
  icon: LucideIcon;
  active: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("relative z-30", className)}
      animate={active ? { y: [0, -14, 0] } : { y: 4 }}
      transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
    >
      <motion.div
        className="absolute -inset-3 rounded-[2rem] bg-[conic-gradient(from_0deg,var(--accent),transparent_40%,var(--primary)_70%,transparent)] opacity-60 blur-sm"
        animate={active ? { rotate: 360 } : { rotate: 0 }}
        transition={scrollSceneLoop(active, { duration: 12, ease: "linear" })}
      />
      <div
        className={cn(
          "relative flex size-[6.5rem] items-center justify-center rounded-[1.65rem]",
          "bg-gradient-to-br from-card via-card to-muted/80 text-primary",
          "shadow-[0_28px_70px_-24px_color-mix(in_srgb,var(--primary)_45%,transparent),inset_0_1px_0_rgba(255,255,255,0.12)]",
          "ring-1 ring-primary/20",
        )}
      >
        <Icon className="size-14" strokeWidth={1.2} aria-hidden />
      </div>
    </motion.div>
  );
}

function MenuVisual({ icon, active }: SceneProps) {
  const dishes = [
    { name: "Tagliatelle", price: "18,50", w: "88%" },
    { name: "Feldsalat", price: "12,00", w: "72%" },
    { name: "Tageskarte", price: "9,50", w: "60%" },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/4 top-1/4 size-40 bg-accent/30" />
      <GlowOrb active={active} className="right-1/4 bottom-1/4 size-36 bg-primary/15" />

      <motion.div
        className="absolute left-4 top-16 w-40 -rotate-12 opacity-70"
        style={{ transformStyle: "preserve-3d", translate: "0 0 -40px" }}
        animate={active ? { rotate: [-14, -10, -14], y: [0, 4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 5.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3 opacity-80" depth={-40}>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-2 rounded-full bg-muted-foreground/20" />
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      <motion.div
        className="absolute right-2 top-8 z-20 w-[13.5rem]"
        style={{ transformStyle: "preserve-3d", translate: "0 0 30px" }}
        animate={active ? { rotate: [6, 2, 6], y: [0, -6, 0] } : { rotate: 8 }}
        transition={scrollSceneLoop(active, { duration: 4.2, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="overflow-hidden p-0" depth={30}>
          <div className="border-b border-border/40 bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Speisekarte
            </p>
            <p className="text-sm font-semibold text-foreground">Hauptgerichte</p>
          </div>
          <div className="space-y-2.5 p-3">
            {dishes.map((d, i) => (
              <motion.div
                key={d.name}
                className="flex items-center justify-between gap-2"
                animate={active ? { x: [4, 0, 4], opacity: [0.6, 1, 0.6] } : {}}
                transition={scrollSceneLoop(active, {
                  duration: 2.8,
                  delay: i * 0.2,
                  ease: "easeInOut",
                })}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-foreground">{d.name}</p>
                  <div
                    className="mt-1 h-1 rounded-full bg-muted-foreground/20"
                    style={{ width: d.w }}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-accent">
                  €{d.price}
                </span>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      <motion.span
        className="absolute right-16 top-24 z-40 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground shadow-lg"
        animate={active ? { scale: [1, 1.08, 1], rotate: [0, 4, 0] } : { scale: 0.9 }}
        transition={scrollSceneLoop(active, { duration: 2.2, ease: "easeInOut" })}
      >
        Neu
      </motion.span>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%]" />

      <motion.div
        className="absolute bottom-10 left-6 flex gap-2"
        animate={active ? { y: [0, -4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        {["V", "G", "L", "N"].map((label, i) => (
          <motion.span
            key={label}
            className="flex size-8 items-center justify-center rounded-xl bg-accent/20 text-[10px] font-bold text-accent-foreground ring-1 ring-accent/35"
            animate={active ? { scale: [1, 1.1, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 2, delay: i * 0.15, ease: "easeInOut" })}
          >
            {label}
          </motion.span>
        ))}
      </motion.div>
    </SceneStage>
  );
}

function ReservierungenVisual({ icon, active }: SceneProps) {
  const slots = ["18:00", "19:30", "21:00"];
  const days = Array.from({ length: 16 }, (_, i) => i);
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-0 size-44 -translate-x-1/2 bg-sky-500/20" />

      <motion.div
        className="absolute left-2 top-6 z-20 w-[11.5rem]"
        animate={active ? { x: [0, 4, 0], rotate: [0, 1, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Mai</span>
            <span className="text-[10px] text-muted-foreground">2026</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {days.map((d) => (
              <motion.div
                key={d}
                className={cn(
                  "flex h-6 items-center justify-center rounded-md text-[9px] font-medium",
                  d === 9
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/70 text-muted-foreground",
                )}
                animate={
                  d === 9 && active
                    ? {
                        scale: [1, 1.15, 1],
                        boxShadow: [
                          "0 0 0 0 transparent",
                          "0 0 0 5px color-mix(in srgb, var(--primary) 22%, transparent)",
                          "0 0 0 0 transparent",
                        ],
                      }
                    : {}
                }
                transition={scrollSceneLoop(active, { duration: 2.2, ease: "easeInOut" })}
              >
                {d + 12}
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      <motion.div
        className="absolute right-0 top-20 z-10 w-28 space-y-2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.8, ease: "easeInOut" })}
      >
        {slots.map((time, i) => (
          <motion.div
            key={time}
            className={cn(
              "rounded-xl border px-2.5 py-1.5 text-center text-[10px] font-semibold",
              i === 1
                ? "border-accent/50 bg-accent/15 text-accent-foreground"
                : "border-border/50 bg-card/80 text-muted-foreground",
            )}
            animate={active && i === 1 ? { scale: [1, 1.05, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 2, delay: i * 0.1, ease: "easeInOut" })}
          >
            {time}
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="absolute bottom-14 left-1/2 z-10 flex -translate-x-1/2 gap-3"
        animate={active ? { y: [0, -5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4, ease: "easeInOut" })}
      >
        {["T1", "T2", "T3", "T4"].map((t, i) => (
          <motion.div
            key={t}
            className={cn(
              "flex size-10 items-center justify-center rounded-xl border text-[9px] font-bold",
              i === 2
                ? "border-primary bg-primary text-primary-foreground shadow-lg"
                : "border-border/60 bg-card text-muted-foreground",
            )}
            animate={active && i === 2 ? { scale: [1, 1.1, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 2.4, ease: "easeInOut" })}
          >
            {t}
          </motion.div>
        ))}
      </motion.div>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}

const VISUALS: Record<LandingFeatureVisualKey, ComponentType<SceneProps>> = {
  menu: MenuVisual,
  inventory: InventoryVisual,
  reservierungen: ReservierungenVisual,
  events: EventsVisual,
  kontakte: MessagesVisual,
  news: NewsVisual,
  bewertungen: ReviewsVisual,
  galerie: GalleryVisual,
  buchfuehrung: AccountingVisual,
  dokumente: DocumentsVisual,
  checklisten: ChecklistsVisual,
  mitarbeiter: StaffVisual,
};

export function LandingFeatureVisual({ visual, icon, active, className }: Props) {
  const Visual = VISUALS[visual];
  return (
    <div
      className={cn("relative size-full min-h-[300px] max-h-[460px]", className)}
      aria-hidden
    >
      <Visual icon={icon} active={active} />
    </div>
  );
}
