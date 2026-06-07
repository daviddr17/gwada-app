"use client";

import { motion, type Transition } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { LandingFeatureVisualKey } from "@/components/landing/landing-feature-items";
import {
  GlassPanel,
  GlowOrb,
  SceneStage,
  scrollSceneLoop,
} from "@/components/landing/landing-scroll-scene-primitives";
import { cn } from "@/lib/utils";

type SceneProps = { icon: LucideIcon; active: boolean };

type Props = {
  visual: LandingFeatureVisualKey;
  icon: LucideIcon;
  active: boolean;
  className?: string;
};

const spring: Transition = { type: "spring", stiffness: 280, damping: 24 };

/** Zentrales Monolith-Icon mit rotierendem Akzent-Ring. */
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

function ReservationsVisual({ icon, active }: SceneProps) {
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

function BrandingVisual({ icon, active }: SceneProps) {
  return (
    <SceneStage active={active}>
      <GlowOrb
        active={active}
        className="left-1/2 top-1/2 size-52 -translate-x-1/2 -translate-y-1/2 bg-accent/25"
      />

      {[
        { bg: "bg-primary", x: "-5.5rem", y: "-2rem", rot: -18 },
        { bg: "bg-accent", x: "5.5rem", y: "-1rem", rot: 14 },
        { bg: "bg-muted-foreground/50", x: "0", y: "-6rem", rot: 6 },
      ].map((s, i) => (
        <motion.div
          key={s.bg}
          className={cn(
            "absolute size-20 rounded-2xl shadow-2xl ring-1 ring-white/20",
            s.bg,
          )}
          style={{ left: `calc(50% + ${s.x})`, top: `calc(50% + ${s.y})` }}
          animate={
            active
              ? {
                  rotate: [s.rot, s.rot + 8, s.rot],
                  y: [0, i === 1 ? -10 : 8, 0],
                }
              : { rotate: s.rot }
          }
          transition={scrollSceneLoop(active, { duration: 4, delay: i * 0.15, ease: "easeInOut" })}
        />
      ))}

      <motion.div
        className="absolute bottom-16 left-1/2 z-20 w-44 -translate-x-1/2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="overflow-hidden p-0">
          <motion.div
            className="h-14 w-full"
            animate={
              active
                ? {
                    background: [
                      "linear-gradient(135deg, var(--primary), var(--accent))",
                      "linear-gradient(135deg, var(--accent), var(--primary))",
                      "linear-gradient(135deg, var(--primary), var(--accent))",
                    ],
                  }
                : {}
            }
            transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
          />
          <div className="space-y-2 p-3">
            <div className="h-2.5 w-2/3 rounded-full bg-foreground/90" />
            <div className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
            <div className="flex gap-1.5 pt-1">
              <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[9px] font-semibold text-accent-foreground">
                Akzent
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                Logo
              </span>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}

function QrVisual({ icon, active }: SceneProps) {
  const cells = [
    1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1,
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="right-1/4 top-1/3 size-40 bg-emerald-500/20" />

      <motion.div
        className="absolute left-1/2 top-8 z-20 -translate-x-1/2"
        animate={active ? { y: [0, -8, 0], rotateY: [0, 6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="relative w-[9.5rem] rounded-[1.75rem] border-[3px] border-foreground/90 bg-foreground p-1.5 shadow-2xl">
          <div className="absolute left-1/2 top-1.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-background/90" />
          <div className="relative mt-3 overflow-hidden rounded-xl bg-card p-2">
            <div className="grid grid-cols-5 gap-0.5">
              {cells.map((on, i) => (
                <motion.div
                  key={i}
                  className={cn("aspect-square rounded-[2px]", on ? "bg-foreground" : "bg-muted")}
                  animate={
                    active && i % 7 === 0
                      ? { opacity: [0.7, 1, 0.7] }
                      : { opacity: on ? 1 : 0.5 }
                  }
                  transition={scrollSceneLoop(active, { duration: 1.8, delay: (i % 5) * 0.05, ease: "easeInOut" })}
                />
              ))}
            </div>
            <motion.div
              className="pointer-events-none absolute inset-x-1 h-1 rounded-full bg-accent shadow-[0_0_16px_var(--accent)]"
              animate={active ? { top: ["8%", "92%", "8%"] } : { top: "50%" }}
              transition={scrollSceneLoop(active, { duration: 2.2, ease: "easeInOut" })}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-20 right-6 z-30 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 shadow-lg backdrop-blur-sm"
        initial={false}
        animate={
          active
            ? { y: [12, 0, 0], opacity: [0, 1, 1], scale: [0.9, 1, 1] }
            : { y: 16, opacity: 0, scale: 0.95 }
        }
        transition={
          active
            ? { duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }
            : spring
        }
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
          ✓
        </span>
        <span className="text-[10px] font-semibold text-foreground">Gast erkannt</span>
      </motion.div>

      <motion.div
        className="absolute bottom-24 left-8 rounded-2xl border border-border/50 bg-card/90 px-3 py-2 shadow-lg"
        animate={active ? { x: [0, 6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        <p className="text-[9px] text-muted-foreground">Ohne App</p>
        <p className="text-xs font-semibold">Sofort reservieren</p>
      </motion.div>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-6 -translate-x-1/2" />
    </SceneStage>
  );
}

function WorkspaceVisual({ icon, active }: SceneProps) {
  const hub = { cx: 160, cy: 148 };
  const nodes = [
    { label: "Zürich", left: "8%", top: "14%", cx: 52, cy: 58, delay: 0 },
    { label: "Bern", left: "62%", top: "16%", cx: 268, cy: 64, delay: 0.1 },
    { label: "Basel", left: "10%", top: "58%", cx: 58, cy: 228, delay: 0.2 },
    { label: "Luzern", left: "58%", top: "56%", cx: 252, cy: 220, delay: 0.15 },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 bg-indigo-500/15" />

      <svg
        className="pointer-events-none absolute inset-0 size-full text-border"
        viewBox="0 0 320 320"
        aria-hidden
      >
        {nodes.map((n) => (
          <motion.line
            key={n.label}
            x1={hub.cx}
            y1={hub.cy}
            x2={n.cx}
            y2={n.cy}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            initial={false}
            animate={active ? { opacity: [0.2, 0.55, 0.2] } : { opacity: 0.15 }}
            transition={scrollSceneLoop(active, { duration: 2.5, delay: n.delay, ease: "easeInOut" })}
          />
        ))}
      </svg>

      {nodes.map((n) => (
        <motion.div
          key={n.label}
          className="absolute z-10 w-28"
          style={{ left: n.left, top: n.top }}
          animate={
            active
              ? { y: [0, -6, 0], scale: [1, 1.03, 1] }
              : { y: 0, scale: 1 }
          }
          transition={scrollSceneLoop(active, { duration: 3.6, delay: n.delay, ease: "easeInOut" })}
        >
          <GlassPanel active={active} className="p-2.5">
            <p className="text-[10px] font-bold text-foreground">{n.label}</p>
            <p className="text-[9px] text-muted-foreground">Team · Rolle</p>
            <div className="mt-2 flex -space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-4 rounded-full border-2 border-card bg-muted-foreground/30"
                />
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      ))}

      <motion.div
        className="absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-1.5 text-[10px] font-semibold text-primary shadow-sm"
        animate={active ? { scale: [1, 1.06, 1] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.5, ease: "easeInOut" })}
      >
        Workspace
      </motion.div>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}

function ReliabilityVisual({ icon, active }: SceneProps) {
  return (
    <SceneStage active={active}>
      {[44, 56, 68].map((size, i) => (
        <motion.div
          key={size}
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15"
          style={{ width: size * 4, height: size * 4 }}
          animate={
            active
              ? { scale: [1, 1.06, 1], opacity: [0.25, 0.5, 0.25] }
              : { opacity: 0.15 }
          }
          transition={scrollSceneLoop(active, { duration: 3, delay: i * 0.35, ease: "easeInOut" })}
        />
      ))}

      <motion.div
        className="absolute left-6 top-20 z-10"
        animate={active ? { y: [0, -5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="px-3 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">99,9%</p>
          <p className="text-[9px] text-muted-foreground">Uptime</p>
        </GlassPanel>
      </motion.div>

      <motion.div
        className="absolute right-4 top-24 z-10"
        animate={active ? { x: [0, 4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="flex items-center gap-2 px-3 py-2">
          <motion.span
            className="size-2 rounded-full bg-emerald-500"
            animate={active ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 1.5, ease: "easeInOut" })}
          />
          <span className="text-[10px] font-semibold">Sync aktiv</span>
        </GlassPanel>
      </motion.div>

      <motion.div
        className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-2"
        animate={active ? { opacity: [0.7, 1, 0.7] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.8, ease: "easeInOut" })}
      >
        {["Push", "E-Mail", "Backup"].map((label) => (
          <span
            key={label}
            className="rounded-lg border border-border/50 bg-card/80 px-2 py-1 text-[9px] font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </motion.div>

      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2" />

      <motion.svg
        viewBox="0 0 56 56"
        className="absolute left-1/2 top-[42%] z-40 size-14 -translate-x-1/2 translate-y-10 text-accent"
        initial={false}
      >
        <motion.path
          d="M10 30 L24 44 L46 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={active ? { pathLength: [0, 1], opacity: [0, 1] } : { pathLength: 0, opacity: 0 }}
          transition={active ? { duration: 0.8, ease: "easeOut", delay: 0.3 } : spring}
        />
      </motion.svg>
    </SceneStage>
  );
}

const VISUALS: Record<LandingFeatureVisualKey, ComponentType<SceneProps>> = {
  menu: MenuVisual,
  reservations: ReservationsVisual,
  branding: BrandingVisual,
  qr: QrVisual,
  workspace: WorkspaceVisual,
  reliability: ReliabilityVisual,
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
