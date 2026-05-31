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
import { LANDING_FEATURE_ITEMS } from "@/components/landing/landing-feature-items";
import { cn } from "@/lib/utils";

const FEATURE_COUNT = LANDING_FEATURE_ITEMS.length;
/** Scroll-Strecke: pro Feature ~70vh Gefühl */
const SCROLL_HEIGHT_VH = FEATURE_COUNT * 70;

function featureRange(index: number): [number, number] {
  const pad = 0.04;
  const span = (1 - pad * 2) / FEATURE_COUNT;
  const start = pad + index * span;
  const end = start + span;
  return [start, end];
}

type FeatureSlideProps = {
  index: number;
  scrollYProgress: MotionValue<number>;
};

function FeatureSlide({ index, scrollYProgress }: FeatureSlideProps) {
  const feature = LANDING_FEATURE_ITEMS[index]!;
  const [start, end] = featureRange(index);
  const mid = (start + end) / 2;
  const span = end - start;
  const fade = span * 0.22;

  const opacity = useTransform(
    scrollYProgress,
    [start, start + fade, end - fade, end],
    [0, 1, 1, 0],
  );
  const scale = useTransform(scrollYProgress, [start, mid, end], [0.88, 1, 0.88]);
  const x = useTransform(scrollYProgress, [start, mid, end], [56, 0, -40]);
  const rotate = useTransform(scrollYProgress, [start, mid, end], [4, 0, -3]);
  const blur = useTransform(scrollYProgress, [start, mid, end], [10, 0, 8]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  const Icon = feature.icon;

  return (
    <motion.div
      style={{ opacity, scale, x, rotate, filter }}
      className="absolute inset-0 flex items-center justify-center p-2"
      aria-hidden
    >
      <div
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/95 p-8 shadow-2xl ring-1 ring-border/40 backdrop-blur-xl",
          "dark:bg-card/80",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
            feature.accent,
          )}
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
            <Icon className="size-7" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Funktion {index + 1} / {FEATURE_COUNT}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              {feature.title}
            </h3>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        </div>
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
      const [start, end] = featureRange(i);
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
        Im Fokus
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
            key={item.title}
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
      ref={ref}
      className="relative scroll-mt-28 bg-background"
      style={{ height: reduce ? "auto" : `${SCROLL_HEIGHT_VH}vh` }}
    >
      {reduce ? (
        <div className="mx-auto max-w-3xl space-y-8 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Funktionen im Überblick
          </h2>
          <ul className="space-y-6">
            {LANDING_FEATURE_ITEMS.map((f) => (
              <li key={f.title} className="rounded-2xl border border-border/60 p-6">
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

            <div className="relative aspect-[4/5] max-h-[min(72vw,460px)] w-full max-w-md justify-self-center lg:max-h-[min(48vw,480px)]">
              {LANDING_FEATURE_ITEMS.map((item, index) => (
                <FeatureSlide
                  key={item.title}
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
