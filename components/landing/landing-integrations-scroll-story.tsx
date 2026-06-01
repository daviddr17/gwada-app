"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Plug } from "lucide-react";
import { useId, useRef, useState } from "react";
import { LandingIntegrationVisual } from "@/components/landing/landing-integration-visual";
import { LANDING_INTEGRATION_ITEMS } from "@/components/landing/landing-integration-items";
import {
  SCROLL_STORY_VH_PER_ITEM,
  scrollStoryItemRange,
} from "@/lib/landing/scroll-story-range";
import { cn } from "@/lib/utils";

const ITEM_COUNT = LANDING_INTEGRATION_ITEMS.length;
const SCROLL_HEIGHT_VH = ITEM_COUNT * SCROLL_STORY_VH_PER_ITEM;

type IntegrationSlideProps = {
  index: number;
  scrollYProgress: MotionValue<number>;
};

function IntegrationSlide({ index, scrollYProgress }: IntegrationSlideProps) {
  const item = LANDING_INTEGRATION_ITEMS[index]!;
  const [start, end] = scrollStoryItemRange(index, ITEM_COUNT);
  const mid = (start + end) / 2;
  const span = end - start;
  const fadeIn = span * 0.1;
  const fadeOut = span * 0.1;
  const clearIn = span * 0.2;
  const clearOut = span * 0.2;

  const t1 = start + fadeIn;
  const t2 = start + clearIn;
  const t3 = end - clearOut;
  const t4 = end - fadeOut;

  const opacity = useTransform(
    scrollYProgress,
    [start, t1, t2, t3, t4, end],
    [0, 0.75, 1, 1, 0.75, 0],
  );
  const scale = useTransform(scrollYProgress, [start, mid, end], [0.9, 1, 0.9]);
  const x = useTransform(scrollYProgress, [start, mid, end], [44, 0, -32]);
  const rotate = useTransform(scrollYProgress, [start, mid, end], [3, 0, -2]);
  const blur = useTransform(
    scrollYProgress,
    [start, t1, t2, t3, t4, end],
    [2.5, 1.25, 0, 0, 1.25, 2.5],
  );
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  const [active, setActive] = useState(index === 0);

  useMotionValueEvent(opacity, "change", (v) => {
    const next = v > 0.2;
    setActive((prev) => (prev === next ? prev : next));
  });

  return (
    <motion.div
      style={{ opacity, scale, x, rotate, filter }}
      className="absolute inset-0 flex items-center justify-center p-2"
      aria-hidden
    >
      <div className="relative flex aspect-square w-full max-w-[min(100%,480px)] items-center justify-center">
        <div
          className={cn(
            "pointer-events-none absolute inset-[6%] rounded-full bg-gradient-to-br opacity-80 blur-3xl",
            item.accent,
          )}
        />
        <LandingIntegrationVisual item={item} active={active} className="relative z-10" />
      </div>
    </motion.div>
  );
}

type StoryCopyProps = {
  scrollYProgress: MotionValue<number>;
};

function IntegrationStoryCopy({ scrollYProgress }: StoryCopyProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let next = 0;
    for (let i = 0; i < ITEM_COUNT; i++) {
      const [start, end] = scrollStoryItemRange(i, ITEM_COUNT);
      if (v >= start && v < end) {
        next = i;
        break;
      }
      if (i === ITEM_COUNT - 1 && v >= end) next = i;
    }
    setActiveIndex((prev) => (prev === next ? prev : next));
  });

  const item = LANDING_INTEGRATION_ITEMS[activeIndex]!;
  const Glyph = item.Glyph;
  const instagramGradId = useId();

  return (
    <div className="relative z-10 max-w-lg lg:pr-8">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        <Plug className="size-3.5" aria-hidden />
        Integrationen
      </p>
      <motion.div
        key={item.id}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 flex items-center gap-3"
      >
        <span className="flex size-11 items-center justify-center rounded-xl border border-border/50 bg-card shadow-sm">
          <Glyph
            className="size-6"
            gradId={item.id === "instagram" ? instagramGradId : undefined}
          />
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {activeIndex + 1} / {ITEM_COUNT}
        </span>
      </motion.div>
      <motion.h2
        key={item.title}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl"
      >
        {item.title}
      </motion.h2>
      <motion.p
        key={item.description}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 text-pretty text-muted-foreground md:text-lg"
      >
        {item.description}
      </motion.p>
      <p className="mt-6 text-sm text-muted-foreground/80">
        Weitere Kanäle — z. B. E-Mail und Buchungsportale — folgen schrittweise.
      </p>
      <div className="mt-8 flex gap-2">
        {LANDING_INTEGRATION_ITEMS.map((entry, i) => (
          <div
            key={entry.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === activeIndex
                ? "w-8 bg-primary"
                : "w-1.5 bg-muted-foreground/30",
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Sticky Scroll-Story für Integrationen — gleicher Effekt wie Funktionen.
 */
export function LandingIntegrationsScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section
      id="integrations"
      ref={ref}
      className="relative scroll-mt-28 border-t border-border/50 bg-muted/10 py-0 dark:bg-muted/5"
      style={{ height: reduce ? "auto" : `${SCROLL_HEIGHT_VH}vh` }}
    >
      {reduce ? (
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Integrationen
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {LANDING_INTEGRATION_ITEMS.map((entry) => {
              const Glyph = entry.Glyph;
              return (
                <li
                  key={entry.id}
                  className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background">
                    <Glyph className="size-7" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{entry.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-center text-sm text-muted-foreground">
            Weitere Kanäle folgen.
          </p>
        </div>
      ) : (
        <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_68%)]" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <IntegrationStoryCopy scrollYProgress={scrollYProgress} />

            <div className="relative aspect-square max-h-[min(72vw,460px)] w-full max-w-md justify-self-center lg:max-h-[min(48vw,480px)]">
              {LANDING_INTEGRATION_ITEMS.map((entry, index) => (
                <IntegrationSlide
                  key={entry.id}
                  index={index}
                  scrollYProgress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
