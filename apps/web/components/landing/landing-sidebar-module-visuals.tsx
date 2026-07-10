"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  GlassPanel,
  GlowOrb,
  SceneStage,
  scrollSceneLoop,
} from "@/components/landing/landing-scroll-scene-primitives";
import { cn } from "@/lib/utils";

type SceneProps = { icon: LucideIcon; active: boolean };

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

export function InventoryVisual({ icon, active }: SceneProps) {
  const rows = [
    { name: "Tomaten", pct: "72%", warn: false },
    { name: "Olivenöl", pct: "18%", warn: true },
    { name: "Mehl", pct: "54%", warn: false },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/4 top-1/4 size-40 bg-amber-500/25" />
      <motion.div
        className="absolute left-1/2 top-10 z-20 w-48 -translate-x-1/2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Bestand
          </p>
          <div className="mt-2 space-y-2.5">
            {rows.map((row, i) => (
              <motion.div
                key={row.name}
                animate={active ? { x: [4, 0, 4], opacity: [0.65, 1, 0.65] } : {}}
                transition={scrollSceneLoop(active, {
                  duration: 2.6,
                  delay: i * 0.15,
                  ease: "easeInOut",
                })}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-foreground">{row.name}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      row.warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {row.pct}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      row.warn ? "bg-amber-500" : "bg-primary/70",
                    )}
                    animate={active ? { width: [row.pct, "100%", row.pct] } : {}}
                    transition={scrollSceneLoop(active, {
                      duration: 3,
                      delay: i * 0.2,
                      ease: "easeInOut",
                    })}
                    style={{ width: row.pct }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-8 -translate-x-1/2" />
    </SceneStage>
  );
}

export function EventsVisual({ icon, active }: SceneProps) {
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="right-1/4 top-1/3 size-44 bg-pink-500/20" />
      <motion.div
        className="absolute left-6 top-12 z-20 w-40"
        animate={active ? { rotate: [-4, 2, -4], y: [0, -5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-primary/20 to-accent/20 px-3 py-2">
            <p className="text-[10px] font-bold text-foreground">Wine & Dine</p>
            <p className="text-[9px] text-muted-foreground">Sa, 24. Mai · 19:00</p>
          </div>
          <div className="space-y-1.5 p-3">
            {["48 Plätze", "Menü inkl."].map((t, i) => (
              <motion.span
                key={t}
                className="block rounded-lg bg-muted/60 px-2 py-1 text-[9px] font-medium text-foreground"
                animate={active ? { opacity: [0.5, 1, 0.5] } : {}}
                transition={scrollSceneLoop(active, { duration: 2.2, delay: i * 0.2, ease: "easeInOut" })}
              >
                {t}
              </motion.span>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute right-4 top-24 flex gap-2"
        animate={active ? { y: [0, -8, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.8, ease: "easeInOut" })}
      >
        {["🎟", "✨"].map((emoji, i) => (
          <motion.span
            key={emoji}
            className="flex size-10 items-center justify-center rounded-xl border border-border/50 bg-card/90 text-lg shadow-md"
            animate={active ? { scale: [1, 1.12, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 2, delay: i * 0.15, ease: "easeInOut" })}
          >
            {emoji}
          </motion.span>
        ))}
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}

export function MessagesVisual({ icon, active }: SceneProps) {
  const bubbles = [
    { from: "Gast", text: "Tisch für 4 heute?", side: "left" as const, delay: 0 },
    { from: "Team", text: "19:30 passt!", side: "right" as const, delay: 0.15 },
    { from: "WhatsApp", text: "✓ gelesen", side: "right" as const, delay: 0.3 },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-0 size-44 -translate-x-1/2 bg-emerald-500/20" />
      <div className="absolute inset-x-4 top-14 space-y-2.5">
        {bubbles.map((b) => (
          <motion.div
            key={b.text}
            className={cn("flex", b.side === "right" ? "justify-end" : "justify-start")}
            animate={active ? { x: b.side === "left" ? [-8, 0, -8] : [8, 0, 8], opacity: [0.6, 1, 0.6] } : {}}
            transition={scrollSceneLoop(active, { duration: 3, delay: b.delay, ease: "easeInOut" })}
          >
            <GlassPanel
              active={active}
              className={cn(
                "max-w-[75%] px-3 py-2",
                b.side === "right" ? "bg-primary/10 border-primary/20" : "",
              )}
            >
              <p className="text-[9px] font-semibold text-muted-foreground">{b.from}</p>
              <p className="text-[11px] font-medium text-foreground">{b.text}</p>
            </GlassPanel>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2"
        animate={active ? { y: [0, -4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        {["WA", "Mail", "Meta"].map((ch) => (
          <span
            key={ch}
            className="rounded-full border border-border/50 bg-card/80 px-2.5 py-1 text-[9px] font-bold text-muted-foreground"
          >
            {ch}
          </span>
        ))}
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-4 -translate-x-1/2" />
    </SceneStage>
  );
}

export function NewsVisual({ icon, active }: SceneProps) {
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="right-1/3 top-1/4 size-40 bg-indigo-500/20" />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-32"
          style={{ left: `${12 + i * 22}%`, top: `${18 + i * 8}%` }}
          animate={active ? { y: [0, -8 + i * 2, 0], rotate: [-6 + i * 4, 0, -6 + i * 4] } : {}}
          transition={scrollSceneLoop(active, { duration: 4 + i * 0.5, delay: i * 0.12, ease: "easeInOut" })}
        >
          <GlassPanel active={active} className="overflow-hidden p-0">
            <div className={cn("h-14 w-full", i === 0 ? "bg-primary/30" : i === 1 ? "bg-accent/25" : "bg-muted")} />
            <div className="space-y-1.5 p-2">
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/80" />
              <div className="h-1 w-full rounded-full bg-muted-foreground/25" />
            </div>
          </GlassPanel>
        </motion.div>
      ))}
      <motion.span
        className="absolute right-10 top-20 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground shadow-lg"
        animate={active ? { scale: [1, 1.08, 1] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.2, ease: "easeInOut" })}
      >
        Live
      </motion.span>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-10 -translate-x-1/2" />
    </SceneStage>
  );
}

export function ReviewsVisual({ icon, active }: SceneProps) {
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-1/3 size-44 -translate-x-1/2 bg-yellow-500/15" />
      <motion.div
        className="absolute left-1/2 top-16 z-20 w-44 -translate-x-1/2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.2, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3 text-center">
          <div className="flex justify-center gap-0.5 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.span
                key={i}
                animate={active ? { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] } : {}}
                transition={scrollSceneLoop(active, { duration: 1.8, delay: i * 0.08, ease: "easeInOut" })}
              >
                ★
              </motion.span>
            ))}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">4,8</p>
          <p className="text-[9px] text-muted-foreground">Google · 127 Bewertungen</p>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-20 right-6 w-36"
        animate={active ? { x: [0, 6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.6, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-2.5">
          <p className="text-[10px] font-medium text-foreground">&quot;Super Service!&quot;</p>
          <p className="mt-1 text-[9px] text-muted-foreground">vor 2 Tagen</p>
        </GlassPanel>
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-6 -translate-x-1/2" />
    </SceneStage>
  );
}

export function GalleryVisual({ icon, active }: SceneProps) {
  const tiles = [0, 1, 2, 3, 4, 5];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/3 bottom-1/4 size-40 bg-cyan-500/20" />
      <div className="absolute left-1/2 top-12 grid w-52 -translate-x-1/2 grid-cols-3 gap-1.5">
        {tiles.map((i) => (
          <motion.div
            key={i}
            className={cn(
              "aspect-square rounded-lg border border-border/40 bg-gradient-to-br shadow-sm",
              i % 3 === 0 ? "from-primary/25 to-accent/15" : "from-muted to-muted/50",
            )}
            animate={active ? { scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] } : {}}
            transition={scrollSceneLoop(active, { duration: 2.5, delay: (i % 3) * 0.1, ease: "easeInOut" })}
          />
        ))}
      </div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-8 -translate-x-1/2" />
    </SceneStage>
  );
}

export function AccountingVisual({ icon, active }: SceneProps) {
  const lines = [
    { label: "Rechnung #1042", amount: "1.240,00" },
    { label: "Angebot Event", amount: "890,00" },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="right-1/4 top-1/4 size-40 bg-lime-500/15" />
      <motion.div
        className="absolute left-1/2 top-14 z-20 w-48 -translate-x-1/2"
        animate={active ? { y: [0, -5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Buchführung</p>
          <div className="mt-2 space-y-2">
            {lines.map((line, i) => (
              <motion.div
                key={line.label}
                className="flex items-center justify-between gap-2 border-b border-border/30 pb-2 last:border-0 last:pb-0"
                animate={active ? { x: [6, 0, 6] } : {}}
                transition={scrollSceneLoop(active, { duration: 2.8, delay: i * 0.15, ease: "easeInOut" })}
              >
                <span className="text-[10px] font-medium text-foreground">{line.label}</span>
                <span className="text-[10px] font-bold tabular-nums text-accent">€{line.amount}</span>
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-10 -translate-x-1/2" />
    </SceneStage>
  );
}

export function DocumentsVisual({ icon, active }: SceneProps) {
  const docs = ["HACCP", "Vertrag", "Schulung"];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-1/4 size-44 -translate-x-1/2 bg-slate-500/15" />
      {docs.map((name, i) => (
        <motion.div
          key={name}
          className="absolute left-1/2 w-40 -translate-x-1/2"
          style={{ top: `${22 + i * 14}%`, zIndex: 10 + i }}
          animate={active ? { y: [0, -4 - i * 2, 0], rotate: [-3 + i * 2, 0, -3 + i * 2] } : {}}
          transition={scrollSceneLoop(active, { duration: 4, delay: i * 0.12, ease: "easeInOut" })}
        >
          <GlassPanel active={active} className="flex items-center gap-2 px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
              PDF
            </span>
            <span className="text-[11px] font-semibold text-foreground">{name}</span>
          </GlassPanel>
        </motion.div>
      ))}
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-6 -translate-x-1/2" />
    </SceneStage>
  );
}

export function ChecklistsVisual({ icon, active }: SceneProps) {
  const items = [
    { label: "Kühlschrank-Temp.", done: true },
    { label: "HACCP Protokoll", done: true },
    { label: "Lieferung geprüft", done: false },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="right-1/3 top-1/3 size-40 bg-teal-500/20" />
      <motion.div
        className="absolute left-1/2 top-14 z-20 w-48 -translate-x-1/2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.2, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Heute</p>
          <ul className="mt-2 space-y-2">
            {items.map((item, i) => (
              <motion.li
                key={item.label}
                className="flex items-center gap-2"
                animate={active ? { opacity: [0.55, 1, 0.55] } : {}}
                transition={scrollSceneLoop(active, { duration: 2.4, delay: i * 0.15, ease: "easeInOut" })}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-md border text-[9px]",
                    item.done
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600"
                      : "border-border bg-muted/50",
                  )}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className="text-[10px] font-medium text-foreground">{item.label}</span>
              </motion.li>
            ))}
          </ul>
        </GlassPanel>
      </motion.div>
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 bottom-8 -translate-x-1/2" />
    </SceneStage>
  );
}

export function StaffVisual({ icon, active }: SceneProps) {
  const team = [
    { name: "Anna", role: "Service", shift: "17–23" },
    { name: "Marco", role: "Küche", shift: "14–22" },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className="left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 bg-blue-500/15" />
      {team.map((m, i) => (
        <motion.div
          key={m.name}
          className="absolute w-36"
          style={{ left: i === 0 ? "8%" : "58%", top: i === 0 ? "18%" : "52%" }}
          animate={active ? { y: [0, -6, 0], scale: [1, 1.03, 1] } : {}}
          transition={scrollSceneLoop(active, { duration: 3.6, delay: i * 0.15, ease: "easeInOut" })}
        >
          <GlassPanel active={active} className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/15" />
              <div>
                <p className="text-[10px] font-bold text-foreground">{m.name}</p>
                <p className="text-[9px] text-muted-foreground">{m.role}</p>
              </div>
            </div>
            <p className="mt-2 rounded-md bg-muted/60 px-2 py-0.5 text-center text-[9px] font-semibold tabular-nums text-foreground">
              {m.shift}
            </p>
          </GlassPanel>
        </motion.div>
      ))}
      <HeroMonolith icon={icon} active={active} className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}
