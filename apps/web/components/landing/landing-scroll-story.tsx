"use client";

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef, useState } from "react";
import { LandingFeatureVisual } from "@/components/landing/landing-feature-visual";
import { LANDING_FEATURE_ITEMS } from "@/components/landing/landing-feature-items";
import {
  SCROLL_STORY_VH_PER_ITEM,
  scrollStoryItemRange,
} from "@/lib/landing/scroll-story-range";
import { cn } from "@/lib/utils";

const FEATURE_COUNT = LANDING_FEATURE_ITEMS.length;
const SCROLL_HEIGHT_VH = FEATURE_COUNT * SCROLL_STORY_VH_PER_ITEM;

type FeatureSlideProps = {
  index: number;
  scrollYProgress: MotionValue<number>;
};

function FeatureSlide({ index, scrollYProgress }: FeatureSlideProps) {
  const feature = LANDING_FEATURE_ITEMS[index]!;
  const [start, end] = scrollStoryItemRange(index, FEATURE_COUNT);
  const mid = (start + end) / 2;
  const span = end - start;
  /** Kurzer Ein-/Ausblend — lange Plateau-Phase zum Erkennen der Szene */
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
  /** Leichter Blur — lange Phase bei 0, Ränder nur leicht weich */
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
            feature.accent,
          )}
        />
        <LandingFeatureVisual
          visual={feature.visual}
          icon={feature.icon}
          active={active}
          className="relative z-10"
        />
      </div>
    </motion.div>
  );
}

type StoryCopyProps = {
  scrollYProgress: MotionValue<number>;
};

function StoryCopy({ scrollYProgress }: StoryCopyProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let next = 0;
    for (let i = 0; i < FEATURE_COUNT; i++) {
      const [start, end] = scrollStoryItemRange(i, FEATURE_COUNT);
      if (v >= start && v < end) {
        next = i;
        break;
      }
      if (i === FEATURE_COUNT - 1 && v >= end) next = i;
    }
    setActiveIndex((prev) => (prev === next ? prev : next));
  });

  const feature = LANDING_FEATURE_ITEMS[activeIndex]!;

  return (
    <div className="relative z-10 max-w-lg lg:pr-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        Module
      </p>
      <motion.h2
        key={feature.title}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl"
      >
        {feature.title}
      </motion.h2>
      <motion.p
        key={feature.description}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 text-pretty text-muted-foreground md:text-lg"
      >
        {feature.description}
      </motion.p>
      <div className="mt-8 flex gap-2">
        {LANDING_FEATURE_ITEMS.map((item, i) => (
          <div
            key={item.id}
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
 * Sticky Scroll-Story: Features fahren beim Scroll ein und aus (Scale, Blur, Slide).
 */
export function LandingScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section
      id="features"
      ref={ref}
      className="relative scroll-mt-28 bg-background"
      style={{ height: reduce ? "auto" : `${SCROLL_HEIGHT_VH}vh` }}
    >
      {reduce ? (
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Module
          </h2>
          <ul className="space-y-6">
            {LANDING_FEATURE_ITEMS.map((f) => (
              <li key={f.id} className="rounded-2xl border border-border/60 p-6">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-muted-foreground">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_68%)]" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <StoryCopy scrollYProgress={scrollYProgress} />

            <div className="relative aspect-square max-h-[min(72vw,460px)] w-full max-w-md justify-self-center lg:max-h-[min(48vw,480px)]">
              {LANDING_FEATURE_ITEMS.map((item, index) => (
                <FeatureSlide
                  key={item.id}
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
