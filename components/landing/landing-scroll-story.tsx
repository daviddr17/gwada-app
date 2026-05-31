"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

/**
 * Lange Scroll-Strecke mit sticky Viewport: „Filmsequenz“ aus drei Phasen
 * (Scale, Blur, Parallax) — rein CSS/Motion, keine Video-Assets.
 */
export function LandingScrollStory() {
  const branding = usePlatformAppBrandingOptional();
  const appName = branding?.appName ?? "gwada";
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const p1 = useTransform(scrollYProgress, [0, 0.32, 0.38], [0, 1, 0]);
  const p2 = useTransform(scrollYProgress, [0.34, 0.58, 0.64], [0, 1, 0]);
  const p3 = useTransform(scrollYProgress, [0.6, 0.88, 1], [0, 1, 0]);

  const scale1 = useTransform(p1, [0, 1], [0.86, 1]);
  const blur1 = useTransform(p1, [0, 1], [14, 0]);
  const y1 = useTransform(p1, [0, 1], [40, 0]);
  const filter1 = useTransform(blur1, (b) => `blur(${b}px)`);

  const scale2 = useTransform(p2, [0, 1], [0.88, 1]);
  const rotate2 = useTransform(p2, [0, 1], [-6, 0]);
  const x2 = useTransform(p2, [0, 1], [50, 0]);

  const scale3 = useTransform(p3, [0, 1], [0.9, 1]);
  const blur3 = useTransform(p3, [0, 1], [10, 0]);
  const filter3 = useTransform(blur3, (b) => `blur(${b}px)`);

  return (
    <section
      ref={ref}
      className="relative scroll-mt-28 bg-background"
      style={{ height: reduce ? "auto" : "280vh" }}
    >
      {reduce ? (
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Alles fließt — auch ohne Scroll-Tricks.
          </h2>
          <p className="mt-4 text-muted-foreground">
            In deinem System ist reduzierte Bewegung aktiv; Inhalte erscheinen
            statisch und klar lesbar.
          </p>
        </div>
      ) : (
        <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_68%)]" />

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="relative z-10 max-w-lg lg:pr-8">
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Im Fokus
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Scroll, der sich wie eine Inszenierung anfühlt.
              </h2>
              <p className="mt-5 text-pretty text-muted-foreground md:text-lg">
                Jede Phase bringt eine Ebene näher — Schärfe, Tiefe und Ruhe im
                gleichen Rhythmus wie deine Marke.
              </p>
            </div>

            <div className="relative flex aspect-square max-h-[min(72vw,420px)] items-center justify-center lg:max-h-[min(48vw,480px)]">
              <motion.div
                style={{
                  opacity: p1,
                  scale: scale1,
                  filter: filter1,
                  y: y1,
                }}
                className="absolute inset-[6%] rounded-[2rem] bg-gradient-to-br from-violet-500/90 via-fuchsia-500/75 to-cyan-400/80 shadow-2xl ring-1 ring-white/20"
              />
              <motion.div
                style={{
                  opacity: p2,
                  scale: scale2,
                  rotate: rotate2,
                  x: x2,
                }}
                className="absolute inset-[14%] rounded-3xl border border-white/30 bg-white/15 shadow-xl backdrop-blur-xl dark:bg-white/10"
              />
              <motion.div
                style={{
                  opacity: p3,
                  scale: scale3,
                  filter: filter3,
                }}
                className="absolute inset-[26%] flex items-center justify-center rounded-2xl bg-background/90 text-center shadow-2xl ring-1 ring-border/60 backdrop-blur-md"
              >
                <span className="px-6 text-sm font-medium text-foreground md:text-base">
                  {appName} — klar, ruhig, bereit für Gäste.
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
