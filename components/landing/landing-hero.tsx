"use client";

import { motion, useMotionTemplate, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StripeHeroCanvas } from "@/components/landing/stripe-hero-canvas";

type Props = {
  mouse: { x: number; y: number };
  onScrollToSection: (id: string) => void;
};

/**
 * Full-viewport Hero: Stripe-Gradient + Glas-Card, starke Typo, CTAs.
 */
export function LandingHero({ mouse, onScrollToSection }: Props) {
  const sx = useSpring(mouse.x, { stiffness: 80, damping: 24, mass: 0.4 });
  const sy = useSpring(mouse.y, { stiffness: 80, damping: 24, mass: 0.4 });

  useEffect(() => {
    sx.set(mouse.x);
    sy.set(mouse.y);
  }, [mouse.x, mouse.y, sx, sy]);

  /* Entgegengesetzt zur Maus: Maus rechts → Karte leicht nach links */
  const shiftX = useTransform(sx, [-1, 1], [12, -12]);
  const shiftY = useTransform(sy, [-1, 1], [10, -10]);
  const glareX = useTransform(sx, [-1, 1], [22, 78]);
  const glareY = useTransform(sy, [-1, 1], [18, 82]);
  const glare = useMotionTemplate`radial-gradient(120% 80% at ${glareX}% ${glareY}%, rgba(255,255,255,0.22) 0%, transparent 55%)`;

  return (
    <section
      id="home"
      className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden scroll-mt-28 bg-[#f4f6fd] pt-16 pb-24 md:pb-32 dark:bg-[#0b1020]"
    >
      {/* isolate + z-0: Canvas bleibt im Hero-Stacking-Context (nicht hinter der Page-bg) */}
      <StripeHeroCanvas />

      {/* sanfter Übergang zum hellen Body unterhalb des Viewports */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-background dark:to-background"
        aria-hidden
      />

      <div className="relative z-[2] mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center">
        <motion.div
          style={{ x: shiftX, y: shiftY }}
          className="relative max-w-3xl rounded-[2rem] border border-neutral-200/70 bg-white/80 p-10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] md:p-14"
        >
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-70"
            style={{ background: glare }}
          />
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-xs font-semibold tracking-[0.22em] text-neutral-500 uppercase dark:text-white/80"
          >
            Gwada
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-6xl md:leading-[1.05] dark:text-white"
          >
            Die digitale Speisekarte, die sich anfühlt wie ein Produkt von Apple.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-neutral-600 md:text-lg dark:text-white/85"
          >
            Reservierungen, Menü, Branding — ein ruhiges, hochwertiges Erlebnis für
            Gäste und Team. Weniger Lärm, mehr Klarheit.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              className="h-12 min-w-[11rem] rounded-full border-0 bg-neutral-900 px-8 text-base font-medium text-white shadow-lg hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-white/95"
              render={<Link href="/login" />}
            >
              Jetzt starten
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-neutral-300 bg-white/90 px-8 text-base font-medium text-neutral-900 backdrop-blur-md hover:bg-neutral-50 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              onClick={() => onScrollToSection("features")}
            >
              Funktionen
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
