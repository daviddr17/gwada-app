"use client";

import { motion, type Transition } from "framer-motion";
import { useId, type ComponentType } from "react";
import type {
  IntegrationGlyphProps,
  LandingIntegrationId,
  LandingIntegrationItem,
} from "@/components/landing/landing-integration-items";
import {
  GlassPanel,
  GlowOrb,
  SceneStage,
  scrollSceneLoop,
} from "@/components/landing/landing-scroll-scene-primitives";
import { cn } from "@/lib/utils";

type SceneProps = {
  item: LandingIntegrationItem;
  active: boolean;
};

const spring: Transition = { type: "spring", stiffness: 280, damping: 24 };

function HeroBrand({
  Glyph,
  active,
  gradId,
  className,
}: {
  Glyph: ComponentType<IntegrationGlyphProps>;
  active: boolean;
  gradId?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn("relative z-30", className)}
      animate={active ? { y: [0, -14, 0] } : { y: 4 }}
      transition={scrollSceneLoop(active, { duration: 5, ease: "easeInOut" })}
    >
      <motion.div
        className="absolute -inset-4 rounded-[2.25rem] bg-[conic-gradient(from_120deg,transparent_30%,var(--accent)_55%,transparent_75%)] opacity-50 blur-md"
        animate={active ? { rotate: 360 } : { rotate: 0 }}
        transition={scrollSceneLoop(active, { duration: 14, ease: "linear" })}
      />
      <div
        className={cn(
          "relative flex size-[7rem] items-center justify-center rounded-[1.85rem]",
          "bg-gradient-to-br from-card via-card to-muted/70",
          "shadow-[0_32px_80px_-28px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.14)]",
          "ring-1 ring-border/60",
        )}
      >
        <Glyph className="size-16" gradId={gradId} />
      </div>
    </motion.div>
  );
}

function GoogleVisual({ item, active }: SceneProps) {
  const { Glyph } = item;
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className={cn("left-1/4 top-1/4 size-40", item.brandGlow)} />
      <motion.div
        className="absolute right-4 top-10 z-20 w-40"
        animate={active ? { y: [0, -6, 0], rotate: [4, 1, 4] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">Google Business</p>
          <p className="mt-1 text-sm font-semibold text-foreground">Restaurant am See</p>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs font-bold text-amber-500">4,8</span>
            <span className="text-[10px] text-amber-500">★★★★★</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
            „Super Service, gerne wieder …“
          </p>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-6 flex items-center gap-2 rounded-xl border border-border/50 bg-card/90 px-2.5 py-1.5 shadow-md"
        animate={active ? { x: [0, 5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        <span className="text-lg" aria-hidden>
          📍
        </span>
        <span className="text-[10px] font-medium text-foreground">Auf Karte sichtbar</span>
      </motion.div>
      <HeroBrand Glyph={Glyph} active={active} className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" />
      <motion.span
        className="absolute bottom-10 right-8 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary ring-1 ring-primary/20"
        animate={active ? { opacity: [0.6, 1, 0.6] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.5, ease: "easeInOut" })}
      >
        Verbunden
      </motion.span>
    </SceneStage>
  );
}

function FacebookVisual({ item, active }: SceneProps) {
  const { Glyph } = item;
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className={cn("right-1/4 top-1/3 size-36", item.brandGlow)} />
      <motion.div
        className="absolute left-4 top-12 z-20 w-[11.5rem]"
        animate={active ? { rotate: [-3, 1, -3], y: [0, -5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.2, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-[#1877F2]/15" />
            <div>
              <p className="text-[10px] font-semibold text-foreground">Eure Seite</p>
              <p className="text-[9px] text-muted-foreground">Gerade aktiv</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            Tageskarte online — Link in Bio.
          </p>
          <div className="mt-2 flex gap-2 text-[9px] text-muted-foreground">
            <span>👍 24</span>
            <span>💬 5</span>
          </div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-16 right-4 z-10 max-w-[9.5rem]"
        animate={active ? { y: [0, -6, 0], scale: [1, 1.02, 1] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.8, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="rounded-2xl rounded-br-md bg-[#1877F2]/10 p-2.5">
          <p className="text-[10px] font-medium text-foreground">Messenger</p>
          <p className="mt-1 text-[9px] text-muted-foreground">Tisch für 4 heute Abend?</p>
        </GlassPanel>
      </motion.div>
      <HeroBrand Glyph={Glyph} active={active} className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2" />
    </SceneStage>
  );
}

function InstagramVisual({ item, active }: SceneProps) {
  const gradId = useId();
  const { Glyph } = item;
  const stories = ["#F58529", "#DD2A7B", "#8134AF"];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className={cn("left-1/2 top-0 size-44 -translate-x-1/2", item.brandGlow)} />
      <motion.div
        className="absolute left-6 top-10 flex gap-2"
        animate={active ? { y: [0, -4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4, ease: "easeInOut" })}
      >
        {stories.map((color, i) => (
          <motion.div
            key={color}
            className="flex size-11 items-center justify-center rounded-full p-[2px]"
            style={{
              background: `linear-gradient(135deg, ${color}, ${stories[(i + 1) % 3]})`,
            }}
            animate={active ? { scale: [1, 1.08, 1] } : {}}
            transition={scrollSceneLoop(active, {
              duration: 2.2,
              delay: i * 0.12,
              ease: "easeInOut",
            })}
          >
            <div className="size-full rounded-full bg-card ring-1 ring-border/40" />
          </motion.div>
        ))}
      </motion.div>
      <motion.div
        className="absolute right-2 top-24 z-20 w-32"
        animate={active ? { x: [0, 4, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.6, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-2.5">
          <p className="text-[10px] font-semibold text-foreground">Neue DM</p>
          <p className="mt-1 text-[9px] text-muted-foreground">Reservierung möglich?</p>
          <motion.span
            className="mt-2 inline-block text-xs"
            animate={active ? { scale: [1, 1.2, 1] } : {}}
            transition={scrollSceneLoop(active, { duration: 1.5, ease: "easeInOut" })}
            aria-hidden
          >
            ♥
          </motion.span>
        </GlassPanel>
      </motion.div>
      <div className="absolute bottom-14 left-8 grid grid-cols-3 gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="size-9 rounded-md bg-muted-foreground/15 ring-1 ring-border/30"
            animate={active ? { opacity: [0.4, 0.9, 0.4] } : { opacity: 0.5 }}
            transition={scrollSceneLoop(active, {
              duration: 2.5,
              delay: (i % 3) * 0.1,
              ease: "easeInOut",
            })}
          />
        ))}
      </div>
      <HeroBrand
        Glyph={Glyph}
        active={active}
        gradId={gradId}
        className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2"
      />
    </SceneStage>
  );
}

function WhatsAppVisual({ item, active }: SceneProps) {
  const { Glyph } = item;
  const lines = [
    { out: false, text: "Hallo, Tisch für 2 um 19 Uhr?" },
    { out: true, text: "Gerne — ist notiert ✓" },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className={cn("bottom-1/4 right-1/4 size-40", item.brandGlow)} />
      <motion.div
        className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2"
        animate={active ? { y: [0, -6, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="space-y-2 p-3">
          {lines.map((line, i) => (
            <motion.div
              key={line.text}
              className={cn(
                "max-w-[85%] rounded-2xl px-2.5 py-1.5 text-[10px] leading-snug",
                line.out
                  ? "ml-auto bg-[#25D366]/20 text-foreground"
                  : "bg-muted text-muted-foreground",
              )}
              initial={false}
              animate={
                active
                  ? { opacity: [0.5, 1, 1], y: [6, 0, 0] }
                  : { opacity: 0.7, y: 4 }
              }
              transition={
                active
                  ? { duration: 0.5, delay: 0.15 + i * 0.25, ease: "easeOut" }
                  : spring
              }
            >
              {line.text}
            </motion.div>
          ))}
          <motion.div
            className="flex gap-1 pl-1"
            animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.4 }}
            transition={scrollSceneLoop(active, { duration: 1.2, ease: "easeInOut" })}
          >
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="size-1.5 rounded-full bg-[#25D366]"
              />
            ))}
          </motion.div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-16 left-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 shadow-sm"
        animate={active ? { scale: [1, 1.04, 1] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.5, ease: "easeInOut" })}
      >
        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          QR verknüpft
        </p>
      </motion.div>
      <HeroBrand Glyph={Glyph} active={active} className="absolute left-1/2 bottom-8 -translate-x-1/2" />
    </SceneStage>
  );
}

function LexofficeVisual({ item, active }: SceneProps) {
  const { Glyph } = item;
  const docs = [
    { label: "Rechnung #1042", amount: "1.240 €", synced: true },
    { label: "Angebot Event", amount: "890 €", synced: true },
    { label: "Beleg Lieferant", amount: "156 €", synced: false },
  ];
  return (
    <SceneStage active={active}>
      <GlowOrb active={active} className={cn("left-1/3 top-1/4 size-44", item.brandGlow)} />
      <motion.div
        className="absolute right-3 top-10 z-20 w-[12.5rem]"
        animate={active ? { y: [0, -6, 0], rotate: [3, 0, 3] } : {}}
        transition={scrollSceneLoop(active, { duration: 4.5, ease: "easeInOut" })}
      >
        <GlassPanel active={active} className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">Buchführung</p>
          <div className="mt-2 space-y-2">
            {docs.map((doc, i) => (
              <motion.div
                key={doc.label}
                className="flex items-center justify-between gap-2 border-b border-border/30 pb-2 last:border-0 last:pb-0"
                animate={active ? { x: [5, 0, 5], opacity: [0.65, 1, 0.65] } : {}}
                transition={scrollSceneLoop(active, {
                  duration: 2.8,
                  delay: i * 0.12,
                  ease: "easeInOut",
                })}
              >
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium text-foreground">
                    {doc.label}
                  </p>
                  <p className="text-[9px] font-semibold tabular-nums text-[#00A88F]">
                    {doc.amount}
                  </p>
                </div>
                {doc.synced ? (
                  <span className="shrink-0 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Sync
                  </span>
                ) : (
                  <motion.span
                    className="size-1.5 shrink-0 rounded-full bg-amber-500"
                    animate={active ? { opacity: [0.4, 1, 0.4] } : {}}
                    transition={scrollSceneLoop(active, { duration: 1.5, ease: "easeInOut" })}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-6 rounded-xl border border-[#00A88F]/30 bg-[#00A88F]/10 px-3 py-2 shadow-sm"
        animate={active ? { x: [0, 5, 0] } : {}}
        transition={scrollSceneLoop(active, { duration: 3.5, ease: "easeInOut" })}
      >
        <p className="text-[10px] font-semibold text-[#007A68] dark:text-[#5eead4]">
          Kontakte verknüpft
        </p>
      </motion.div>
      <HeroBrand Glyph={Glyph} active={active} className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2" />
      <motion.span
        className="absolute bottom-10 right-8 rounded-full bg-[#00A88F]/15 px-3 py-1 text-[10px] font-semibold text-[#007A68] ring-1 ring-[#00A88F]/25 dark:text-[#5eead4]"
        animate={active ? { opacity: [0.6, 1, 0.6] } : {}}
        transition={scrollSceneLoop(active, { duration: 2.5, ease: "easeInOut" })}
      >
        Verbunden
      </motion.span>
    </SceneStage>
  );
}

const VISUALS: Record<LandingIntegrationId, ComponentType<SceneProps>> = {
  google: GoogleVisual,
  facebook: FacebookVisual,
  instagram: InstagramVisual,
  whatsapp: WhatsAppVisual,
  lexoffice: LexofficeVisual,
};

export function LandingIntegrationVisual({
  item,
  active,
  className,
}: {
  item: LandingIntegrationItem;
  active: boolean;
  className?: string;
}) {
  const Visual = VISUALS[item.id];
  return (
    <div
      className={cn("relative size-full min-h-[300px] max-h-[460px]", className)}
      aria-hidden
    >
      <Visual item={item} active={active} />
    </div>
  );
}
